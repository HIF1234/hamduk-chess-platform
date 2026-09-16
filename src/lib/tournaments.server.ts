// Server-only tournament engine: pairings, standings, tie-breaks, round advance.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chess960StartFen } from "./chess960";

export const STANDARD_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type TournamentType = "swiss" | "arena" | "round_robin" | "knockout";

export type TournamentRow = {
  id: string;
  name: string;
  type: TournamentType;
  time_control: string;
  variant: string;
  rated: boolean;
  rounds: number;
  current_round: number;
  starts_at: string;
  duration_min: number;
  max_players: number;
  status: string;
  club_id: string | null;
};

export type PlayerRow = {
  id: string;
  user_id: string;
  seed: number;
  rating_at_join: number;
  score: number;
  buchholz: number;
  games_played: number;
  status: string;
};

export type Pairing = {
  white_id: string | null;
  black_id: string | null;
  game_id: string | null;
  bye_user_id?: string;
};

export const TIER_MAX_PLAYERS = { free: 0, plus: 64, gold: 256 } as const;

function clocksFor(timeControl: string) {
  const initial = Number(timeControl.split("+")[0] ?? 5) * 60;
  const increment = Number(timeControl.split("+")[1] ?? 0);
  return { initial, increment };
}

async function fetchTournament(id: string) {
  const { data } = await supabaseAdmin
    .from("tournaments")
    .select(
      "id, name, type, time_control, variant, rated, rounds, current_round, starts_at, duration_min, max_players, status, club_id",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as TournamentRow | null) ?? null;
}

async function activePlayers(tournamentId: string) {
  const { data } = await supabaseAdmin
    .from("tournament_players")
    .select("id, user_id, seed, rating_at_join, score, buchholz, games_played, status")
    .eq("tournament_id", tournamentId)
    .eq("status", "active")
    .order("score", { ascending: false })
    .order("rating_at_join", { ascending: false });
  return (data ?? []) as PlayerRow[];
}

/** Every opponent each player has already faced in this tournament. */
async function previousOpponents(tournamentId: string) {
  const { data } = await supabaseAdmin
    .from("tournament_games")
    .select("white_id, black_id")
    .eq("tournament_id", tournamentId);
  const map = new Map<string, Set<string>>();
  for (const g of data ?? []) {
    if (!g.white_id || !g.black_id) continue;
    if (!map.has(g.white_id)) map.set(g.white_id, new Set());
    if (!map.has(g.black_id)) map.set(g.black_id, new Set());
    map.get(g.white_id)!.add(g.black_id);
    map.get(g.black_id)!.add(g.white_id);
  }
  return map;
}

/** Users currently in an unfinished tournament game (used by arena pairing). */
async function busyUsers(tournamentId: string) {
  const { data } = await supabaseAdmin
    .from("tournament_games")
    .select("white_id, black_id, recorded")
    .eq("tournament_id", tournamentId)
    .eq("recorded", false);
  const busy = new Set<string>();
  for (const g of data ?? []) {
    if (g.white_id) busy.add(g.white_id);
    if (g.black_id) busy.add(g.black_id);
  }
  return busy;
}

function pairSwiss(players: PlayerRow[], seen: Map<string, Set<string>>) {
  const pool = [...players];
  const pairs: Array<[PlayerRow, PlayerRow]> = [];
  let bye: PlayerRow | undefined;
  if (pool.length % 2 === 1) bye = pool.pop();
  while (pool.length > 1) {
    const a = pool.shift()!;
    let idx = pool.findIndex((p) => !seen.get(a.user_id)?.has(p.user_id));
    if (idx === -1) idx = 0;
    const b = pool.splice(idx, 1)[0]!;
    pairs.push([a, b]);
  }
  if (pool.length === 1 && !bye) bye = pool.pop();
  return { pairs, bye };
}

/** Circle method: round r of an all-play-all schedule. */
function pairRoundRobin(players: PlayerRow[], round: number) {
  const list = [...players].sort((a, b) => b.rating_at_join - a.rating_at_join);
  const n = list.length + (list.length % 2);
  const slots: Array<PlayerRow | null> = [...list];
  while (slots.length < n) slots.push(null);
  const rotated = [slots[0]!, ...slots.slice(1).map((_, i) => slots[1 + ((i + (round - 1)) % (n - 1))]!)];
  const pairs: Array<[PlayerRow, PlayerRow]> = [];
  let bye: PlayerRow | undefined;
  for (let i = 0; i < n / 2; i++) {
    const a = rotated[i];
    const b = rotated[n - 1 - i];
    if (a && b) pairs.push(round % 2 === 0 ? [b, a] : [a, b]);
    else if (a || b) bye = (a ?? b)!;
  }
  return { pairs, bye };
}

function pairKnockout(players: PlayerRow[], round: number) {
  if (round === 1) {
    const seeded = [...players].sort((a, b) => b.rating_at_join - a.rating_at_join);
    const pairs: Array<[PlayerRow, PlayerRow]> = [];
    let bye: PlayerRow | undefined;
    while (seeded.length > 1) {
      const top = seeded.shift()!;
      const bottom = seeded.pop()!;
      pairs.push([top, bottom]);
    }
    if (seeded.length === 1) bye = seeded[0];
    return { pairs, bye };
  }
  // Survivors in bracket order.
  const survivors = [...players];
  const pairs: Array<[PlayerRow, PlayerRow]> = [];
  let bye: PlayerRow | undefined;
  while (survivors.length > 1) pairs.push([survivors.shift()!, survivors.shift()!]);
  if (survivors.length === 1) bye = survivors[0];
  return { pairs, bye };
}

async function createGame(t: TournamentRow, whiteId: string, blackId: string) {
  const { initial, increment } = clocksFor(t.time_control);
  const startFen = t.variant === "chess960" ? chess960StartFen() : STANDARD_FEN;
  const { data, error } = await supabaseAdmin
    .from("games")
    .insert({
      white_id: whiteId,
      black_id: blackId,
      time_control: t.time_control,
      variant: t.variant,
      rated: t.rated,
      chess960_start_fen: t.variant === "chess960" ? startFen : null,
      fen: startFen,
      initial_sec: initial,
      increment_sec: increment,
      time_white_ms: initial * 1000,
      time_black_ms: initial * 1000,
      last_clock_update: new Date().toISOString(),
      is_public: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/**
 * Generate the pairings for `round` and create the games.
 * Idempotent: does nothing if the round already exists.
 */
export async function generateRound(tournamentId: string, round: number) {
  const t = await fetchTournament(tournamentId);
  if (!t) throw new Error("Tournament not found");

  const { data: existing } = await supabaseAdmin
    .from("tournament_rounds")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("round", round)
    .maybeSingle();
  if (existing) return { created: 0, round };

  const players = await activePlayers(tournamentId);
  if (players.length < 2) return { created: 0, round };

  let pairs: Array<[PlayerRow, PlayerRow]> = [];
  let bye: PlayerRow | undefined;

  if (t.type === "round_robin") ({ pairs, bye } = pairRoundRobin(players, round));
  else if (t.type === "knockout") ({ pairs, bye } = pairKnockout(players, round));
  else ({ pairs, bye } = pairSwiss(players, await previousOpponents(tournamentId)));

  const pairings: Pairing[] = [];
  for (const [a, b] of pairs) {
    const gameId = await createGame(t, a.user_id, b.user_id);
    await supabaseAdmin.from("tournament_games").insert({
      tournament_id: tournamentId,
      round,
      game_id: gameId,
      white_id: a.user_id,
      black_id: b.user_id,
    });
    pairings.push({ white_id: a.user_id, black_id: b.user_id, game_id: gameId });
  }
  if (bye) {
    pairings.push({ white_id: bye.user_id, black_id: null, game_id: null, bye_user_id: bye.user_id });
    await supabaseAdmin
      .from("tournament_players")
      .update({ score: Number(bye.score) + 1 })
      .eq("id", bye.id);
  }

  await supabaseAdmin.from("tournament_rounds").insert({
    tournament_id: tournamentId,
    round,
    pairings,
    status: pairings.some((p) => p.game_id) ? "live" : "completed",
  });
  await supabaseAdmin
    .from("tournaments")
    .update({ current_round: round, status: "live" })
    .eq("id", tournamentId);

  return { created: pairs.length, round };
}

/** Arena: keep idle players paired for the duration of the event. */
export async function pairArena(tournamentId: string) {
  const t = await fetchTournament(tournamentId);
  if (!t || t.type !== "arena" || t.status === "completed") return { created: 0 };

  const endsAt = new Date(t.starts_at).getTime() + t.duration_min * 60 * 1000;
  if (Date.now() >= endsAt) {
    await supabaseAdmin.from("tournaments").update({ status: "completed" }).eq("id", tournamentId);
    return { created: 0 };
  }

  const busy = await busyUsers(tournamentId);
  const idle = (await activePlayers(tournamentId)).filter((p) => !busy.has(p.user_id));
  const seen = await previousOpponents(tournamentId);
  const { pairs } = pairSwiss(idle.length % 2 === 1 ? idle.slice(0, -1) : idle, seen);

  const round = t.current_round + 1;
  const pairings: Pairing[] = [];
  for (const [a, b] of pairs) {
    const gameId = await createGame(t, a.user_id, b.user_id);
    await supabaseAdmin.from("tournament_games").insert({
      tournament_id: tournamentId,
      round,
      game_id: gameId,
      white_id: a.user_id,
      black_id: b.user_id,
    });
    pairings.push({ white_id: a.user_id, black_id: b.user_id, game_id: gameId });
  }
  if (pairings.length) {
    await supabaseAdmin
      .from("tournament_rounds")
      .upsert({ tournament_id: tournamentId, round, pairings, status: "live" }, { onConflict: "tournament_id,round" });
    await supabaseAdmin
      .from("tournaments")
      .update({ current_round: round, status: "live" })
      .eq("id", tournamentId);
  }
  return { created: pairings.length };
}

/** Recompute tie-breaks (Buchholz for Swiss, head-to-head implicit elsewhere). */
export async function recomputeTiebreaks(tournamentId: string) {
  const { data: players } = await supabaseAdmin
    .from("tournament_players")
    .select("id, user_id, score")
    .eq("tournament_id", tournamentId);
  if (!players?.length) return;
  const scoreByUser = new Map(players.map((p) => [p.user_id, Number(p.score)]));
  const opponents = await previousOpponents(tournamentId);
  for (const p of players) {
    let sum = 0;
    for (const opp of opponents.get(p.user_id) ?? []) sum += scoreByUser.get(opp) ?? 0;
    await supabaseAdmin.from("tournament_players").update({ buchholz: sum }).eq("id", p.id);
  }
}

/**
 * Record a finished game against its tournament (if any), update scores,
 * and advance the round / close the event when appropriate.
 * Never throws — safe to fire from game-finish paths.
 */
export async function recordTournamentResult(gameId: string) {
  try {
    const { data: tg } = await supabaseAdmin
      .from("tournament_games")
      .select("id, tournament_id, round, white_id, black_id, recorded")
      .eq("game_id", gameId)
      .maybeSingle();
    if (!tg || tg.recorded) return;

    const { data: game } = await supabaseAdmin
      .from("games")
      .select("id, status, result")
      .eq("id", gameId)
      .maybeSingle();
    if (!game || game.status !== "completed" || !game.result) return;

    await supabaseAdmin
      .from("tournament_games")
      .update({ result: game.result, recorded: true })
      .eq("id", tg.id);

    const { data: entries } = await supabaseAdmin
      .from("tournament_players")
      .select("id, user_id, score, games_played, status")
      .eq("tournament_id", tg.tournament_id)
      .in("user_id", [tg.white_id, tg.black_id].filter(Boolean) as string[]);

    for (const e of entries ?? []) {
      const isWhite = e.user_id === tg.white_id;
      const points =
        game.result === "draw" ? 0.5 : (game.result === "white") === isWhite ? 1 : 0;
      await supabaseAdmin
        .from("tournament_players")
        .update({ score: Number(e.score) + points, games_played: e.games_played + 1 })
        .eq("id", e.id);
    }

    const t = await fetchTournament(tg.tournament_id);
    if (!t) return;

    // Knockout: losers are eliminated.
    if (t.type === "knockout" && game.result !== "draw") {
      const loser = game.result === "white" ? tg.black_id : tg.white_id;
      if (loser) {
        await supabaseAdmin
          .from("tournament_players")
          .update({ status: "eliminated" })
          .eq("tournament_id", tg.tournament_id)
          .eq("user_id", loser);
      }
    }

    await recomputeTiebreaks(tg.tournament_id);

    if (t.type === "arena") {
      await pairArena(tg.tournament_id);
      return;
    }

    // Round complete?
    const { data: roundGames } = await supabaseAdmin
      .from("tournament_games")
      .select("id, recorded")
      .eq("tournament_id", tg.tournament_id)
      .eq("round", tg.round);
    const allDone = (roundGames ?? []).every((g) => g.recorded);
    if (!allDone) return;

    await supabaseAdmin
      .from("tournament_rounds")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("tournament_id", tg.tournament_id)
      .eq("round", tg.round);

    const remaining = (await activePlayers(tg.tournament_id)).length;
    const finished =
      tg.round >= t.rounds || (t.type === "knockout" && remaining <= 1) || remaining < 2;
    if (finished) {
      await supabaseAdmin
        .from("tournaments")
        .update({ status: "completed" })
        .eq("id", tg.tournament_id);
      return;
    }
    await generateRound(tg.tournament_id, tg.round + 1);
  } catch (err) {
    console.error("[tournaments] recordTournamentResult failed", (err as Error).message);
  }
}

/** Start scheduled tournaments whose time has come, and keep arenas paired. */
export async function sweepTournaments() {
  const nowIso = new Date().toISOString();
  const { data: due } = await supabaseAdmin
    .from("tournaments")
    .select("id, type, rounds, current_round, starts_at, duration_min, status")
    .in("status", ["scheduled", "live"])
    .lte("starts_at", nowIso)
    .limit(100);

  let started = 0;
  let paired = 0;
  for (const t of due ?? []) {
    if (t.type === "arena") {
      const r = await pairArena(t.id);
      paired += r.created;
      continue;
    }
    if (t.status === "scheduled" || t.current_round === 0) {
      const r = await generateRound(t.id, 1);
      if (r.created) started += 1;
    }
  }
  return { started, paired };
}
