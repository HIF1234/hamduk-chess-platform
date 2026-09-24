import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type TvGame = {
  id: string;
  fen: string;
  status: string;
  result: string | null;
  end_reason: string | null;
  time_control: string;
  variant: string;
  ply: number;
  spectator_count: number;
  white: { username: string; rating: number | null };
  black: { username: string; rating: number | null };
  tournament: { id: string; name: string } | null;
  combined: number;
};

async function hydrate(
  rows: {
    id: string;
    fen: string;
    status: string;
    result: string | null;
    end_reason: string | null;
    time_control: string;
    variant: string;
    ply: number;
    spectator_count: number;
    white_id: string;
    black_id: string;
    white_rating_before: number | null;
    black_rating_before: number | null;
  }[],
): Promise<TvGame[]> {
  if (!rows.length) return [];
  const db = await admin();
  const ids = rows.map((r) => r.id);
  const players = [...new Set(rows.flatMap((r) => [r.white_id, r.black_id]))];
  const [{ data: profs }, { data: tg }] = await Promise.all([
    db.from("profiles").select("id, username").in("id", players),
    db
      .from("tournament_games")
      .select("game_id, tournament_id, tournaments(name)")
      .in("game_id", ids),
  ]);
  const name = new Map((profs ?? []).map((p) => [p.id, p.username]));
  const tour = new Map(
    (tg ?? []).map((t) => [
      t.game_id,
      {
        id: t.tournament_id,
        name: (t.tournaments as unknown as { name: string } | null)?.name ?? "Tournament",
      },
    ]),
  );
  return rows.map((r) => ({
    id: r.id,
    fen: r.fen,
    status: r.status,
    result: r.result,
    end_reason: r.end_reason,
    time_control: r.time_control,
    variant: r.variant,
    ply: r.ply,
    spectator_count: r.spectator_count,
    white: { username: name.get(r.white_id) ?? "White", rating: r.white_rating_before },
    black: { username: name.get(r.black_id) ?? "Black", rating: r.black_rating_before },
    tournament: tour.get(r.id) ?? null,
    combined: (r.white_rating_before ?? 1200) + (r.black_rating_before ?? 1200),
  }));
}

const COLS =
  "id, fen, status, result, end_reason, time_control, variant, ply, spectator_count, white_id, black_id, white_rating_before, black_rating_before, created_at";

/** Live games ranked for TV: tournament games, then combined rating, then
 *  spectators, then most recent. Plus recently finished top games. */
export const getTvGames = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const since = new Date(Date.now() - 48 * 3600_000).toISOString();
  const [{ data: live }, { data: done }] = await Promise.all([
    db
      .from("games")
      .select(COLS)
      .eq("status", "active")
      .eq("is_public", true)
      .eq("is_correspondence", false)
      .order("created_at", { ascending: false })
      .limit(60),
    db
      .from("games")
      .select(COLS)
      .eq("status", "completed")
      .eq("is_public", true)
      .gte("ended_at", since)
      .gte("ply", 20)
      .order("ended_at", { ascending: false })
      .limit(60),
  ]);
  const liveGames = (await hydrate(live ?? [])).sort(
    (a, b) =>
      Number(!!b.tournament) - Number(!!a.tournament) ||
      b.combined - a.combined ||
      b.spectator_count - a.spectator_count,
  );
  const topFinished = (await hydrate(done ?? []))
    .sort((a, b) => b.combined - a.combined)
    .slice(0, 8);
  return { live: liveGames.slice(0, 12), finished: topFinished };
});

export const getTvRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const [{ data: c }, { data: role }] = await Promise.all([
      db.from("tv_commentators").select("user_id").eq("user_id", context.userId).maybeSingle(),
      db.from("admin_roles").select("role").eq("user_id", context.userId).maybeSingle(),
    ]);
    const isAdmin = !!role && ["super_admin", "admin"].includes(role.role);
    return { isCommentator: !!c || isAdmin, isAdmin };
  });

export const postCommentary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        gameId: z.string().uuid().nullable(),
        content: z.string().trim().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const [{ data: c }, { data: role }] = await Promise.all([
      db.from("tv_commentators").select("user_id").eq("user_id", context.userId).maybeSingle(),
      db.from("admin_roles").select("role").eq("user_id", context.userId).maybeSingle(),
    ]);
    if (!c && !(role && ["super_admin", "admin"].includes(role.role))) {
      throw new Error("Only HamdukChess TV commentators can post commentary.");
    }
    let ply: number | null = null;
    if (data.gameId) {
      const { data: g } = await db.from("games").select("ply").eq("id", data.gameId).maybeSingle();
      ply = g?.ply ?? null;
    }
    const { error } = await db
      .from("tv_commentary")
      .insert({ game_id: data.gameId, author_id: context.userId, content: data.content, ply });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admins appoint or remove commentators by username. */
export const setCommentator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ username: z.string().trim().min(2).max(40), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: role } = await db
      .from("admin_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!role || !["super_admin", "admin"].includes(role.role)) throw new Error("Admins only.");
    const { data: target } = await db
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();
    if (!target) throw new Error("No player with that username.");
    if (data.enabled) {
      await db
        .from("tv_commentators")
        .upsert({ user_id: target.id, added_by: context.userId }, { onConflict: "user_id" });
    } else {
      await db.from("tv_commentators").delete().eq("user_id", target.id);
    }
    return { ok: true };
  });
