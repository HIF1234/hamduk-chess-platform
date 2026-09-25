// Server functions used only by the mobile app API (/api/app/v1). Everything else the app
// needs reuses the website's own server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GAME_FIELDS =
  "id, white_id, black_id, status, result, end_reason, winner_id, fen, pgn, ply, time_control, variant, chess960_start_fen, rated, initial_sec, increment_sec, time_white_ms, time_black_ms, last_clock_update, draw_offer_by, takeback_offer_by, is_correspondence, move_deadline, created_at, ended_at";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function names(ids: string[]) {
  if (!ids.length)
    return new Map<string, { username: string; rating: number; country: string | null }>();
  const s = await admin();
  const { data } = await s
    .from("profiles")
    .select("id, username, rating, country")
    .in("id", [...new Set(ids)]);
  return new Map(
    (data ?? []).map((p) => [p.id, { username: p.username, rating: p.rating, country: p.country }]),
  );
}

/** My games: everything in progress plus the most recent finished ones. */
export const listMyGames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const s = await admin();
    const me = context.userId;
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
  });

/** One game with both players. Anyone signed in may view a game (like spectating on the site). */
export const getGameForApp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const s = await admin();
    const { data: g } = await s
      .from("games")
      .select(GAME_FIELDS)
      .eq("id", data.gameId)
      .maybeSingle();
    if (!g) throw new Error("Game not found");
    const who = await names([g.white_id, g.black_id]);
    return {
      ...g,
      white: who.get(g.white_id) ?? null,
      black: who.get(g.black_id) ?? null,
      serverTime: Date.now(),
    };
  });

/** Unseen puzzles near the player's rating, to solve offline. Plus/Gold get bigger packs. */
export const getPuzzlePack = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ count: z.coerce.number().int().min(1).max(500).default(100) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const s = await admin();
    const [{ data: me }, { data: stats }] = await Promise.all([
      s
        .from("profiles")
        .select("subscription_tier, is_guest")
        .eq("id", context.userId)
        .maybeSingle(),
      s.from("user_puzzle_stats").select("rating").eq("user_id", context.userId).maybeSingle(),
    ]);
    // Free players can only score 20 a day anyway, so a small pack is enough.
    const cap = me?.subscription_tier && me.subscription_tier !== "free" ? 500 : 30;
    const rating = stats?.rating ?? 1200;
    const { data: puzzles, error } = await s.rpc("puzzle_pack", {
      p_user: context.userId,
      p_min: Math.max(400, rating - 250),
      p_max: rating + 350,
      p_limit: Math.min(data.count, cap),
    });
    if (error) throw error;
    return { rating, puzzles: puzzles ?? [], maxPack: cap };
  });

/** Uploads puzzle attempts made offline, oldest first. Stops at the free daily limit. */
export const syncPuzzleAttempts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        attempts: z
          .array(z.object({ puzzleId: z.string().uuid(), success: z.boolean() }))
          .min(1)
          .max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const results: {
      puzzleId: string;
      status: "recorded" | "limit" | "error";
      rating?: number;
      delta?: number;
    }[] = [];
    let limited = false;
    for (const a of data.attempts) {
      if (limited) {
        results.push({ puzzleId: a.puzzleId, status: "limit" });
        continue;
      }
      const { data: res, error } = await supabase.rpc("submit_puzzle_attempt", {
        p_puzzle_id: a.puzzleId,
        p_success: a.success,
      });
      if (error) {
        limited = error.message.includes("daily_puzzle_limit");
        results.push({ puzzleId: a.puzzleId, status: limited ? "limit" : "error" });
      } else {
        const r = res as { rating: number; delta: number };
        results.push({
          puzzleId: a.puzzleId,
          status: "recorded",
          rating: r.rating,
          delta: r.delta,
        });
      }
    }
    if (results.some((r) => r.status === "recorded")) {
      const { checkAchievements } = await import("@/lib/achievements.server");
      await checkAchievements(context.userId, ["puzzles"]);
    }
    return { results };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("notifications")
      .select("id, type, title, body, link, read, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw error;
    return { notifications: rows ?? [], unread: (rows ?? []).filter((r) => !r.read).length };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ ids: z.array(z.string().uuid()).max(200).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("notifications").update({ read: true }).eq("read", false);
    if (data.ids?.length) q = q.in("id", data.ids);
    const { error } = await q;
    if (error) throw error;
    return { ok: true };
  });
