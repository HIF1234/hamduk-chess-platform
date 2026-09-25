-- Sentinel fair-play integration. Each completed human game is submitted once per player;
-- results arrive by signed webhook (or polling) and elevated ones flag the game for review.

CREATE TABLE IF NOT EXISTS public.fairplay_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  player_color text NOT NULL CHECK (player_color IN ('white', 'black')),
  job_id text UNIQUE,
  status text NOT NULL DEFAULT 'queued',  -- queued | complete | failed | webhook_failed | error
  risk_level text,
  risk_score numeric,
  summary text,
  signals jsonb,
  behavioral jsonb,
  error text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_polled_at timestamptz,
  UNIQUE (game_id, player_id)
);
CREATE INDEX IF NOT EXISTS fairplay_checks_open_idx ON public.fairplay_checks (submitted_at) WHERE status = 'queued';

ALTER TABLE public.fairplay_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fairplay_checks FROM anon, authenticated;
CREATE POLICY mfa_required ON public.fairplay_checks AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));

ALTER TABLE public.games ADD COLUMN IF NOT EXISTS fairplay_submitted_at timestamptz;
CREATE INDEX IF NOT EXISTS games_fairplay_todo_idx ON public.games (ended_at)
  WHERE status = 'completed' AND fairplay_submitted_at IS NULL;
