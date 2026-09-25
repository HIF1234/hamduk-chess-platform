-- Saved analysis boards, shared by unlisted link (/analysis/<id>).

CREATE TABLE IF NOT EXISTS public.saved_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  notes text CHECK (char_length(notes) <= 2000),
  start_fen text NOT NULL CHECK (char_length(start_fen) <= 100),
  headers jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(headers) <= 4000),
  moves text[] NOT NULL DEFAULT '{}' CHECK (cardinality(moves) <= 600),
  ply int NOT NULL DEFAULT 0 CHECK (ply >= 0),
  orientation text NOT NULL DEFAULT 'white' CHECK (orientation IN ('white', 'black')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_analyses_owner_idx ON public.saved_analyses (owner_id, updated_at DESC);

ALTER TABLE public.saved_analyses ENABLE ROW LEVEL SECURITY;

-- Anyone with the link can read; only registered (non-guest) owners can write.
CREATE POLICY "Anyone with the link can view" ON public.saved_analyses
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Players save their own" ON public.saved_analyses
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND NOT (SELECT is_guest FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Owners update" ON public.saved_analyses
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete" ON public.saved_analyses
  FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY mfa_required ON public.saved_analyses AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));

GRANT SELECT ON public.saved_analyses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_analyses TO authenticated;

-- A cap so one account can't fill the table.
CREATE OR REPLACE FUNCTION public.saved_analyses_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.saved_analyses WHERE owner_id = NEW.owner_id) >= 500 THEN
    RAISE EXCEPTION 'You have 500 saved analyses. Delete some to save more.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS saved_analyses_limit ON public.saved_analyses;
CREATE TRIGGER saved_analyses_limit BEFORE INSERT ON public.saved_analyses
  FOR EACH ROW EXECUTE FUNCTION public.saved_analyses_limit();
