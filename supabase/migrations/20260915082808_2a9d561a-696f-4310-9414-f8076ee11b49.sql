CREATE TYPE public.tournament_type_enum AS ENUM ('swiss','arena','round_robin','knockout');

CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id uuid,
  name text NOT NULL,
  description text,
  type public.tournament_type_enum NOT NULL DEFAULT 'swiss',
  time_control text NOT NULL DEFAULT '5+0',
  variant text NOT NULL DEFAULT 'standard',
  rated boolean NOT NULL DEFAULT true,
  rounds integer NOT NULL DEFAULT 5,
  current_round integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  duration_min integer NOT NULL DEFAULT 60,
  max_players integer NOT NULL DEFAULT 32,
  min_tier public.subscription_tier_enum NOT NULL DEFAULT 'free',
  entry_fee_kobo integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tournaments TO anon;
GRANT SELECT, INSERT, UPDATE ON public.tournaments TO authenticated;
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public tournaments are viewable"
  ON public.tournaments FOR SELECT TO anon, authenticated
  USING (club_id IS NULL);
CREATE POLICY "Creators can view own tournaments"
  ON public.tournaments FOR SELECT TO authenticated
  USING (creator_id = auth.uid());
CREATE POLICY "Authenticated users can create tournaments"
  ON public.tournaments FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());
CREATE POLICY "Creators and admins can update tournaments"
  ON public.tournaments FOR UPDATE TO authenticated
  USING (creator_id = auth.uid() OR public.is_admin('moderator'))
  WITH CHECK (creator_id = auth.uid() OR public.is_admin('moderator'));

CREATE TRIGGER tournaments_touch BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.tournament_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seed integer NOT NULL DEFAULT 0,
  rating_at_join integer NOT NULL DEFAULT 1200,
  score numeric NOT NULL DEFAULT 0,
  buchholz numeric NOT NULL DEFAULT 0,
  games_played integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  paid boolean NOT NULL DEFAULT false,
  paystack_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);

GRANT SELECT ON public.tournament_players TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_players TO authenticated;
GRANT ALL ON public.tournament_players TO service_role;
ALTER TABLE public.tournament_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Entrants are viewable"
  ON public.tournament_players FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "Users can register themselves"
  ON public.tournament_players FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own entry"
  ON public.tournament_players FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin('moderator'))
  WITH CHECK (user_id = auth.uid() OR public.is_admin('moderator'));
CREATE POLICY "Users can withdraw own entry"
  ON public.tournament_players FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin('moderator'));

CREATE TRIGGER tournament_players_touch BEFORE UPDATE ON public.tournament_players
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.tournament_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round integer NOT NULL,
  pairings jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'live',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (tournament_id, round)
);

GRANT SELECT ON public.tournament_rounds TO anon;
GRANT SELECT ON public.tournament_rounds TO authenticated;
GRANT ALL ON public.tournament_rounds TO service_role;
ALTER TABLE public.tournament_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rounds are viewable"
  ON public.tournament_rounds FOR SELECT TO anon, authenticated
  USING (true);

CREATE TABLE public.tournament_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round integer NOT NULL,
  game_id uuid REFERENCES public.games(id) ON DELETE SET NULL,
  white_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  black_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  result text,
  recorded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tournament_games_game_idx ON public.tournament_games (game_id);
CREATE INDEX tournament_games_tournament_round_idx ON public.tournament_games (tournament_id, round);

GRANT SELECT ON public.tournament_games TO anon;
GRANT SELECT ON public.tournament_games TO authenticated;
GRANT ALL ON public.tournament_games TO service_role;
ALTER TABLE public.tournament_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tournament games are viewable"
  ON public.tournament_games FOR SELECT TO anon, authenticated
  USING (true);

CREATE TABLE public.tournament_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tournament_chat_tournament_idx ON public.tournament_chat (tournament_id, created_at DESC);

GRANT SELECT ON public.tournament_chat TO anon;
GRANT SELECT, INSERT, DELETE ON public.tournament_chat TO authenticated;
GRANT ALL ON public.tournament_chat TO service_role;
ALTER TABLE public.tournament_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tournament chat is viewable"
  ON public.tournament_chat FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "Users can post chat as themselves"
  ON public.tournament_chat FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own chat"
  ON public.tournament_chat FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin('moderator'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_chat;
