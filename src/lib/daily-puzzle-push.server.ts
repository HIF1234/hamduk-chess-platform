import { sendPush } from "@/lib/push.server";

const PER_TICK = 30;
const DAILY_PUZZLE_HOUR_UTC = 7; // 08:00 Lagos
const STREAK_REMINDER_HOUR_UTC = 19; // 20:00 Lagos

/** Pushes "today's puzzle is ready" at 08:00 Lagos to everyone with a device registered.
 *  Free for everyone, unlike the Plus/Gold-only daily puzzle email. */
export async function sendDailyPuzzlePush(now = new Date()) {
  if (now.getUTCHours() < DAILY_PUZZLE_HOUR_UTC) return { skipped: "not yet" };
  const { supabaseAdmin: s } = await import("@/integrations/supabase/client.server");
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const date = today.toISOString().slice(0, 10);
  const { data: due, error } = await s.rpc("daily_puzzle_push_candidates", {
    p_today: date,
    p_limit: PER_TICK,
  });
  if (error) throw error;
  if (!due?.length) return { sent: 0 };

  let sent = 0;
  for (const u of due) {
    await s.from("profiles").update({ daily_puzzle_pushed_on: date }).eq("id", u.id);
    const r = await sendPush(u.id as string, {
      title: "Today's puzzle is ready",
      body: "Solve it to keep your streak going.",
      link: "/puzzles/daily",
    });
    if ("sent" in r && (r.sent ?? 0) > 0) sent++;
  }
  return { sent };
}

/** Pushes "keep your streak" at 20:00 Lagos to anyone with an active streak who hasn't
 *  solved today's puzzle yet. Free for everyone. */
export async function sendStreakReminderPush(now = new Date()) {
  if (now.getUTCHours() < STREAK_REMINDER_HOUR_UTC) return { skipped: "not yet" };
  const { supabaseAdmin: s } = await import("@/integrations/supabase/client.server");
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const date = today.toISOString().slice(0, 10);
  const { data: due, error } = await s.rpc("streak_reminder_push_candidates", {
    p_today: date,
    p_limit: PER_TICK,
  });
  if (error) throw error;
  if (!due?.length) return { sent: 0 };

  let sent = 0;
  for (const u of due) {
    await s.from("profiles").update({ streak_reminder_pushed_on: date }).eq("id", u.id);
    const streak = u.current_streak as number;
    const r = await sendPush(u.id as string, {
      title: `Keep your ${streak}-day streak`,
      body: "Solve today's puzzle before it resets.",
      link: "/puzzles/daily",
    });
    if ("sent" in r && (r.sent ?? 0) > 0) sent++;
  }
  return { sent };
}
