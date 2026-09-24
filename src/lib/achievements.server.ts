// Server-only achievement engine. Every rule is computed from data the server
// already trusts (games, bot_games, puzzle stats, …), so badges can't be claimed
// from the client. `scope` limits work to the rules a given event can affect.
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { notify } from "@/lib/notifications.server";
import { OPENINGS } from "@/lib/openings-data";

export type AchievementScope = "games" | "bots" | "puzzles" | "social" | "profile" | "analysis";

const BLITZ = ["3+0", "3+2", "5+0", "5+3"];
const BULLET = ["1+0", "1+1", "2+1"];

type Ctx = { userId: string };
type Rule = { slug: string; scopes: AchievementScope[]; test: (c: Ctx) => Promise<boolean> };

async function count(q: PromiseLike<{ count: number | null }>) {
  return (await q).count ?? 0;
}

const onlineWins = (u: string) =>
  db
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .eq("winner_id", u);
const botWins = (u: string) =>
  db
    .from("bot_games")
    .select("id", { count: "exact", head: true })
    .eq("user_id", u)
    .eq("result", "win");

async function totalGames(u: string) {
  const [online, bots] = await Promise.all([
    count(
      db
        .from("games")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed")
        .or(`white_id.eq.${u},black_id.eq.${u}`),
    ),
    count(db.from("bot_games").select("id", { count: "exact", head: true }).eq("user_id", u)),
  ]);
  return online + bots;
}

async function longestSameControlWinStreak(u: string) {
  const { data } = await db
    .from("games")
    .select("winner_id, time_control, ended_at")
    .eq("status", "completed")
    .or(`white_id.eq.${u},black_id.eq.${u}`)
    .order("ended_at", { ascending: true })
    .limit(500);
  const run = new Map<string, number>();
  let best = 0;
  for (const g of data ?? []) {
    const next = g.winner_id === u ? (run.get(g.time_control) ?? 0) + 1 : 0;
    run.set(g.time_control, next);
    best = Math.max(best, next);
  }
  return best;
}

async function longestDailyPuzzleRun(u: string) {
  const { data } = await db
    .from("puzzle_attempts")
    .select("created_at, correct, puzzles!inner(daily_date)")
    .eq("user_id", u)
    .eq("correct", true)
    .not("puzzles.daily_date", "is", null)
    .order("created_at", { ascending: true })
    .limit(1000);
  const days = new Set<string>();
  for (const row of data ?? []) {
    const daily = (row.puzzles as unknown as { daily_date: string | null }).daily_date;
    // Counts only when the daily puzzle was solved on its own day.
    if (daily && row.created_at.slice(0, 10) === daily) days.add(daily);
  }
  const sorted = [...days].sort();
  let best = 0;
  let cur = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    const t = Date.parse(d);
    cur = prev !== null && t - prev === 86_400_000 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = t;
  }
  return best;
}

async function hasComeback(u: string) {
  const { data: won } = await db
    .from("games")
    .select("id, white_id")
    .eq("status", "completed")
    .eq("winner_id", u)
    .order("ended_at", { ascending: false })
    .limit(200);
  if (!won?.length) return false;
  const { data: analyses } = await db
    .from("game_analysis")
    .select("game_id, eval_per_ply")
    .in(
      "game_id",
      won.map((g) => g.id),
    );
  const whiteOf = new Map(won.map((g) => [g.id, g.white_id === u]));
  return (analyses ?? []).some((a) => {
    const evals = Array.isArray(a.eval_per_ply) ? (a.eval_per_ply as number[]) : [];
    const sign = whiteOf.get(a.game_id) ? 1 : -1;
    return evals.some((cp) => typeof cp === "number" && cp * sign <= -300);
  });
}

async function wonTournament(u: string) {
  const { data: mine } = await db
    .from("tournament_players")
    .select("tournament_id, score")
    .eq("user_id", u);
  if (!mine?.length) return false;
  const ids = mine.map((m) => m.tournament_id);
  const { data: done } = await db
    .from("tournaments")
    .select("id")
    .in("id", ids)
    .eq("status", "completed");
  if (!done?.length) return false;
  const { data: all } = await db
    .from("tournament_players")
    .select("tournament_id, score")
    .in(
      "tournament_id",
      done.map((t) => t.id),
    );
  const top = new Map<string, number>();
  for (const p of all ?? [])
    top.set(p.tournament_id, Math.max(top.get(p.tournament_id) ?? 0, p.score));
  return mine.some(
    (m) => top.has(m.tournament_id) && m.score > 0 && m.score >= top.get(m.tournament_id)!,
  );
}

async function masteredAllOpenings(u: string) {
  const { data } = await db
    .from("user_opening_progress")
    .select("eco, mastered_depth")
    .eq("user_id", u);
  const best = new Map((data ?? []).map((r) => [r.eco, r.mastered_depth]));
  return OPENINGS.every((o) => (best.get(o.eco) ?? 0) >= o.moves.length);
}

const RULES: Rule[] = [
  {
    slug: "first-move",
    scopes: ["games", "bots"],
    test: async ({ userId }) => (await totalGames(userId)) >= 1,
  },
  {
    slug: "first-win",
    scopes: ["games", "bots"],
    test: async ({ userId }) =>
      (await count(onlineWins(userId))) + (await count(botWins(userId))) >= 1,
  },
  {
    slug: "puzzle-apprentice",
    scopes: ["puzzles"],
    test: async ({ userId }) => {
      const { data } = await db
        .from("user_puzzle_stats")
        .select("solved_count")
        .eq("user_id", userId)
        .maybeSingle();
      return (data?.solved_count ?? 0) >= 10;
    },
  },
  {
    slug: "puzzle-master",
    scopes: ["puzzles"],
    test: async ({ userId }) => {
      const { data } = await db
        .from("user_puzzle_stats")
        .select("solved_count")
        .eq("user_id", userId)
        .maybeSingle();
      return (data?.solved_count ?? 0) >= 500;
    },
  },
  {
    slug: "puzzle-streak-7",
    scopes: ["puzzles"],
    test: async ({ userId }) => {
      const { data } = await db
        .from("user_puzzle_stats")
        .select("best_streak")
        .eq("user_id", userId)
        .maybeSingle();
      return (data?.best_streak ?? 0) >= 7;
    },
  },
  {
    slug: "perfect-day",
    scopes: ["puzzles"],
    test: async ({ userId }) => (await longestDailyPuzzleRun(userId)) >= 7,
  },
  {
    slug: "checkmate-artist",
    scopes: ["games", "bots"],
    test: async ({ userId }) => {
      const [online, bots] = await Promise.all([
        count(onlineWins(userId).eq("end_reason", "checkmate")),
        count(botWins(userId).eq("end_reason", "checkmate")),
      ]);
      return online + bots >= 10;
    },
  },
  {
    slug: "mate-under-20",
    scopes: ["games", "bots"],
    test: async ({ userId }) => {
      const [online, bots] = await Promise.all([
        count(onlineWins(userId).lt("ply", 40)),
        count(botWins(userId).lt("ply", 40)),
      ]);
      return online + bots >= 1;
    },
  },
  {
    slug: "comeback-king",
    scopes: ["games", "analysis"],
    test: ({ userId }) => hasComeback(userId),
  },
  {
    slug: "win-streak-5",
    scopes: ["games"],
    test: async ({ userId }) => (await longestSameControlWinStreak(userId)) >= 5,
  },
  {
    slug: "blitz-beast",
    scopes: ["games"],
    test: async ({ userId }) => (await count(onlineWins(userId).in("time_control", BLITZ))) >= 10,
  },
  {
    slug: "bullet-survivor",
    scopes: ["games"],
    test: async ({ userId }) => (await count(onlineWins(userId).in("time_control", BULLET))) >= 10,
  },
  {
    slug: "beat-2000-bot",
    scopes: ["bots"],
    test: async ({ userId }) => (await count(botWins(userId).gte("bot_rating", 2200))) >= 1,
  },
  {
    slug: "naija-conqueror",
    scopes: ["bots"],
    test: async ({ userId }) => (await count(botWins(userId).eq("bot_id", "naija_legend"))) >= 1,
  },
  { slug: "tournament-victor", scopes: ["games"], test: ({ userId }) => wonTournament(userId) },
  {
    slug: "club-founder",
    scopes: ["social"],
    test: async ({ userId }) =>
      (await count(
        db.from("clubs").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      )) >= 1,
  },
  {
    slug: "socialite",
    scopes: ["social"],
    test: async ({ userId }) =>
      (await count(
        db
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", userId),
      )) >= 50,
  },
  {
    slug: "games-100",
    scopes: ["games", "bots"],
    test: async ({ userId }) => (await totalGames(userId)) >= 100,
  },
  {
    slug: "games-500",
    scopes: ["games", "bots"],
    test: async ({ userId }) => (await totalGames(userId)) >= 500,
  },
  {
    slug: "rated-1500",
    scopes: ["games"],
    test: async ({ userId }) =>
      (await count(
        db
          .from("ratings")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("rating", 1500),
      )) >= 1,
  },
  {
    slug: "rated-2000",
    scopes: ["games"],
    test: async ({ userId }) =>
      (await count(
        db
          .from("ratings")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("rating", 2000),
      )) >= 1,
  },
  {
    slug: "opening-scholar",
    scopes: ["profile"],
    test: ({ userId }) => masteredAllOpenings(userId),
  },
  {
    slug: "early-adopter",
    scopes: ["profile"],
    test: async ({ userId }) => {
      const { data: me } = await db
        .from("profiles")
        .select("created_at, is_guest")
        .eq("id", userId)
        .maybeSingle();
      if (!me || me.is_guest) return false;
      const earlier = await count(
        db
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_guest", false)
          .lt("created_at", me.created_at),
      );
      return earlier < 1000;
    },
  },
  {
    slug: "nigerian-pride",
    scopes: ["profile"],
    test: async ({ userId }) => {
      const { data } = await db.from("profiles").select("country").eq("id", userId).maybeSingle();
      return data?.country === "NG";
    },
  },
];

const LEGEND = "hamduk-legend";

/** Evaluates achievements for the given scopes and unlocks any newly earned ones.
 *  Never throws: achievements must not break the action that triggered them. */
export async function checkAchievements(
  userId: string,
  scopes: AchievementScope[],
): Promise<string[]> {
  try {
    const { data: have } = await db
      .from("user_achievements")
      .select("achievement_slug")
      .eq("user_id", userId);
    const unlocked = new Set((have ?? []).map((r) => r.achievement_slug));
    const candidates = RULES.filter(
      (r) => !unlocked.has(r.slug) && r.scopes.some((s) => scopes.includes(s)),
    );
    const results = await Promise.all(
      candidates.map(async (r) => ((await r.test({ userId })) ? r.slug : null)),
    );
    const earned = results.filter((s): s is string => s !== null);
    if (
      !unlocked.has(LEGEND) &&
      RULES.every((r) => unlocked.has(r.slug) || earned.includes(r.slug))
    ) {
      earned.push(LEGEND);
    }
    if (!earned.length) return [];

    const { data: inserted } = await db
      .from("user_achievements")
      .upsert(
        earned.map((slug) => ({ user_id: userId, achievement_slug: slug })),
        { onConflict: "user_id,achievement_slug", ignoreDuplicates: true },
      )
      .select("achievement_slug");
    const fresh = (inserted ?? []).map((r) => r.achievement_slug);
    if (!fresh.length) return [];

    const [{ data: meta }, { data: profile }] = await Promise.all([
      db.from("achievements").select("slug, name, description, tier").in("slug", fresh),
      db.from("profiles").select("username").eq("id", userId).maybeSingle(),
    ]);
    for (const a of meta ?? []) {
      await notify(userId, {
        type: "achievement",
        title: `Achievement unlocked: ${a.name}`,
        body: a.description,
        link: profile?.username ? `/profile/${profile.username}` : undefined,
        payload: { slug: a.slug, tier: a.tier },
      });
      await db.from("activity_feed").insert({
        user_id: userId,
        type: "achievement",
        payload: { slug: a.slug, name: a.name, tier: a.tier } as never,
      });
    }
    return fresh;
  } catch (e) {
    console.error("[achievements] check failed", e);
    return [];
  }
}
