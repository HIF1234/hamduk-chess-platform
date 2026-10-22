-- Coordinates trainer: "tap the named square in 30-second rounds, with a best score."
-- One row per user holding their personal best; rounds aren't logged individually.

CREATE TABLE public.coordinate_drill_scores (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  best_score integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.coordinate_drill_scores TO authenticated;
GRANT ALL ON public.coordinate_drill_scores TO service_role;
ALTER TABLE public.coordinate_drill_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own coordinate drill score"
  ON public.coordinate_drill_scores FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY mfa_required ON public.coordinate_drill_scores AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
