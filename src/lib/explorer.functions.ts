import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Masters games come from Lichess's explorer, which needs a free personal API token
// (LICHESS_API_TOKEN). Without one only the Hamduk games source is offered.
const MASTERS_URL = "https://explorer.lichess.ovh/masters";
const MASTERS_TTL = 7 * 24 * 3600;
// Players below Gold see this many of the most played moves.
const PREVIEW_MOVES = 3;

export type ExplorerMove = {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating: number | null;
};
export type ExplorerResult = {
  source: "hamduk" | "masters";
  moves: ExplorerMove[];
  total: number;
  gold: boolean;
  mastersAvailable: boolean;
};

const key = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

async function masters(fen: string): Promise<ExplorerMove[]> {
  const token = process.env.LICHESS_API_TOKEN;
  if (!token) return [];
  const cacheKey = `explorer:masters:${key(fen)}`;
  const redis = await import("@/lib/redis.server").then((m) => m.redis).catch(() => null);
  const cached = redis ? await redis.get<ExplorerMove[]>(cacheKey).catch(() => null) : null;
  if (cached) return cached;

  const res = await fetch(`${MASTERS_URL}?fen=${encodeURIComponent(fen)}&moves=12&topGames=0`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("The masters database isn't responding. Try again shortly.");
  const body = (await res.json()) as { moves: ExplorerMove[] };
  const moves = body.moves.map((m) => ({
    uci: m.uci,
    san: m.san,
    white: m.white,
    draws: m.draws,
    black: m.black,
    averageRating: m.averageRating ?? null,
  }));
  if (redis) await redis.set(cacheKey, moves, { ex: MASTERS_TTL }).catch(() => null);
  return moves;
}

/** Moves played from a position, most popular first, with how each game ended. */
export const getExplorer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ fen: z.string().min(10).max(100), source: z.enum(["hamduk", "masters"]) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ExplorerResult> => {
    const { supabaseAdmin: s } = await import("@/integrations/supabase/client.server");
    const { data: me } = await s
      .from("profiles")
      .select("subscription_tier")
      .eq("id", context.userId)
      .maybeSingle();
    const gold = me?.subscription_tier === "gold";
    const mastersAvailable = !!process.env.LICHESS_API_TOKEN;

    let moves: ExplorerMove[];
    if (data.source === "masters") {
      if (!gold) return { source: "masters", moves: [], total: 0, gold, mastersAvailable };
      moves = await masters(data.fen);
    } else {
      const { data: rows, error } = await s
        .from("explorer_moves")
        .select("uci, san, white, draws, black, rating_sum")
        .eq("position", key(data.fen))
        .limit(200);
      if (error) throw error;
      moves = (rows ?? [])
        .map((r) => {
          const n = r.white + r.draws + r.black;
          return {
            uci: r.uci,
            san: r.san,
            white: r.white,
            draws: r.draws,
            black: r.black,
            averageRating: n ? Math.round(Number(r.rating_sum) / n) : null,
          };
        })
        .sort((a, b) => b.white + b.draws + b.black - (a.white + a.draws + a.black));
    }
    const total = moves.reduce((t, m) => t + m.white + m.draws + m.black, 0);
    return {
      source: data.source,
      moves: gold ? moves.slice(0, 12) : moves.slice(0, PREVIEW_MOVES),
      total,
      gold,
      mastersAvailable,
    };
  });
