import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Lichess serves Syzygy (≤7 pieces) for free. Results are cached for 24h (spec).
const TB_URL = "https://tablebase.lichess.ovh/standard";
const CACHE_TTL = 24 * 3600;

type Category =
  | "win"
  | "loss"
  | "draw"
  | "cursed-win"
  | "blessed-loss"
  | "maybe-win"
  | "maybe-loss"
  | "unknown";
export type TablebaseResult = {
  category: Category;
  dtm: number | null;
  dtz: number | null;
  checkmate: boolean;
  stalemate: boolean;
  moves: { san: string; uci: string; category: Category; dtm: number | null; dtz: number | null }[];
};

// A move's category is reported for the side to move *after* it; flip it back to the mover.
const FLIP: Record<string, Category> = {
  win: "loss",
  loss: "win",
  "cursed-win": "blessed-loss",
  "blessed-loss": "cursed-win",
  "maybe-win": "maybe-loss",
  "maybe-loss": "maybe-win",
  draw: "draw",
  unknown: "unknown",
};

function pieceCount(fen: string) {
  return fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length;
}

export const lookupTablebase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ fen: z.string().min(10).max(100) }).parse(d))
  .handler(async ({ data, context }): Promise<{ result?: TablebaseResult; error?: string }> => {
    if (pieceCount(data.fen) > 7)
      return { error: "Tablebases cover positions with 7 pieces or fewer." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("subscription_tier")
      .eq("id", context.userId)
      .maybeSingle();
    if (profile?.subscription_tier !== "gold") return { error: "gold" };

    const key = `tb:${data.fen.split(" ").slice(0, 4).join(" ")}`;
    const redis = await import("@/lib/redis.server").then((m) => m.redis).catch(() => null);
    try {
      const cached = redis ? await redis.get<TablebaseResult>(key) : null;
      if (cached) return { result: cached };
    } catch {
      /* cache is optional */
    }

    const res = await fetch(`${TB_URL}?fen=${encodeURIComponent(data.fen)}`, {
      headers: { "User-Agent": "HamdukChess/1.0 (play.chess.hamduk.com.ng)" },
    });
    if (res.status === 429) return { error: "The tablebase is busy — try again in a minute." };
    if (!res.ok) return { error: "Tablebase lookup failed." };
    const raw = (await res.json()) as {
      category: Category;
      dtm: number | null;
      dtz: number | null;
      checkmate: boolean;
      stalemate: boolean;
      moves: {
        san: string;
        uci: string;
        category: Category;
        dtm: number | null;
        dtz: number | null;
      }[];
    };
    const result: TablebaseResult = {
      category: raw.category,
      dtm: raw.dtm,
      dtz: raw.dtz,
      checkmate: raw.checkmate,
      stalemate: raw.stalemate,
      moves: raw.moves.slice(0, 8).map((m) => ({
        san: m.san,
        uci: m.uci,
        category: FLIP[m.category] ?? "unknown",
        dtm: m.dtm === null ? null : -m.dtm,
        dtz: m.dtz === null ? null : -m.dtz,
      })),
    };
    try {
      if (redis) await redis.set(key, result, { ex: CACHE_TTL });
    } catch {
      /* cache is optional */
    }
    return { result };
  });
