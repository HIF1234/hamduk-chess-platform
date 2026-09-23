-- Bot games never change Elo, but their results drive streaks, stats and
-- "Beat <bot>" achievements. Rows are written by the server after it checks the
-- player's tier may use that bot.
CREATE TABLE public.bot_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bot_id text NOT NULL,
  bot_rating integer NOT NULL,
  player_color text NOT NULL CHECK (player_color IN ('white', 'black')),
  result text NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  end_reason text,
  ply integer NOT NULL DEFAULT 0,
  time_control text NOT NULL DEFAULT '5+0',
  variant text NOT NULL DEFAULT 'standard',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bot_games_user_created_idx ON public.bot_games (user_id, created_at DESC);

GRANT SELECT ON public.bot_games TO authenticated;
GRANT ALL ON public.bot_games TO service_role;
ALTER TABLE public.bot_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own bot games"
  ON public.bot_games FOR SELECT TO authenticated
  USING (user_id = auth.uid());
