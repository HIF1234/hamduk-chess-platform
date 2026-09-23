-- Coach Verbal Review: the player explains their thinking on a move and the
-- AI coach responds to the reasoning, grounded in engine evaluations.
CREATE TABLE public.move_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id uuid REFERENCES public.games(id) ON DELETE CASCADE,
  ply integer NOT NULL,
  fen_before text NOT NULL,
  move_san text NOT NULL,
  classification text,
  cp_loss integer,
  thought text NOT NULL,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  coach_reply text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX move_reflections_user_created_idx
  ON public.move_reflections (user_id, created_at DESC);
CREATE INDEX move_reflections_game_idx
  ON public.move_reflections (game_id, ply);

GRANT SELECT, DELETE ON public.move_reflections TO authenticated;
GRANT ALL ON public.move_reflections TO service_role;
ALTER TABLE public.move_reflections ENABLE ROW LEVEL SECURITY;

-- Inserts go through the server function (service role) so tier limits are enforced.
CREATE POLICY "Users read their own reflections"
  ON public.move_reflections FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users delete their own reflections"
  ON public.move_reflections FOR DELETE TO authenticated
  USING (user_id = auth.uid());
