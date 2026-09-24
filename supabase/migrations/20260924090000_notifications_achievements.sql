-- In-app notifications and the 25 achievements from the spec.

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_read_created_idx
  ON public.notifications (user_id, read, created_at DESC);

GRANT SELECT, UPDATE (read), DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their notifications"
  ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users mark their notifications read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete their notifications"
  ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE TABLE public.achievements (
  slug text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  icon text NOT NULL,
  sort integer NOT NULL
);
GRANT SELECT ON public.achievements TO anon, authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Achievements are public" ON public.achievements FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.user_achievements (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_slug text NOT NULL REFERENCES public.achievements(slug) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_slug)
);
CREATE INDEX user_achievements_slug_idx ON public.user_achievements (achievement_slug);
GRANT SELECT ON public.user_achievements TO anon, authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
-- Badges show on public profiles.
CREATE POLICY "Unlocked achievements are public"
  ON public.user_achievements FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.achievements (slug, name, description, tier, icon, sort) VALUES
  ('first-move',        'First Move',         'Play your first game',                                   'bronze',   'Footprints',   1),
  ('first-win',         'First Win',          'Win your first game',                                    'bronze',   'Trophy',       2),
  ('puzzle-apprentice', 'Puzzle Apprentice',  'Solve 10 puzzles',                                       'bronze',   'Puzzle',       3),
  ('puzzle-master',     'Puzzle Master',      'Solve 500 puzzles',                                      'gold',     'Brain',        4),
  ('puzzle-streak-7',   'Puzzle Streak 7',    'Solve puzzles 7 days in a row',                          'silver',   'Flame',        5),
  ('perfect-day',       'Perfect Day',        'Solve the daily puzzle correctly 7 days in a row',       'silver',   'CalendarCheck',6),
  ('checkmate-artist',  'Checkmate Artist',   'Win by checkmate 10 times',                              'silver',   'Crown',        7),
  ('mate-under-20',     'Mate in Under 20',   'Win a game in under 20 moves',                           'silver',   'Zap',          8),
  ('comeback-king',     'Comeback King',      'Win a game after being worse by 3 pawns or more',        'gold',     'RotateCcw',    9),
  ('win-streak-5',      '5 Win Streak',       'Win 5 games in a row in the same time control',          'silver',   'TrendingUp',  10),
  ('blitz-beast',       'Blitz Beast',        'Win 10 blitz games',                                     'bronze',   'Timer',       11),
  ('bullet-survivor',   'Bullet Survivor',    'Win 10 bullet games',                                    'bronze',   'Gauge',       12),
  ('beat-2000-bot',     'Beat the 2000s',     'Defeat Eko Atlantic or a stronger bot',                  'silver',   'Bot',         13),
  ('naija-conqueror',   'Naija Conqueror',    'Beat Naija Legend',                                      'platinum', 'Swords',      14),
  ('tournament-victor', 'Tournament Victor',  'Win a tournament',                                       'gold',     'Medal',       15),
  ('club-founder',      'Club Founder',       'Create a club',                                          'bronze',   'Castle',      16),
  ('socialite',         'Socialite',          'Reach 50 followers',                                     'silver',   'Users',       17),
  ('games-100',         '100 Games',          'Play 100 games',                                         'bronze',   'Hash',        18),
  ('games-500',         '500 Games',          'Play 500 games',                                         'silver',   'Layers',      19),
  ('rated-1500',        'Rated 1500',         'Reach 1500 in any time control',                         'silver',   'Star',        20),
  ('rated-2000',        'Rated 2000',         'Reach 2000 in any time control',                         'gold',     'Sparkles',    21),
  ('opening-scholar',   'Opening Scholar',    'Master every opening in the trainer',                    'silver',   'BookOpen',    22),
  ('early-adopter',     'Early Adopter',      'Join as one of the first 1,000 players',                 'gold',     'Rocket',      23),
  ('nigerian-pride',    'Nigerian Pride',     'Set your country to Nigeria',                            'bronze',   'Flag',        24),
  ('hamduk-legend',     'Hamduk Legend',      'Unlock every other achievement',                         'platinum', 'Gem',         25);
