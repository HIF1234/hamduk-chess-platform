// Puzzle Streak: no timer, puzzles get progressively harder, one miss ends the run. Free
// for everyone (no Plus/Gold gate, unlike Puzzle Storm). New feature -- nothing like this
// exists on the web yet either, so there's no existing logic to mirror or duplicate.
import { z } from "zod";
import type { AppContext } from "@/lib/app.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const StreamSchema = z
  .object({ count: z.coerce.number().int().min(10).max(100).default(60) })
  .partial()
  .transform((v) => ({ count: v.count ?? 60 }));

/** A puzzle stream climbing from just above this player's own puzzle rating up to the
 *  hardest puzzles in the pool, ascending -- so each next puzzle is at least as hard as
 *  the last, same "gets harder" curve as Storm/Battle's warm-up but with no ceiling. */
export async function getStreakStream(ctx: AppContext, input: unknown) {
  const data = StreamSchema.parse(input ?? {});
  const s = await admin();
  const { data: stats } = await s
    .from("user_puzzle_stats")
    .select("rating")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  const rating = stats?.rating ?? 1200;
  const { data: rows, error } = await s
    .from("puzzles")
    .select("id, fen, solution, themes, rating")
    .eq("approved", true)
    .gte("rating", Math.max(400, rating - 200))
    .order("rating", { ascending: true })
    .limit(data.count);
  if (error) throw error;
  return { puzzles: rows ?? [] };
}

const SubmitSchema = z.object({ streak: z.number().int().min(0).max(500) });

/** Persists a finished run and returns the player's personal best. */
export async function submitStreakRun(ctx: AppContext, input: unknown) {
  const data = SubmitSchema.parse(input);
  const { error } = await ctx.supabase
    .from("puzzle_streak_scores")
    .insert({ user_id: ctx.userId, streak: data.streak });
  if (error) throw error;
  const s = await admin();
  const { data: best } = await s
    .from("puzzle_streak_scores")
    .select("streak")
    .eq("user_id", ctx.userId)
    .order("streak", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { streak: data.streak, personalBest: best?.streak ?? data.streak };
}

/** This player's recent runs and personal best. */
export async function getMyStreakStats(ctx: AppContext) {
  const s = await admin();
  const { data: rows } = await s
    .from("puzzle_streak_scores")
    .select("streak, played_at")
    .eq("user_id", ctx.userId)
    .order("played_at", { ascending: false })
    .limit(20);
  const list = rows ?? [];
  const best = list.reduce((m, r) => Math.max(m, r.streak), 0);
  return { best, runs: list.length, recent: list };
}
