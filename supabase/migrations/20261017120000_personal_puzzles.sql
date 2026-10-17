-- "Puzzles from your games": a player's own blunders, saved after an on-device review as
-- personal training material. Separate from the public puzzles table/rating ladder --
-- these are never served to anyone else and don't touch the player's puzzle rating.

CREATE TABLE public.personal_puzzles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fen text NOT NULL,
  best_move text NOT NULL,
  solved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fen, best_move)
);
CREATE INDEX personal_puzzles_user_idx ON public.personal_puzzles (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.personal_puzzles TO authenticated;
GRANT ALL ON public.personal_puzzles TO service_role;
ALTER TABLE public.personal_puzzles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own personal puzzles"
  ON public.personal_puzzles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY mfa_required ON public.personal_puzzles AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
