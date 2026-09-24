import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Real, live numbers for the home page (no invented stats). */
export const getHomeStats = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
  const head = { count: "exact" as const, head: true };
  const [online, bots, live, playersOnline, players, puzzlesToday] = await Promise.all([
    db.from("games").select("id", head).gte("created_at", dayStart.toISOString()),
    db.from("bot_games").select("id", head).gte("created_at", dayStart.toISOString()),
    db.from("games").select("id", head).eq("status", "active").eq("is_correspondence", false),
    db.from("profiles").select("id", head).gte("last_active_at", fiveMinAgo),
    db.from("profiles").select("id", head).eq("is_guest", false),
    db.from("puzzle_attempts").select("id", head).gte("created_at", dayStart.toISOString()),
  ]);
  return {
    gamesToday: (online.count ?? 0) + (bots.count ?? 0),
    liveGames: live.count ?? 0,
    playersOnline: playersOnline.count ?? 0,
    players: players.count ?? 0,
    puzzlesToday: puzzlesToday.count ?? 0,
  };
});

/** Everything the signed-in dashboard needs in one round trip. */
export const getMyDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const me = context.userId;
    const [
      { data: profile },
      { data: active },
      { data: recent },
      { data: ratings },
      { data: puzzle },
      { data: badges },
    ] = await Promise.all([
      db
        .from("profiles")
        .select("username, is_guest, subscription_tier")
        .eq("id", me)
        .maybeSingle(),
      db
        .from("games")
        .select("id, white_id, black_id, fen, time_control, is_correspondence, move_deadline")
        .eq("status", "active")
        .or(`white_id.eq.${me},black_id.eq.${me}`)
        .order("last_move_at", { ascending: false })
        .limit(10),
      db
        .from("games")
        .select(
          "id, white_id, black_id, winner_id, result, end_reason, time_control, ended_at, ply",
        )
        .eq("status", "completed")
        .or(`white_id.eq.${me},black_id.eq.${me}`)
        .order("ended_at", { ascending: false })
        .limit(10),
      db.from("ratings").select("time_control, variant, rating, games_played").eq("user_id", me),
      db
        .from("user_puzzle_stats")
        .select("rating, current_streak, best_streak, solved_count")
        .eq("user_id", me)
        .maybeSingle(),
      db
        .from("user_achievements")
        .select("unlocked_at, achievements(name, tier, icon)")
        .eq("user_id", me)
        .order("unlocked_at", { ascending: false })
        .limit(4),
    ]);

    const opponents = [
      ...new Set(
        [...(active ?? []), ...(recent ?? [])].map((g) =>
          g.white_id === me ? g.black_id : g.white_id,
        ),
      ),
    ];
    const { data: names } = opponents.length
      ? await db.from("profiles").select("id, username").in("id", opponents)
      : { data: [] };
    const nameOf = new Map((names ?? []).map((n) => [n.id, n.username]));

    const yourMove = (active ?? [])
      .filter((g) => (g.fen.split(" ")[1] === "w") === (g.white_id === me))
      .map((g) => ({
        id: g.id,
        opponent: nameOf.get(g.white_id === me ? g.black_id : g.white_id) ?? "Opponent",
        timeControl: g.time_control,
        correspondence: g.is_correspondence,
        deadline: g.move_deadline,
      }));

    const lastLoss = (recent ?? []).find((g) => g.winner_id && g.winner_id !== me && g.ply >= 10);

    const topRatings = (ratings ?? [])
      .filter((r) => r.games_played > 0)
      .sort((a, b) => b.games_played - a.games_played)
      .slice(0, 3);

    return {
      username: profile?.username ?? "",
      isGuest: !!profile?.is_guest,
      tier: profile?.subscription_tier ?? "free",
      yourMove,
      activeCount: active?.length ?? 0,
      lastLoss: lastLoss
        ? {
            id: lastLoss.id,
            opponent:
              nameOf.get(lastLoss.white_id === me ? lastLoss.black_id : lastLoss.white_id) ??
              "Opponent",
            endReason: lastLoss.end_reason,
            timeControl: lastLoss.time_control,
          }
        : null,
      ratings: topRatings,
      puzzle: puzzle ?? null,
      badges: (badges ?? []).map((b) => ({
        at: b.unlocked_at,
        ...((b.achievements as unknown as { name: string; tier: string; icon: string }) ?? {
          name: "",
          tier: "bronze",
          icon: "Award",
        }),
      })),
    };
  });

/** Presence heartbeat: keeps profiles.last_active_at fresh (online counts, admin
 *  activity stats, club analytics). Writes at most once a minute per player. */
export const heartbeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    await db
      .from("profiles")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", context.userId)
      .lt("last_active_at", cutoff);
    return { ok: true };
  });
