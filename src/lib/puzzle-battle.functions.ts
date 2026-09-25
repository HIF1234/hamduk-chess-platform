import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Free players get a few battles a day so they can try it; Plus and Gold are unlimited.
const FREE_DAILY = 3;
const COUNTDOWN_MS = 4_000;
const DURATION_MS = 3 * 60_000;
// Public battles older than this are not matched; the creator is probably gone.
const MATCH_WINDOW_MS = 2 * 60_000;
const RATING_WINDOW = 300;

const Id = z.object({ battleId: z.string().uuid() });

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Db = Awaited<ReturnType<typeof db>>;

async function assertCanStart(s: Db, userId: string) {
  const { data: me } = await s
    .from("profiles")
    .select("subscription_tier, is_guest, banned_at")
    .eq("id", userId)
    .single();
  if (!me || me.is_guest) throw new Error("Create a free account to play Puzzle Battle.");
  if (me.banned_at) throw new Error("Your account is suspended.");
  if (me.subscription_tier !== "free") return;
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await s
    .from("puzzle_battles")
    .select("id", { count: "exact", head: true })
    .or(`player_a.eq.${userId},player_b.eq.${userId}`)
    .neq("status", "cancelled")
    .gte("created_at", since.toISOString());
  if ((count ?? 0) >= FREE_DAILY) {
    throw new Error(
      `Free accounts get ${FREE_DAILY} battles a day. Hamduk Plus and Gold are unlimited.`,
    );
  }
}

async function puzzleRating(s: Db, userId: string) {
  const { data } = await s
    .from("user_puzzle_stats")
    .select("rating")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.rating ?? 1200;
}

async function create(s: Db, userId: string, isPrivate: boolean) {
  const rating = await puzzleRating(s, userId);
  const { data: ids, error: pickErr } = await s.rpc("puzzle_battle_pick", { p_rating: rating });
  if (pickErr || !ids?.length) throw new Error("Couldn't find puzzles for a battle. Try again.");
  const { data, error } = await s
    .from("puzzle_battles")
    .insert({ player_a: userId, is_private: isPrivate, puzzle_ids: ids, a_rating: rating })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Atomically takes the empty seat in a waiting battle. Returns false if someone beat us to it. */
async function claim(s: Db, battleId: string, userId: string) {
  const start = Date.now() + COUNTDOWN_MS;
  const { data } = await s
    .from("puzzle_battles")
    .update({
      player_b: userId,
      status: "active",
      started_at: new Date(start).toISOString(),
      ends_at: new Date(start + DURATION_MS).toISOString(),
    })
    .eq("id", battleId)
    .eq("status", "waiting")
    .is("player_b", null)
    .neq("player_a", userId)
    .select("id")
    .maybeSingle();
  return !!data;
}

/** Joins the oldest compatible waiting battle, or opens one and waits.
 *  Called again while waiting, so two players who both opened a battle still meet: each
 *  only claims battles older than their own, so exactly one of them joins the other. */
export const findBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await db();
    const me = context.userId;

    const { data: open } = await s
      .from("puzzle_battles")
      .select("id, status, is_private, created_at")
      .or(`player_a.eq.${me},player_b.eq.${me}`)
      .in("status", ["waiting", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (open?.status === "active") return { battleId: open.id };
    const mine = open && !open.is_private ? open : null;
    if (!mine) await assertCanStart(s, me);

    const rating = await puzzleRating(s, me);
    let q = s
      .from("puzzle_battles")
      .select("id")
      .eq("status", "waiting")
      .eq("is_private", false)
      .neq("player_a", me)
      .gte("created_at", new Date(Date.now() - MATCH_WINDOW_MS).toISOString())
      .gte("a_rating", rating - RATING_WINDOW)
      .lte("a_rating", rating + RATING_WINDOW)
      .order("created_at")
      .limit(5);
    if (mine) q = q.lt("created_at", mine.created_at);
    const { data: candidates } = await q;
    for (const c of candidates ?? []) {
      if (await claim(s, c.id, me)) {
        if (mine) await s.from("puzzle_battles").update({ status: "cancelled" }).eq("id", mine.id);
        return { battleId: c.id };
      }
    }
    return { battleId: mine?.id ?? (await create(s, me, false)) };
  });

/** Opens a battle only reachable by link, to challenge a friend. */
export const createPrivateBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await db();
    await assertCanStart(s, context.userId);
    return { battleId: await create(s, context.userId, true) };
  });

export const joinBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const s = await db();
    const { data: b } = await s
      .from("puzzle_battles")
      .select("player_a, player_b, status")
      .eq("id", data.battleId)
      .maybeSingle();
    if (!b) throw new Error("Battle not found.");
    if (b.player_a === context.userId || b.player_b === context.userId) return { ok: true };
    if (b.status !== "waiting") throw new Error("This battle has already started or ended.");
    await assertCanStart(s, context.userId);
    if (!(await claim(s, data.battleId, context.userId))) {
      throw new Error("Someone else took this seat.");
    }
    return { ok: true };
  });

export const cancelBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const s = await db();
    await s
      .from("puzzle_battles")
      .update({ status: "cancelled" })
      .eq("id", data.battleId)
      .eq("player_a", context.userId)
      .eq("status", "waiting");
    return { ok: true };
  });

/** Battle state plus the puzzles. Settles the battle if its clock has run out. */
export const getBattle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const s = await db();
    const { data: b, error } = await s.rpc("puzzle_battle_settle", { p_battle: data.battleId });
    if (error) throw error;
    if (!b?.id) throw new Error("Battle not found.");
    const me = context.userId;
    const seated = b.player_a === me || b.player_b === me;
    // A private battle's link is the invitation, so anyone holding it may see who's waiting.
    if (!seated && b.status !== "waiting") throw new Error("This battle isn't yours.");

    const ids = [b.player_a, b.player_b].filter((x): x is string => !!x);
    const { data: people } = await s.from("profiles").select("id, username").in("id", ids);
    const name = new Map((people ?? []).map((p) => [p.id, p.username]));

    let puzzles: {
      id: string;
      fen: string;
      solution: string[];
      themes: string[];
      rating: number;
    }[] = [];
    if (seated && b.status !== "waiting") {
      const { data: rows } = await s
        .from("puzzles")
        .select("id, fen, solution, themes, rating")
        .in("id", b.puzzle_ids);
      const byId = new Map((rows ?? []).map((r) => [r.id, r]));
      puzzles = b.puzzle_ids
        .map((id: string) => byId.get(id))
        .filter((p): p is NonNullable<typeof p> => !!p);
    }
    return {
      battle: b,
      you: b.player_b === me ? ("b" as const) : ("a" as const),
      seated,
      names: {
        a: name.get(b.player_a) ?? "player",
        b: b.player_b ? (name.get(b.player_b) ?? "player") : null,
      },
      puzzles,
      serverNow: Date.now(),
    };
  });

/** Checks the player's moves against the puzzle solution and records the result. */
export const answerBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        battleId: z.string().uuid(),
        index: z.number().int().min(0).max(50),
        moves: z.array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/)).max(15),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await db();
    const { data: b } = await s
      .from("puzzle_battles")
      .select("puzzle_ids")
      .eq("id", data.battleId)
      .maybeSingle();
    const puzzleId = b?.puzzle_ids[data.index];
    if (!puzzleId) throw new Error("No such puzzle in this battle.");
    const { data: p } = await s.from("puzzles").select("solution").eq("id", puzzleId).single();
    // The solver's moves are the even plies. The board auto-queens, so compare squares only.
    const expected = (p?.solution ?? []).filter((_: string, i: number) => i % 2 === 0);
    const correct =
      expected.length > 0 &&
      data.moves.length === expected.length &&
      expected.every((m: string, i: number) => m.slice(0, 4) === data.moves[i].slice(0, 4));
    const { data: row, error } = await s.rpc("puzzle_battle_answer", {
      p_user: context.userId,
      p_battle: data.battleId,
      p_index: data.index,
      p_correct: correct,
    });
    if (error) throw new Error(error.message);
    return { correct, battle: row };
  });

/** The player's last few finished battles, newest first. */
export const myBattles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await db();
    const me = context.userId;
    const { data } = await s
      .from("puzzle_battles")
      .select("id, player_a, player_b, a_score, b_score, winner, finished_at")
      .or(`player_a.eq.${me},player_b.eq.${me}`)
      .eq("status", "finished")
      .order("finished_at", { ascending: false })
      .limit(10);
    const rows = data ?? [];
    const others = [
      ...new Set(
        rows
          .map((r) => (r.player_a === me ? r.player_b : r.player_a))
          .filter((x): x is string => !!x),
      ),
    ];
    const { data: people } = others.length
      ? await s.from("profiles").select("id, username").in("id", others)
      : { data: [] };
    const name = new Map((people ?? []).map((p) => [p.id, p.username]));
    return rows.map((r) => {
      const isA = r.player_a === me;
      const opp = isA ? r.player_b : r.player_a;
      return {
        id: r.id,
        opponent: opp ? (name.get(opp) ?? "player") : "player",
        mine: isA ? r.a_score : r.b_score,
        theirs: isA ? r.b_score : r.a_score,
        result:
          r.winner === me ? ("won" as const) : r.winner ? ("lost" as const) : ("drew" as const),
        finished_at: r.finished_at,
      };
    });
  });
