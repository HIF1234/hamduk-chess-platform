-- Browser-side fair-play signals from live games: tab focus loss, copy/paste, and per-move
-- interaction timing. Written and read only by the server (service role).

CREATE TABLE IF NOT EXISTS public.game_client_signals (
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  page_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  per_move jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, user_id)
);
ALTER TABLE public.game_client_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_client_signals FROM anon, authenticated;
CREATE POLICY mfa_required ON public.game_client_signals AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));

-- Appends a batch, keeping at most 500 entries of each kind per player per game.
CREATE OR REPLACE FUNCTION public.append_client_signals(
  p_game uuid, p_user uuid, p_window jsonb, p_page jsonb, p_moves jsonb
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.game_client_signals AS s (game_id, user_id, window_events, page_events, per_move)
  VALUES (p_game, p_user, p_window, p_page, p_moves)
  ON CONFLICT (game_id, user_id) DO UPDATE SET
    window_events = CASE WHEN jsonb_array_length(s.window_events) >= 500 THEN s.window_events ELSE s.window_events || excluded.window_events END,
    page_events = CASE WHEN jsonb_array_length(s.page_events) >= 500 THEN s.page_events ELSE s.page_events || excluded.page_events END,
    per_move = CASE WHEN jsonb_array_length(s.per_move) >= 500 THEN s.per_move ELSE s.per_move || excluded.per_move END,
    updated_at = now();
$$;
REVOKE EXECUTE ON FUNCTION public.append_client_signals(uuid, uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_client_signals(uuid, uuid, jsonb, jsonb, jsonb) TO service_role;
