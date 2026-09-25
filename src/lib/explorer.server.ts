import { Chess } from "chess.js";

const MAX_PLIES = 30;
const BATCH = 200;

/** The explorer key for a position: FEN without the halfmove and fullmove counters. */
export function positionKey(fen: string) {
  return fen.split(" ").slice(0, 4).join(" ");
}

/** Adds newly finished human games to the opening explorer. Called by the cron tick. */
export async function indexExplorerGames() {
  const { supabaseAdmin: s } = await import("@/integrations/supabase/client.server");
  const { data: games, error } = await s
    .from("games")
    .select("id, pgn, result, variant, is_bot_game, white_rating_before, black_rating_before")
    .eq("status", "completed")
    .eq("explorer_indexed", false)
    .order("ended_at")
    .limit(BATCH);
  if (error) throw error;
  if (!games?.length) return { indexed: 0 };

  const rows: Record<string, string | number>[] = [];
  for (const g of games) {
    // Bot games and Chess960 would skew the standard opening statistics.
    if (g.is_bot_game || g.variant !== "standard" || !g.pgn) continue;
    if (!["white", "black", "draw"].includes(g.result ?? "")) continue;
    const replay = new Chess();
    try {
      replay.loadPgn(g.pgn);
    } catch {
      continue;
    }
    const moves = replay.history({ verbose: true }).slice(0, MAX_PLIES);
    const rating = Math.round(
      ((g.white_rating_before ?? 1200) + (g.black_rating_before ?? 1200)) / 2,
    );
    const board = new Chess();
    for (const m of moves) {
      rows.push({
        position: positionKey(board.fen()),
        uci: m.from + m.to + (m.promotion ?? ""),
        san: m.san,
        w: g.result === "white" ? 1 : 0,
        d: g.result === "draw" ? 1 : 0,
        b: g.result === "black" ? 1 : 0,
        r: rating,
      });
      board.move(m);
    }
  }
  if (rows.length) {
    const { error: addErr } = await s.rpc("explorer_add", { p_rows: rows });
    if (addErr) throw addErr;
  }
  await s
    .from("games")
    .update({ explorer_indexed: true })
    .in(
      "id",
      games.map((g) => g.id),
    );
  return { indexed: games.length, positions: rows.length };
}
