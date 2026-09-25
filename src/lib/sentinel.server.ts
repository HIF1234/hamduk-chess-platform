// Sentinel fair-play integration: completed human games go to Sentinel for statistical
// analysis, once per player. Results come back by signed webhook (or polling) and elevated
// ones flag the game for staff review. Nothing is punished automatically.
//
// Off unless SENTINEL_URL and SENTINEL_API_KEY are set. SENTINEL_WEBHOOK_SECRET verifies
// incoming results.
import { createHmac, timingSafeEqual } from "node:crypto";
import { Chess } from "chess.js";

const SITE = "https://play.chess.hamduk.com.ng";
const WEBHOOK_PATH = "/api/sentinel/webhook";
// Sentinel allows 60 requests a minute per key; stay well under it each tick.
const GAMES_PER_TICK = 10;
const POLLS_PER_TICK = 10;
// Very short games say nothing statistically and cost Sentinel engine time.
const MIN_PLIES = Number(process.env.SENTINEL_MIN_PLIES ?? 20);
const FLAG_LEVELS = new Set(["ELEVATED", "HIGH_STATISTICAL_ANOMALY"]);
// Sentinel advises against flagging single MODERATE games; a pattern across games counts.
const PATTERN_LEVELS = ["MODERATE", "ELEVATED", "HIGH_STATISTICAL_ANOMALY"];
const PATTERN_WINDOW = 10;
const PATTERN_HITS = 3;

/** Sentinel can't yet delete or expire player data, so only staff and listed test accounts
 *  are sent until SENTINEL_ALL_PLAYERS=true. */
async function allowedPlayers(s: Db, ids: string[]) {
  if (process.env.SENTINEL_ALL_PLAYERS === "true") return true;
  const testNames = (process.env.SENTINEL_TEST_USERNAMES ?? "")
    .split(",")
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);
  const [{ data: staff }, { data: people }] = await Promise.all([
    s.from("admin_roles").select("user_id").in("user_id", ids),
    s.from("profiles").select("id, username").in("id", ids),
  ]);
  const ok = new Set((staff ?? []).map((r) => r.user_id));
  for (const p of people ?? []) if (testNames.includes(p.username.toLowerCase())) ok.add(p.id);
  return ids.every((id) => ok.has(id));
}

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

function config() {
  const url = process.env.SENTINEL_URL?.replace(/\/+$/, "");
  const key = process.env.SENTINEL_API_KEY;
  return url && key ? { url, key } : null;
}

async function call(path: string, init: RequestInit = {}) {
  const c = config()!;
  return fetch(`${c.url}${path}`, {
    ...init,
    headers: { "x-api-key": c.key, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
}

/** Registers our webhook address once per Sentinel URL (remembered in Redis). */
async function ensureWebhookRegistered() {
  const c = config()!;
  const flag = `sentinel:webhook:${createHmac("sha256", "k").update(c.url).digest("hex").slice(0, 16)}`;
  const redis = await import("@/lib/redis.server").then((m) => m.redis).catch(() => null);
  if (redis && (await redis.get(flag).catch(() => null))) return;
  const res = await call("/v1/partner/webhook/register", {
    method: "POST",
    body: JSON.stringify({ webhook_url: `${SITE}${WEBHOOK_PATH}` }),
  });
  if (!res.ok) throw new Error(`webhook register failed: ${res.status}`);
  if (redis) await redis.set(flag, "1", { ex: 7 * 86400 }).catch(() => null);
}

const clk = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const RESULT_TAG: Record<string, string> = { white: "1-0", black: "0-1", draw: "1/2-1/2" };

/** A full PGN with headers and, where move timings exist, %clk comments. */
export function buildPgn(input: {
  game: {
    id: string;
    result: string | null;
    end_reason: string | null;
    time_control: string;
    initial_sec: number | null;
    increment_sec: number | null;
    is_correspondence: boolean | null;
    created_at: string;
    variant: string;
    chess960_start_fen: string | null;
    pgn: string | null;
  };
  white: { username: string; elo: number | null };
  black: { username: string; elo: number | null };
  moves: { ply: number; uci: string }[];
  elapsed: Map<number, number>; // ply -> think time in ms
}) {
  const { game } = input;
  const start =
    game.variant === "chess960" && game.chess960_start_fen ? game.chess960_start_fen : undefined;
  const c = start ? new Chess(start) : new Chess();
  if (start) {
    c.setHeader("Variant", "Chess960");
    c.setHeader("SetUp", "1");
    c.setHeader("FEN", start);
  }
  const headers: Record<string, string> = {
    Event: "Hamduk Chess game",
    Site: `${SITE}/play/${game.id}`,
    Date: game.created_at.slice(0, 10).replace(/-/g, "."),
    White: input.white.username,
    Black: input.black.username,
    Result: RESULT_TAG[game.result ?? ""] ?? "*",
    TimeControl: game.is_correspondence
      ? "-"
      : `${game.initial_sec ?? 0}+${game.increment_sec ?? 0}`,
    Termination: game.end_reason ?? "Normal",
  };
  if (input.white.elo) headers.WhiteElo = String(input.white.elo);
  if (input.black.elo) headers.BlackElo = String(input.black.elo);
  for (const [k, v] of Object.entries(headers)) c.setHeader(k, v);

  // Clocks only when every move has a timing and the game had a clock.
  const withClock =
    !game.is_correspondence &&
    !!game.initial_sec &&
    input.moves.every((m) => input.elapsed.has(m.ply));
  const remaining = { w: (game.initial_sec ?? 0) * 1000, b: (game.initial_sec ?? 0) * 1000 };
  const moves = input.moves.length
    ? input.moves
    : // Fall back to the stored PGN if the move rows are missing.
      (() => {
        const r = new Chess(start);
        r.loadPgn(game.pgn ?? "");
        return r
          .history({ verbose: true })
          .map((m, i) => ({ ply: i + 1, uci: m.from + m.to + (m.promotion ?? "") }));
      })();
  for (const m of moves) {
    const side = c.turn();
    c.move({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), promotion: m.uci[4] });
    if (withClock) {
      remaining[side] =
        remaining[side] - input.elapsed.get(m.ply)! + (game.increment_sec ?? 0) * 1000;
      c.setComment(`[%clk ${clk(remaining[side])}]`);
    }
  }
  return c.pgn();
}

/** Submits newly completed games. Called by the cron tick. */
export async function submitDueGames() {
  if (!config()) return { skipped: "not configured" };
  const { supabaseAdmin: s } = await import("@/integrations/supabase/client.server");
  await ensureWebhookRegistered();

  const { data: games, error } = await s
    .from("games")
    .select(
      "id, white_id, black_id, result, end_reason, time_control, initial_sec, increment_sec, is_correspondence, created_at, variant, chess960_start_fen, pgn, ply, is_bot_game, white_rating_before, black_rating_before",
    )
    .eq("status", "completed")
    .is("fairplay_submitted_at", null)
    .order("ended_at")
    .limit(GAMES_PER_TICK);
  if (error) throw error;

  let submitted = 0;
  let skipped = 0;
  for (const g of games ?? []) {
    const done = () =>
      s.from("games").update({ fairplay_submitted_at: new Date().toISOString() }).eq("id", g.id);
    if (
      g.is_bot_game ||
      (g.ply ?? 0) < MIN_PLIES ||
      !(await allowedPlayers(s, [g.white_id, g.black_id]))
    ) {
      skipped++;
      await done();
      continue;
    }
    const [{ data: people }, { data: moves }, { data: tele }] = await Promise.all([
      s.from("profiles").select("id, username, rating").in("id", [g.white_id, g.black_id]),
      s.from("moves").select("ply, uci").eq("game_id", g.id).order("ply"),
      s.from("move_telemetry").select("ply, elapsed_ms").eq("game_id", g.id),
    ]);
    const who = new Map((people ?? []).map((p) => [p.id, p]));
    const white = {
      username: who.get(g.white_id)?.username ?? "white",
      elo: g.white_rating_before ?? who.get(g.white_id)?.rating ?? null,
    };
    const black = {
      username: who.get(g.black_id)?.username ?? "black",
      elo: g.black_rating_before ?? who.get(g.black_id)?.rating ?? null,
    };
    let pgn: string;
    try {
      pgn = buildPgn({
        game: g,
        white,
        black,
        moves: moves ?? [],
        elapsed: new Map((tele ?? []).map((t) => [t.ply, t.elapsed_ms])),
      });
    } catch (e) {
      console.error("[sentinel] pgn build failed", g.id, e);
      skipped++;
      await done();
      continue;
    }

    let rateLimited = false;
    for (const [color, id, elo] of [
      ["white", g.white_id, white.elo],
      ["black", g.black_id, black.elo],
    ] as const) {
      const res = await call("/v1/partner/analyze", {
        method: "POST",
        body: JSON.stringify({
          game_id: g.id,
          player_id: id,
          player_color: color,
          official_elo: elo ?? undefined,
          pgn,
        }),
      });
      if (res.status === 429) {
        rateLimited = true;
        break;
      }
      const body = (await res.json().catch(() => ({}))) as {
        job_id?: string;
        message?: string;
        detail?: unknown;
      };
      await s.from("fairplay_checks").upsert(
        {
          game_id: g.id,
          player_id: id,
          player_color: color,
          job_id: res.ok ? (body.job_id ?? null) : null,
          status: res.ok && body.job_id ? "queued" : "error",
          error: res.ok
            ? null
            : `${res.status}: ${JSON.stringify(body.detail ?? body.message ?? "").slice(0, 300)}`,
        },
        { onConflict: "game_id,player_id" },
      );
    }
    if (rateLimited) break; // try this game again next minute
    await done();
    submitted++;
  }
  return { submitted, skipped };
}

type ResultPayload = {
  job_id: string;
  status: string;
  risk_level?: string | null;
  risk_score?: number | null;
  summary?: string | null;
  signals?: unknown;
  behavioral?: unknown;
};

/** Stores a result and flags the game (and, for the highest level, the player) for review. */
export async function applyResult(s: Db, r: ResultPayload) {
  const { data: check } = await s
    .from("fairplay_checks")
    .select("id, game_id, player_id, player_color")
    .eq("job_id", r.job_id)
    .maybeSingle();
  if (!check) return { ignored: "unknown job" };
  await s
    .from("fairplay_checks")
    .update({
      status: r.status,
      risk_level: r.risk_level ?? null,
      risk_score: r.risk_score ?? null,
      summary: r.summary ?? null,
      signals: (r.signals ?? null) as never,
      behavioral: (r.behavioral ?? null) as never,
      completed_at: new Date().toISOString(),
    })
    .eq("id", check.id);

  if (r.status === "complete" && r.risk_level && FLAG_LEVELS.has(r.risk_level)) {
    const { data: player } = await s
      .from("profiles")
      .select("username")
      .eq("id", check.player_id)
      .maybeSingle();
    const reason = `Sentinel ${r.risk_level} (${r.risk_score ?? "?"}) · ${player?.username ?? "player"} as ${check.player_color}`;
    await s
      .from("games")
      .update({ flagged_for_review: true, flag_reason: reason })
      .eq("id", check.game_id);
    if (r.risk_level === "HIGH_STATISTICAL_ANOMALY") {
      await s
        .from("profiles")
        .update({ flagged_for_review: true, flag_reason: reason })
        .eq("id", check.player_id);
    }
  }

  // Repeated MODERATE-or-worse results flag the player even when no single game did.
  if (r.status === "complete" && r.risk_level && PATTERN_LEVELS.includes(r.risk_level)) {
    const { data: recent } = await s
      .from("fairplay_checks")
      .select("risk_level")
      .eq("player_id", check.player_id)
      .eq("status", "complete")
      .order("completed_at", { ascending: false })
      .limit(PATTERN_WINDOW);
    const hits = (recent ?? []).filter((c) => PATTERN_LEVELS.includes(c.risk_level ?? "")).length;
    if (hits >= PATTERN_HITS) {
      await s
        .from("profiles")
        .update({
          flagged_for_review: true,
          flag_reason: `Sentinel pattern: ${hits} of last ${recent!.length} games MODERATE or higher`,
        })
        .eq("id", check.player_id);
    }
  }
  return { ok: true };
}

/** Checks on jobs whose webhook hasn't arrived. Called by the cron tick. */
export async function pollOpenJobs() {
  if (!config()) return { skipped: "not configured" };
  const { supabaseAdmin: s } = await import("@/integrations/supabase/client.server");
  const stale = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: open } = await s
    .from("fairplay_checks")
    .select("id, job_id")
    .eq("status", "queued")
    .not("job_id", "is", null)
    .lt("submitted_at", stale)
    .or(`last_polled_at.is.null,last_polled_at.lt.${stale}`)
    .order("submitted_at")
    .limit(POLLS_PER_TICK);
  let resolved = 0;
  for (const o of open ?? []) {
    await s
      .from("fairplay_checks")
      .update({ last_polled_at: new Date().toISOString() })
      .eq("id", o.id);
    const res = await call(`/v1/partner/result/${encodeURIComponent(o.job_id!)}`);
    if (res.status === 429) break;
    if (!res.ok) continue;
    const body = (await res.json()) as ResultPayload;
    if (body.status && body.status !== "queued") {
      await applyResult(s, { ...body, job_id: o.job_id! });
      resolved++;
    }
  }
  return { polled: open?.length ?? 0, resolved };
}

/** True when the body was signed with our partner secret (hex HMAC-SHA256). */
export function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.SENTINEL_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
