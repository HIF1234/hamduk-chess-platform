import { categoryOf, CATEGORY_LABEL, type TimeControlCategory } from "@/lib/time-controls";
import { escapeHtml, sendEmail } from "@/lib/email.server";

// Resend's free plan allows 100 emails a day; stay under it with room for sign-up and
// password emails. Raise EMAIL_DAILY_CAP after upgrading the Resend plan.
const DAILY_CAP = Number(process.env.EMAIL_DAILY_CAP ?? 70);
const PER_TICK = 20;
const SEND_FROM_HOUR_UTC = 7; // Monday 07:00 UTC is 08:00 in Lagos

/** Monday 00:00 UTC of the current week. */
export function weekStart(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

type Report = {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  ratingChange: Partial<Record<TimeControlCategory, number>>;
  bestWin: { opponent: string; rating: number } | null;
  puzzlesTried: number;
  puzzlesSolved: number;
  puzzleRating: number | null;
  puzzleStreak: number;
};

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function buildReport(s: Db, userId: string, since: Date, until: Date): Promise<Report> {
  const { data: games } = await s
    .from("games")
    .select(
      "white_id, black_id, winner_id, result, rated, time_control, white_rating_delta, black_rating_delta, white_rating_before, black_rating_before",
    )
    .or(`white_id.eq.${userId},black_id.eq.${userId}`)
    .eq("status", "finished")
    .gte("ended_at", since.toISOString())
    .lt("ended_at", until.toISOString())
    .limit(1000);

  const r: Report = {
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    ratingChange: {},
    bestWin: null,
    puzzlesTried: 0,
    puzzlesSolved: 0,
    puzzleRating: null,
    puzzleStreak: 0,
  };
  let bestId: string | null = null;
  for (const g of games ?? []) {
    const white = g.white_id === userId;
    r.games++;
    if (g.result === "draw") r.draws++;
    else if (g.winner_id === userId) r.wins++;
    else r.losses++;
    const delta = white ? g.white_rating_delta : g.black_rating_delta;
    const cat = categoryOf(g.time_control);
    if (g.rated && cat && delta) r.ratingChange[cat] = (r.ratingChange[cat] ?? 0) + delta;
    const oppRating = white ? g.black_rating_before : g.white_rating_before;
    if (g.winner_id === userId && oppRating && (!r.bestWin || oppRating > r.bestWin.rating)) {
      r.bestWin = { opponent: "", rating: oppRating };
      bestId = white ? g.black_id : g.white_id;
    }
  }
  if (r.bestWin && bestId) {
    const { data: opp } = await s
      .from("profiles")
      .select("username")
      .eq("id", bestId)
      .maybeSingle();
    r.bestWin.opponent = opp?.username ?? "an opponent";
  }

  const { data: attempts } = await s
    .from("puzzle_attempts")
    .select("correct")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString())
    .lt("created_at", until.toISOString())
    .limit(5000);
  r.puzzlesTried = attempts?.length ?? 0;
  r.puzzlesSolved = (attempts ?? []).filter((a) => a.correct).length;
  const { data: ps } = await s
    .from("user_puzzle_stats")
    .select("rating, current_streak")
    .eq("user_id", userId)
    .maybeSingle();
  r.puzzleRating = ps?.rating ?? null;
  r.puzzleStreak = ps?.current_streak ?? 0;
  return r;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function render(username: string, r: Report) {
  const lines: string[] = [];
  const rows: string[] = [];
  const row = (label: string, value: string) =>
    rows.push(
      `<tr><td style="padding:6px 0;color:#555">${escapeHtml(label)}</td><td style="padding:6px 0;text-align:right;font-weight:bold">${escapeHtml(value)}</td></tr>`,
    );

  if (r.games) {
    const summary = `${r.games} game${r.games === 1 ? "" : "s"}: ${r.wins} won, ${r.losses} lost, ${r.draws} drawn`;
    lines.push(summary);
    row("Games", `${r.games} (${r.wins}W ${r.losses}L ${r.draws}D)`);
  }
  for (const [cat, d] of Object.entries(r.ratingChange)) {
    const text = `${CATEGORY_LABEL[cat as TimeControlCategory]} rating ${signed(d!)}`;
    lines.push(text);
    row(`${CATEGORY_LABEL[cat as TimeControlCategory]} rating`, signed(d!));
  }
  if (r.bestWin) {
    lines.push(`Best win: ${r.bestWin.opponent} (${r.bestWin.rating})`);
    row("Best win", `${r.bestWin.opponent} (${r.bestWin.rating})`);
  }
  if (r.puzzlesTried) {
    lines.push(`Puzzles: ${r.puzzlesSolved} of ${r.puzzlesTried} solved`);
    row("Puzzles solved", `${r.puzzlesSolved} of ${r.puzzlesTried}`);
  }
  if (r.puzzleRating) row("Puzzle rating", String(r.puzzleRating));
  if (r.puzzleStreak > 1) {
    lines.push(`Puzzle streak: ${r.puzzleStreak} days`);
    row("Puzzle streak", `${r.puzzleStreak} days`);
  }

  const headline = r.games
    ? `${r.games} game${r.games === 1 ? "" : "s"}${
        Object.values(r.ratingChange).length
          ? `, ${Object.entries(r.ratingChange)
              .map(
                ([c, d]) =>
                  `${signed(d!)} ${CATEGORY_LABEL[c as TimeControlCategory].toLowerCase()}`,
              )
              .join(", ")}`
          : ""
      }`
    : `${r.puzzlesSolved} puzzles solved`;
  const nudge =
    r.losses > r.wins
      ? "A tough week. Reviewing your losses is the fastest way to turn it around."
      : "Keep it going this week.";
  const html = `<p style="font-size:15px;line-height:1.5">Hi ${escapeHtml(username)}, here's your week on Hamduk Chess.</p>
  <table style="width:100%;border-collapse:collapse;font-size:15px;border-top:1px solid #eee;border-bottom:1px solid #eee">${rows.join("")}</table>
  <p style="font-size:15px;line-height:1.5">${escapeHtml(nudge)}</p>`;
  const text = `Hi ${username}, here's your week on Hamduk Chess.\n\n${lines.join("\n")}\n\n${nudge}`;
  const cta =
    r.losses > r.wins
      ? { label: "Review your games", path: `/profile/${encodeURIComponent(username)}` }
      : { label: "Play now", path: "/play" };
  return { subject: `Your week: ${headline}`, text, html, cta };
}

/** Bulk emails still allowed today (weekly reports plus daily puzzle emails). Approximate:
 *  quiet weeks that sent nothing count too, which only makes it more cautious. */
async function bulkBudgetLeft(s: Db, today: Date) {
  const [{ count: weekly }, { count: daily }] = await Promise.all([
    s
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("weekly_report_sent_at", today.toISOString()),
    s
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("daily_puzzle_emailed_on", today.toISOString().slice(0, 10)),
  ]);
  return DAILY_CAP - (weekly ?? 0) - (daily ?? 0);
}

/** Emails today's daily puzzle to Plus and Gold members who asked for it, from 06:00 UTC. */
export async function sendDailyPuzzleEmails(now = new Date()) {
  if (now.getUTCHours() < 6) return { skipped: "not yet" };
  const { supabaseAdmin: s } = await import("@/integrations/supabase/client.server");
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const date = today.toISOString().slice(0, 10);
  const room = Math.min(PER_TICK, await bulkBudgetLeft(s, today));
  if (room <= 0) return { skipped: "daily cap" };
  const { data: due, error } = await s.rpc("daily_puzzle_email_candidates", {
    p_today: date,
    p_limit: room,
  });
  if (error) throw error;
  if (!due?.length) return { sent: 0 };

  const { ensureDailyPuzzle } = await import("@/lib/daily-puzzle.server");
  const puzzle = await ensureDailyPuzzle(date);
  if (!puzzle) return { skipped: "no puzzle" };
  const side = puzzle.fen.split(" ")[1] === "w" ? "White" : "Black";
  let sent = 0;
  for (const u of due) {
    await s.from("profiles").update({ daily_puzzle_emailed_on: date }).eq("id", u.id);
    const ok = await sendEmail(
      u.email,
      `Today's puzzle: ${side} to play (${puzzle.rating})`,
      `Good morning ${u.username}. Today's puzzle is ready: ${side} to play and win. It's rated ${puzzle.rating}. Solve it to keep your streak going.`,
      { label: "Solve today's puzzle", path: `/puzzles/daily/${date}` },
    );
    if (ok) sent++;
    await new Promise((r) => setTimeout(r, 600));
  }
  return { sent };
}

/** Sends due weekly summaries in small batches. Called by the cron tick every minute. */
export async function sendWeeklyReports(now = new Date()) {
  const start = weekStart(now);
  if (now.getTime() < start.getTime() + SEND_FROM_HOUR_UTC * 3600_000)
    return { skipped: "not yet" };

  const { supabaseAdmin: s } = await import("@/integrations/supabase/client.server");
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const room = Math.min(PER_TICK, await bulkBudgetLeft(s, today));
  if (room <= 0) return { skipped: "daily cap" };

  const { data: due, error } = await s.rpc("weekly_report_candidates", {
    p_week_start: start.toISOString(),
    p_limit: room,
  });
  if (error) throw error;
  const lastWeek = new Date(start.getTime() - 7 * 86400_000);
  let sent = 0;
  let quiet = 0;
  for (const u of due ?? []) {
    const report = await buildReport(s, u.id, lastWeek, start);
    // Marked first so a failed send isn't retried in a loop; the report is best-effort.
    await s.from("profiles").update({ weekly_report_sent_at: now.toISOString() }).eq("id", u.id);
    if (!report.games && !report.puzzlesTried) {
      quiet++;
      continue;
    }
    const m = render(u.username, report);
    if (await sendEmail(u.email, m.subject, m.text, m.cta, m.html)) sent++;
    await new Promise((r) => setTimeout(r, 600)); // Resend allows about 2 requests a second
  }
  return { sent, quiet };
}

export const __test = { buildReport, render };
