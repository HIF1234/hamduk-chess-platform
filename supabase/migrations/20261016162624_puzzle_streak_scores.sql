-- Puzzle Streak: no timer, puzzles get progressively harder, one miss ends the run. Free
-- for everyone (unlike Puzzle Storm, which the spec explicitly restricts to Plus/Gold).
CREATE TABLE IF NOT EXISTS public.puzzle_streak_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  streak integer NOT NULL DEFAULT 0,
  played_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS puzzle_streak_scores_user_idx ON public.puzzle_streak_scores (user_id, played_at DESC);

ALTER TABLE public.puzzle_streak_scores ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.puzzle_streak_scores TO authenticated;
GRANT ALL ON public.puzzle_streak_scores TO service_role;

DROP POLICY IF EXISTS "Players manage own streak runs" ON public.puzzle_streak_scores;
CREATE POLICY "Players manage own streak runs" ON public.puzzle_streak_scores
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
