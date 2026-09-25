import type { ServerPuzzle } from "@/lib/puzzles.functions";

/** The daily puzzle for a date (YYYY-MM-DD), chosen deterministically and claimed on first use. */
export async function ensureDailyPuzzle(date: string): Promise<ServerPuzzle | null> {
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const existing = await admin
    .from("puzzles")
    .select("id,fen,solution,themes,rating")
    .eq("daily_date", date)
    .eq("approved", true)
    .maybeSingle();
  if (existing.data) return existing.data as ServerPuzzle;

  // Pick a deterministic puzzle for this date based on date hash, then claim it.
  const seed = [...date].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const pool = await admin
    .from("puzzles")
    .select("id,fen,solution,themes,rating")
    .eq("approved", true)
    .is("daily_date", null)
    .gte("rating", 900)
    .lte("rating", 1600)
    .limit(50);
  if (pool.error) throw pool.error;
  if (!pool.data || pool.data.length === 0) return null;
  const pick = pool.data[seed % pool.data.length];
  await admin.from("puzzles").update({ daily_date: date }).eq("id", pick.id);
  return pick as ServerPuzzle;
}
