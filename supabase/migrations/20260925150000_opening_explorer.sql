-- Opening explorer built from Hamduk games. Each finished human game adds one count per
-- position in its first 30 plies. A background job fills it (see explorer.server.ts).

CREATE TABLE IF NOT EXISTS public.explorer_moves (
  position text NOT NULL,          -- FEN without the move clocks
  uci text NOT NULL,
  san text NOT NULL,
  white int NOT NULL DEFAULT 0,
  draws int NOT NULL DEFAULT 0,
  black int NOT NULL DEFAULT 0,
  rating_sum bigint NOT NULL DEFAULT 0,  -- sum of the two players' average rating, for the mean
  PRIMARY KEY (position, uci)
);

ALTER TABLE public.explorer_moves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.explorer_moves FROM anon, authenticated;

ALTER TABLE public.games ADD COLUMN IF NOT EXISTS explorer_indexed boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS games_explorer_todo_idx ON public.games (ended_at)
  WHERE status = 'finished' AND NOT explorer_indexed;

-- Adds a batch of rows: [{position, uci, san, w, d, b, r}], one per game per ply.
CREATE OR REPLACE FUNCTION public.explorer_add(p_rows jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.explorer_moves AS e (position, uci, san, white, draws, black, rating_sum)
  SELECT r->>'position', r->>'uci', max(r->>'san'),
         sum((r->>'w')::int), sum((r->>'d')::int), sum((r->>'b')::int), sum((r->>'r')::bigint)
  FROM jsonb_array_elements(p_rows) r
  GROUP BY 1, 2
  ON CONFLICT (position, uci) DO UPDATE SET
    white = e.white + excluded.white,
    draws = e.draws + excluded.draws,
    black = e.black + excluded.black,
    rating_sum = e.rating_sum + excluded.rating_sum;
$$;
REVOKE EXECUTE ON FUNCTION public.explorer_add(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.explorer_add(jsonb) TO service_role;
