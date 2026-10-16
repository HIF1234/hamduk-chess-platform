// Server code used only by the mobile app API (/api/app/v1). Plain functions rather than
// server functions: a server function that no web page uses isn't registered in production
// builds. Callers pass the authenticated context from authenticateRequest().
import { z } from "zod";
import type { authenticateRequest } from "@/integrations/supabase/auth-middleware";

export type AppContext = Awaited<ReturnType<typeof authenticateRequest>>;

const GAME_FIELDS =
  "id, white_id, black_id, status, result, end_reason, winner_id, fen, pgn, ply, time_control, variant, chess960_start_fen, rated, initial_sec, increment_sec, time_white_ms, time_black_ms, last_clock_update, draw_offer_by, takeback_offer_by, is_correspondence, move_deadline, created_at, ended_at, white_rating_delta, black_rating_delta";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function names(ids: string[]) {
  if (!ids.length) {
    return new Map<
      string,
      {
        username: string;
        rating: number;
        country: string | null;
        fideTitle: string | null;
        subscriptionTier: string;
      }
    >();
  }
  const s = await admin();
  const { data } = await s
    .from("profiles")
    .select("id, username, rating, country, fide_title, fide_title_verified, subscription_tier")
    .in("id", [...new Set(ids)]);
  return new Map(
    (data ?? []).map((p) => [
      p.id,
      {
        username: p.username,
        rating: p.rating,
        country: p.country,
        // Only a verified claim is shown to anyone but the player themselves (see
        // fide_title_verified's own migration) -- an unchecked "GM" claim is worse than none.
        fideTitle: p.fide_title_verified ? p.fide_title : null,
        subscriptionTier: p.subscription_tier,
      },
    ]),
  );
}

/** My games: everything in progress plus the most recent finished ones. */
export async function listMyGames(ctx: AppContext, input: unknown) {
  const data = z
    .object({ limit: z.coerce.number().int().min(1).max(50).default(20) })
    .parse(input ?? {});
  const s = await admin();
  const me = ctx.userId;
  const [{ data: live }, { data: done }] = await Promise.all([
    s
      .from("games")
      .select(GAME_FIELDS)
      .or(`white_id.eq.${me},black_id.eq.${me}`)
      .in("status", ["waiting", "active"])
      .order("created_at", { ascending: false })
      .limit(50),
    s
      .from("games")
      .select(GAME_FIELDS)
      .or(`white_id.eq.${me},black_id.eq.${me}`)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(data.limit),
  ]);
  const all = [...(live ?? []), ...(done ?? [])];
  const who = await names(all.flatMap((g) => [g.white_id, g.black_id]));
  const withPlayers = (g: (typeof all)[number]) => ({
    ...g,
    white: who.get(g.white_id) ?? null,
    black: who.get(g.black_id) ?? null,
  });
  return { active: (live ?? []).map(withPlayers), recent: (done ?? []).map(withPlayers) };
}

/** One game with both players. Anyone signed in may view a game (like spectating on the site). */
export async function getGameForApp(_ctx: AppContext, input: unknown) {
  const data = z.object({ gameId: z.string().uuid() }).parse(input);
  const s = await admin();
  const { data: g } = await s.from("games").select(GAME_FIELDS).eq("id", data.gameId).maybeSingle();
  if (!g) throw new Error("Game not found");
  const who = await names([g.white_id, g.black_id]);
  return {
    ...g,
    white: who.get(g.white_id) ?? null,
    black: who.get(g.black_id) ?? null,
    serverTime: Date.now(),
  };
}

/** Unseen puzzles near the player's rating, to solve offline. Plus/Gold get bigger packs. */
export async function getPuzzlePack(ctx: AppContext, input: unknown) {
  const data = z
    .object({
      count: z.coerce.number().int().min(1).max(500).default(100),
      theme: z
        .string()
        .regex(/^[a-zA-Z0-9]{2,30}$/)
        .optional(),
    })
    .parse(input ?? {});
  const s = await admin();
  const [{ data: me }, { data: stats }, { data: attemptedToday }, { data: dailyLimit }] =
    await Promise.all([
      s.from("profiles").select("subscription_tier, is_guest").eq("id", ctx.userId).maybeSingle(),
      s.from("user_puzzle_stats").select("rating").eq("user_id", ctx.userId).maybeSingle(),
      s.rpc("puzzles_attempted_today", { p_user: ctx.userId }),
      s.rpc("free_daily_puzzle_limit"),
    ]);
  const isFree = !me?.subscription_tier || me.subscription_tier === "free";
  // Free players can only score 20 a day anyway, so a small pack is enough.
  const cap = isFree ? 30 : 500;
  const rating = stats?.rating ?? 1200;
  const remainingToday = isFree ? Math.max(0, (dailyLimit ?? 20) - (attemptedToday ?? 0)) : null;
  // Theme packs use a wider band so rarer themes still fill a pack.
  const band = data.theme ? { below: 400, above: 500 } : { below: 250, above: 350 };
  const { data: puzzles, error } = await s.rpc("puzzle_pack", {
    p_user: ctx.userId,
    p_min: Math.max(400, rating - band.below),
    p_max: rating + band.above,
    p_limit: Math.min(data.count, cap),
    p_theme: data.theme,
  });
  if (error) throw error;
  return { rating, puzzles: puzzles ?? [], maxPack: cap, remainingToday };
}

/**
 * This player's per-theme accuracy ("Forks 72%, back rank 41%"), weakest first -- same
 * source (puzzle_ratings, one row per puzzle this player has ever solved/attempted) as the
 * web's getMyThemeProgress, so the numbers match if they ever look at both.
 */
export async function getPuzzleThemeStats(ctx: AppContext) {
  const s = await admin();
  const { data: ratings, error } = await s
    .from("puzzle_ratings")
    .select("puzzle_id, success")
    .eq("user_id", ctx.userId);
  if (error) throw error;
  if (!ratings || ratings.length === 0) return { themes: [] };

  const ids = ratings.map((r) => r.puzzle_id as string);
  const { data: puzzles } = await s.from("puzzles").select("id, themes").in("id", ids);
  const themesById = new Map<string, string[]>();
  for (const p of puzzles ?? []) themesById.set(p.id as string, (p.themes ?? []) as string[]);

  const agg = new Map<string, { attempted: number; solved: number }>();
  for (const r of ratings) {
    for (const t of themesById.get(r.puzzle_id as string) ?? []) {
      const cur = agg.get(t) ?? { attempted: 0, solved: 0 };
      cur.attempted += 1;
      if (r.success) cur.solved += 1;
      agg.set(t, cur);
    }
  }
  const themes = Array.from(agg, ([theme, v]) => ({
    theme,
    attempted: v.attempted,
    solved: v.solved,
    accuracy: Math.round((v.solved / v.attempted) * 100),
  })).sort((a, b) => a.accuracy - b.accuracy);
  return { themes };
}

/** Uploads puzzle attempts made offline, oldest first. Stops at the free daily limit. */
export async function syncPuzzleAttempts(ctx: AppContext, input: unknown) {
  const data = z
    .object({
      attempts: z
        .array(
          z.object({
            puzzleId: z.string().uuid(),
            success: z.boolean(),
            /** 0-2: highest hint level used (1 = square shown, 2 = move shown). */
            hintsUsed: z.number().int().min(0).max(2).default(0),
          }),
        )
        .min(1)
        .max(200),
    })
    .parse(input);
  const results: {
    puzzleId: string;
    status: "recorded" | "limit" | "error";
    rating?: number;
    delta?: number;
  }[] = [];
  let limited = false;
  // Free-tier only; stays null for Plus/Gold (unlimited, nothing to announce).
  let remainingToday: number | null = null;
  for (const a of data.attempts) {
    if (limited) {
      results.push({ puzzleId: a.puzzleId, status: "limit" });
      continue;
    }
    const { data: res, error } = await ctx.supabase.rpc("submit_puzzle_attempt", {
      p_puzzle_id: a.puzzleId,
      p_success: a.success,
      p_hints_used: a.hintsUsed,
    });
    if (error) {
      limited = error.message.includes("daily_puzzle_limit");
      results.push({ puzzleId: a.puzzleId, status: limited ? "limit" : "error" });
    } else {
      const r = res as { rating: number; delta: number; remaining_today: number | null };
      remainingToday = r.remaining_today;
      results.push({ puzzleId: a.puzzleId, status: "recorded", rating: r.rating, delta: r.delta });
    }
  }
  if (results.some((r) => r.status === "recorded")) {
    const { checkAchievements } = await import("@/lib/achievements.server");
    await checkAchievements(ctx.userId, ["puzzles"]);
  }
  return { results, remainingToday };
}

export async function listNotifications(ctx: AppContext, input: unknown) {
  const data = z
    .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
    .parse(input ?? {});
  const { data: rows, error } = await ctx.supabase
    .from("notifications")
    .select("id, type, title, body, link, read, created_at")
    .order("created_at", { ascending: false })
    .limit(data.limit);
  if (error) throw error;
  return { notifications: rows ?? [], unread: (rows ?? []).filter((r) => !r.read).length };
}

export async function markNotificationsRead(ctx: AppContext, input: unknown) {
  const data = z.object({ ids: z.array(z.string().uuid()).max(200).optional() }).parse(input ?? {});
  let q = ctx.supabase.from("notifications").update({ read: true }).eq("read", false);
  if (data.ids?.length) q = q.in("id", data.ids);
  const { error } = await q;
  if (error) throw error;
  return { ok: true };
}

/** An open challenge link, with who sent it, for the app's accept screen. */
export async function getChallengeForApp(ctx: AppContext, input: unknown) {
  const data = z.object({ id: z.string().uuid() }).parse(input);
  const s = await admin();
  const { data: ch } = await s
    .from("game_challenges")
    .select(
      "id, creator_id, time_control, variant, creator_color, rated, game_id, accepted_by, expires_at, target_user_id, declined",
    )
    .eq("id", data.id)
    .maybeSingle();
  if (!ch) throw new Error("Challenge not found");
  const who = await names([ch.creator_id]);
  return {
    ...ch,
    creator: who.get(ch.creator_id) ?? null,
    mine: ch.creator_id === ctx.userId,
    expired: !ch.game_id && new Date(ch.expires_at) < new Date(),
  };
}

const DeviceInput = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(["android", "ios"]).default("android"),
});

/** Registers this phone for push notifications (re-registering moves a token to the player). */
export async function registerDevice(ctx: AppContext, input: unknown) {
  const data = DeviceInput.parse(input);
  const s = await admin();
  const { error } = await s.from("device_tokens").upsert(
    {
      token: data.token,
      user_id: ctx.userId,
      platform: data.platform,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
  if (error) throw error;
  return { ok: true };
}

/** Stops notifications to this phone, e.g. on sign-out. */
export async function unregisterDevice(ctx: AppContext, input: unknown) {
  const data = DeviceInput.pick({ token: true }).parse(input);
  const s = await admin();
  await s.from("device_tokens").delete().eq("token", data.token).eq("user_id", ctx.userId);
  return { ok: true };
}

/** Top players by rating, same data as the website's /leaderboard. */
export async function getLeaderboard(_ctx: AppContext | null, input: unknown) {
  const { idsIn } = await import("@/lib/time-controls");
  const data = z
    .object({
      category: z.enum(["bullet", "blitz", "rapid", "classical"]).default("blitz"),
      variant: z.enum(["standard", "chess960"]).default("standard"),
      country: z.string().length(2).optional(),
      month: z.coerce.boolean().default(false),
      page: z.coerce.number().int().min(1).default(1),
    })
    .parse(input ?? {});
  const pageSize = 25;
  const s = await admin();
  const { data: rows, error } = await s.rpc("leaderboard", {
    p_tcs: idsIn(data.category),
    p_variant: data.variant,
    p_country: data.country,
    p_friends_of: undefined,
    p_month: data.month,
    p_limit: pageSize,
    p_offset: (data.page - 1) * pageSize,
  });
  if (error) throw new Error(error.message);
  return { rows: rows ?? [], page: data.page, pageSize };
}

/** Public games open to spectate right now, same pool as the website's /spectate. */
export async function listLiveGames(_ctx: AppContext | null) {
  const s = await admin();
  const { data: games, error } = await s
    .from("games")
    .select("id, white_id, black_id, time_control, variant, ply, spectator_count, rated")
    .eq("status", "active")
    .eq("is_public", true)
    .eq("is_correspondence", false)
    .order("last_move_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  const who = await names((games ?? []).flatMap((g) => [g.white_id, g.black_id]));
  return {
    games: (games ?? []).map((g) => ({
      ...g,
      white: who.get(g.white_id) ?? null,
      black: who.get(g.black_id) ?? null,
    })),
  };
}

/** "214 playing, 37 looking for 5 min": shown above the time-control tiles once there are
 *  enough players for the numbers to mean anything (the client decides the threshold). */
export async function getLiveCounts(_ctx: AppContext | null) {
  const s = await admin();
  const [{ count: activeGames }, { data: queueRows }] = await Promise.all([
    s
      .from("games")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("is_correspondence", false),
    s.from("matchmaking_queue").select("time_control"),
  ]);
  const looking: Record<string, number> = {};
  for (const r of queueRows ?? []) looking[r.time_control] = (looking[r.time_control] ?? 0) + 1;
  return { playing: (activeGames ?? 0) * 2, looking };
}

/** The single live game to show on a "TV" view -- whichever public game has the most
 *  spectators right now (falls back to the most recently active one). */
export async function getTopLiveGame(_ctx: AppContext | null) {
  const { games } = await listLiveGames(null);
  if (games.length === 0) return { game: null };
  const top = [...games].sort((a, b) => (b.spectator_count ?? 0) - (a.spectator_count ?? 0))[0];
  return { game: top };
}

/** A player's public profile by username, same data as the website's /profile/{username}. */
export async function getPublicProfile(_ctx: AppContext | null, input: unknown) {
  const { getProfileByUsername } = await import("@/lib/profile.functions");
  return getProfileByUsername({ data: input });
}

// ---------------------------------------------------------------- Puzzle Storm
// Mirrors storm.functions.ts (web-only, never exposed on /api/app/v1): same rules (3
// minutes, +1 per solve, no penalty for a miss besides losing the puzzle), same
// puzzle_storm_scores table and Redis leaderboards, so a score means the same thing on
// either platform. Duplicated as plain functions here rather than calling the web's
// createServerFn exports directly: those require requireSupabaseAuth, which expects a
// session cookie the mobile app's Bearer-token requests don't have.

const STORM_DURATION_SEC = 180;

async function assertPlusOrGold(userId: string) {
  const s = await admin();
  const { data } = await s
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .maybeSingle();
  const tier = (data?.subscription_tier ?? "free") as "free" | "plus" | "gold";
  if (tier === "free") throw new Error("Puzzle Storm is a Plus / Gold feature. Upgrade to play.");
  return tier;
}

/** Plus/Gold — an unseen-friendly puzzle stream for one storm run. */
export async function getStormStream(ctx: AppContext, input: unknown) {
  await assertPlusOrGold(ctx.userId);
  const data = z
    .object({
      count: z.coerce.number().int().min(5).max(60).default(40),
      minRating: z.coerce.number().int().min(400).max(3000).default(700),
      maxRating: z.coerce.number().int().min(400).max(3000).default(1800),
    })
    .parse(input ?? {});
  const s = await admin();
  const { data: rows, error } = await s
    .from("puzzles")
    .select("id, fen, solution, themes, rating")
    .eq("approved", true)
    .gte("rating", data.minRating)
    .lte("rating", data.maxRating)
    .limit(data.count * 3);
  if (error) throw error;
  const list = rows ?? [];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  const trimmed = list.slice(0, data.count).sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));
  return { puzzles: trimmed, durationSec: STORM_DURATION_SEC };
}

/** Plus/Gold — persist a finished run, update the Redis leaderboards. */
export async function submitStormRun(ctx: AppContext, input: unknown) {
  await assertPlusOrGold(ctx.userId);
  const data = z
    .object({
      score: z.number().int().min(0).max(500),
      solved: z.number().int().min(0).max(500),
      mistakes: z.number().int().min(0).max(50),
      durationSec: z.number().int().min(10).max(600).default(STORM_DURATION_SEC),
    })
    .parse(input);
  const { error } = await ctx.supabase.from("puzzle_storm_scores").insert({
    user_id: ctx.userId,
    score: data.score,
    solved: data.solved,
    mistakes: data.mistakes,
    duration_sec: data.durationSec,
    mode: "3min",
  });
  if (error) throw error;

  let dailyRank: number | null = null;
  let allTimeRank: number | null = null;
  try {
    const { redis } = await import("@/lib/redis.server");
    const today = new Date().toISOString().slice(0, 10);
    const dailyKey = `storm:lb:daily:${today}`;
    const allKey = `storm:lb:alltime`;
    const [curDaily, curAll] = await Promise.all([
      redis.zscore(dailyKey, ctx.userId),
      redis.zscore(allKey, ctx.userId),
    ]);
    if (curDaily == null || data.score > Number(curDaily)) {
      await redis.zadd(dailyKey, { score: data.score, member: ctx.userId });
      await redis.expire(dailyKey, 60 * 60 * 48);
    }
    if (curAll == null || data.score > Number(curAll)) {
      await redis.zadd(allKey, { score: data.score, member: ctx.userId });
    }
    const [dRank, aRank] = await Promise.all([
      redis.zrevrank(dailyKey, ctx.userId),
      redis.zrevrank(allKey, ctx.userId),
    ]);
    dailyRank = dRank == null ? null : Number(dRank) + 1;
    allTimeRank = aRank == null ? null : Number(aRank) + 1;
  } catch (e) {
    console.warn("storm leaderboard skipped:", e);
  }

  const s = await admin();
  const { data: best } = await s
    .from("puzzle_storm_scores")
    .select("score")
    .eq("user_id", ctx.userId)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    score: data.score,
    rank: { daily: dailyRank, allTime: allTimeRank },
    personalBest: best?.score ?? data.score,
  };
}

/** Top N scores (daily resets at UTC midnight, or all-time), username-hydrated. */
export async function getStormLeaderboard(_ctx: AppContext, input: unknown) {
  const data = z
    .object({
      scope: z.enum(["daily", "alltime"]).default("daily"),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    .parse(input ?? {});
  let pairs: Array<{ user_id: string; score: number }> = [];
  try {
    const { redis } = await import("@/lib/redis.server");
    const today = new Date().toISOString().slice(0, 10);
    const key = data.scope === "daily" ? `storm:lb:daily:${today}` : `storm:lb:alltime`;
    const raw = (await redis.zrange(key, 0, data.limit - 1, { rev: true, withScores: true })) as (
      | string
      | number
    )[];
    for (let i = 0; i < raw.length; i += 2)
      pairs.push({ user_id: String(raw[i]), score: Number(raw[i + 1]) });
  } catch (e) {
    console.warn("storm leaderboard read skipped, falling back to db:", e);
  }
  const s = await admin();
  if (pairs.length === 0) {
    const since =
      data.scope === "daily"
        ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        : new Date(0).toISOString();
    const { data: rows } = await s
      .from("puzzle_storm_scores")
      .select("user_id, score")
      .gte("played_at", since)
      .order("score", { ascending: false })
      .limit(data.limit * 4);
    const best = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!best.has(r.user_id) || (best.get(r.user_id) ?? 0) < r.score)
        best.set(r.user_id, r.score);
    }
    pairs = Array.from(best.entries())
      .map(([user_id, score]) => ({ user_id, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, data.limit);
  }
  if (pairs.length === 0) return { entries: [] };
  const ids = pairs.map((p) => p.user_id);
  const { data: profs } = await s.from("profiles").select("id, username").in("id", ids);
  const byId = new Map((profs ?? []).map((p) => [p.id, p.username]));
  return {
    entries: pairs.map((p) => ({
      userId: p.user_id,
      username: byId.get(p.user_id) ?? "player",
      score: p.score,
    })),
  };
}

/** This player's recent runs and personal best. */
export async function getMyStormStats(ctx: AppContext) {
  const s = await admin();
  const { data: rows } = await s
    .from("puzzle_storm_scores")
    .select("score, solved, mistakes, played_at")
    .eq("user_id", ctx.userId)
    .order("played_at", { ascending: false })
    .limit(20);
  const list = rows ?? [];
  const best = list.reduce((m, r) => Math.max(m, r.score), 0);
  return { best, runs: list.length, recent: list };
}
