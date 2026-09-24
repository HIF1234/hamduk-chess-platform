-- "Play a friend": a shareable challenge link that becomes a game when accepted.
CREATE TABLE public.game_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  time_control text NOT NULL,
  variant text NOT NULL DEFAULT 'standard' CHECK (variant IN ('standard', 'chess960')),
  creator_color text NOT NULL DEFAULT 'random' CHECK (creator_color IN ('white', 'black', 'random')),
  rated boolean NOT NULL DEFAULT false,
  game_id uuid REFERENCES public.games(id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX game_challenges_creator_idx ON public.game_challenges (creator_id, created_at DESC);

-- Anyone with the link can see the challenge; changes go through server functions.
GRANT SELECT ON public.game_challenges TO anon, authenticated;
GRANT ALL ON public.game_challenges TO service_role;
ALTER TABLE public.game_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Challenges are readable by link"
  ON public.game_challenges FOR SELECT TO anon, authenticated USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_challenges;
