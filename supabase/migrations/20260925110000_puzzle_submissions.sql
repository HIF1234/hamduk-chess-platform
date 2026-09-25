-- Community puzzles are submitted through a server function (tier check, daily
-- limit, validation). Direct inserts let a player set fields like daily_date on
-- their own unapproved puzzle and hijack the daily puzzle, so writes are closed.
DROP POLICY IF EXISTS "Authenticated users submit puzzles" ON public.puzzles;
DROP POLICY IF EXISTS "Creators update own pending puzzles" ON public.puzzles;
REVOKE INSERT, UPDATE ON public.puzzles FROM authenticated;

ALTER TABLE public.puzzles
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
CREATE INDEX IF NOT EXISTS puzzles_pending_idx ON public.puzzles (created_at) WHERE approved = false;
