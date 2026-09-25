import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Chess } from "chess.js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_GAMES = 300;
const TREE_PLIES = 12;
// A weak spot needs a few games before it means anything.
const MIN_GAMES_FOR_SPOT = 3;
const WEAK_SCORE = 0.45;
const STRONG_SCORE = 0.6;

export type PrepMove = { san: string; uci: string; games: number; score: number };
export type PrepOpening = {
  eco: string;
  name: string;
  games: number;
  score: number;
  line: string[];
};
export type PrepSide = {
  games: number;
  score: number;
  /** position (FEN without counters) -> moves played there, most common first */
  tree: Record<string, PrepMove[]>;
  openings: PrepOpening[];
  weak: PrepOpening[];
  strong: PrepOpening[];
};
export type Prep = {
  username: string;
  rating: number;
  gold: boolean;
  recent: { wins: number; losses: number; draws: number };
  white: PrepSide;
  black: PrepSide;
};

const key = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

type Acc = {
  games: number;
  points: number;
  tree: Map<string, Map<string, PrepMove & { points: number }>>;
  names: Map<string, { eco: string; name: string; games: number; points: number; line: string[] }>;
};
const emptyAcc = (): Acc => ({ games: 0, points: 0, tree: new Map(), names: new Map() });

function finish(acc: Acc): PrepSide {
  const openings = [...acc.names.values()]
    .map((o) => ({
      eco: o.eco,
      name: o.name,
      games: o.games,
      score: o.points / o.games,
      line: o.line,
    }))
    .sort((a, b) => b.games - a.games);
  const tree: Record<string, PrepMove[]> = {};
  for (const [pos, moves] of acc.tree) {
    tree[pos] = [...moves.values()]
      .map((m) => ({ san: m.san, uci: m.uci, games: m.games, score: m.points / m.games }))
      .sort((a, b) => b.games - a.games);
  }
  const counted = openings.filter((o) => o.games >= MIN_GAMES_FOR_SPOT);
  return {
    games: acc.games,
    score: acc.games ? acc.points / acc.games : 0,
    tree,
    openings: openings.slice(0, 10),
    weak: counted
      .filter((o) => o.score <= WEAK_SCORE)
      .sort((a, b) => a.score - b.score)
      .slice(0, 5),
    strong: counted
      .filter((o) => o.score >= STRONG_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
  };
}

/** Builds both colours' repertoires from a player's games, newest first. */
export function analyseGames(
  games: { white_id: string; pgn: string | null; result: string | null }[],
  targetId: string,
  names: Record<string, [string, string]>,
) {
  const acc = { white: emptyAcc(), black: emptyAcc() };
  const recent = { wins: 0, losses: 0, draws: 0 };
  for (const [i, g] of games.entries()) {
    if (!["white", "black", "draw"].includes(g.result ?? "")) continue;
    const color = g.white_id === targetId ? "white" : "black";
    const points = g.result === "draw" ? 0.5 : g.result === color ? 1 : 0;
    if (i < 20) {
      if (points === 1) recent.wins++;
      else if (points === 0) recent.losses++;
      else recent.draws++;
    }
    let moves;
    try {
      const replay = new Chess();
      replay.loadPgn(g.pgn!);
      moves = replay.history({ verbose: true });
    } catch {
      continue;
    }
    const a = acc[color];
    a.games++;
    a.points += points;
    const board = new Chess();
    const line: string[] = [];
    let named: { eco: string; name: string; line: string[] } | null = null;
    for (const [ply, m] of moves.entries()) {
      const pos = key(board.fen());
      if (ply < TREE_PLIES) {
        const at = a.tree.get(pos) ?? new Map();
        const uci = m.from + m.to + (m.promotion ?? "");
        const cur = at.get(uci) ?? { san: m.san, uci, games: 0, score: 0, points: 0 };
        cur.games++;
        cur.points += points;
        at.set(uci, cur);
        a.tree.set(pos, at);
      }
      board.move(m);
      line.push(m.san);
      const hit = names[key(board.fen())];
      // Group by family ("Sicilian Defense", not each sub-variation) so a few games add up.
      if (hit) named = { eco: hit[0].slice(0, 1), name: hit[1].split(":")[0], line: [...line] };
      if (ply > 30) break;
    }
    if (named) {
      const o = a.names.get(named.name) ?? { ...named, games: 0, points: 0 };
      o.games++;
      o.points += points;
      a.names.set(named.name, o);
    }
  }

  return { white: finish(acc.white), black: finish(acc.black), recent };
}

/** How a player handles the opening, from their recent games. Full detail is Gold. */
export const getOpeningPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ username: z.string().trim().min(2).max(40) }).parse(d))
  .handler(async ({ data, context }): Promise<Prep> => {
    const { supabaseAdmin: s } = await import("@/integrations/supabase/client.server");
    const { OPENING_NAMES } = await import("@/lib/opening-names.data");
    const [{ data: me }, { data: target }] = await Promise.all([
      s
        .from("profiles")
        .select("subscription_tier, is_guest")
        .eq("id", context.userId)
        .maybeSingle(),
      s
        .from("profiles")
        .select("id, username, rating, is_guest")
        .ilike("username", data.username.replace(/[\\%_]/g, "\\$&"))
        .maybeSingle(),
    ]);
    if (!me || me.is_guest) throw new Error("Create a free account to use opening prep.");
    if (!target || target.is_guest) throw new Error("No player with that username.");
    const gold = me.subscription_tier === "gold";

    const { data: games, error } = await s
      .from("games")
      .select("white_id, pgn, result")
      .or(`white_id.eq.${target.id},black_id.eq.${target.id}`)
      .eq("status", "completed")
      .eq("variant", "standard")
      .eq("is_bot_game", false)
      .not("pgn", "is", null)
      .order("ended_at", { ascending: false })
      .limit(MAX_GAMES);
    if (error) throw error;

    const { white, black, recent } = analyseGames(games ?? [], target.id, OPENING_NAMES);
    // Below Gold: the headline numbers and top openings, not the tree or the weak spots.
    const trim = (p: PrepSide): PrepSide =>
      gold ? p : { ...p, tree: {}, openings: p.openings.slice(0, 2), weak: [], strong: [] };
    return {
      username: target.username,
      rating: target.rating,
      gold,
      recent,
      white: trim(white),
      black: trim(black),
    };
  });
