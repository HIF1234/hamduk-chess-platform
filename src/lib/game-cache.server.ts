// Live-game read cache: lets submitMove's pre-move read skip a Postgres round trip on a cache
// hit. This is purely a latency optimization and never a source of truth on its own -- a miss
// (or a Redis hiccup) always falls back to Postgres. Scoped to live (non-correspondence) games
// only: correspondence games are slow-cadence, so caching them buys nothing and only adds a
// staleness window for no reason.
//
// Correctness depends on every OTHER write to a game's fen/ply/status/offers (resign, abort,
// draw, takeback, disconnect-forfeit, admin override, ...) calling invalidateGameCache. Missing
// a call site is a fairness bug, not just a UI glitch -- a stale cached "active" game would let
// a move through against a game that's actually already over. When in doubt, invalidate.
import { redis } from "./redis.server";

const TTL_SECONDS = 1800;

export type CachedGameState = {
  id: string;
  white_id: string;
  black_id: string;
  fen: string;
  pgn: string;
  ply: number;
  status: string;
  result: string | null;
  time_white_ms: number | null;
  time_black_ms: number | null;
  increment_sec: number | null;
  last_clock_update: string | null;
  initial_sec: number | null;
  chess960_start_fen: string | null;
  variant: string;
  is_correspondence: boolean;
  days_per_move: number | null;
  notify_by_email: boolean;
};

function key(gameId: string) {
  return `game:${gameId}:state`;
}

export async function getCachedGameState(gameId: string): Promise<CachedGameState | null> {
  try {
    return await redis.get<CachedGameState>(key(gameId));
  } catch {
    return null;
  }
}

export async function setCachedGameState(state: CachedGameState): Promise<void> {
  if (state.is_correspondence) return; // not cached -- see module note above
  try {
    await redis.set(key(state.id), state, { ex: TTL_SECONDS });
  } catch {
    /* best-effort: the next read just falls back to Postgres */
  }
}

export async function invalidateGameCache(gameId: string): Promise<void> {
  try {
    await redis.del(key(gameId));
  } catch {
    /* best-effort -- the TTL above is the backstop if this somehow never fires */
  }
}
