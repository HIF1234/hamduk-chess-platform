-- Restores schema that existed on the previously hosted database but was never
-- captured as a migration: per-(time control, variant) ratings, bot-game
-- tracking and rating deltas on games. Later migrations (20260701205959 onward)
-- depend on these objects. Reconstructed from the generated types and callers.

CREATE TABLE IF NOT EXISTS public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_control text NOT NULL,
  variant text NOT NULL DEFAULT 'standard',
  rating integer NOT NULL DEFAULT 1200,
  games_played integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  bot_games integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, time_control, variant)
);

CREATE INDEX IF NOT EXISTS ratings_leaderboard_idx
  ON public.ratings (time_control, variant, rating DESC);

GRANT SELECT ON public.ratings TO anon, authenticated;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ratings are public" ON public.ratings;
CREATE POLICY "Ratings are public"
  ON public.ratings FOR SELECT TO anon, authenticated
  USING (true);

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS is_bot_game boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bot_persona_id text,
  ADD COLUMN IF NOT EXISTS white_rating_delta integer,
  ADD COLUMN IF NOT EXISTS black_rating_delta integer,
  ADD COLUMN IF NOT EXISTS white_rating_before integer,
  ADD COLUMN IF NOT EXISTS black_rating_before integer,
  ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'africa-west-1';

ALTER TABLE public.matchmaking_queue
  ADD COLUMN IF NOT EXISTS variant text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'africa-west-1',
  ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false;

-- Elo per (time control, variant). K = 40 for <30 games, 20 for <100, else 10.
-- Rating floor 400. Idempotent per game: a game with deltas already set is skipped.
CREATE OR REPLACE FUNCTION public.apply_elo(
  p_white uuid,
  p_black uuid,
  p_result text,
  p_time_control text DEFAULT NULL,
  p_variant text DEFAULT NULL,
  p_game_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  g_tc text;
  g_var text;
  g_rated boolean;
  g_bot boolean;
  g_delta int;
  tc text;
  var text;
  rw int; rb int; gw int; gb int;
  kw int; kb int;
  ew float; sw float; sb float;
  new_rw int; new_rb int;
begin
  if p_game_id is not null then
    select time_control, variant, rated, is_bot_game, white_rating_delta
      into g_tc, g_var, g_rated, g_bot, g_delta
      from public.games where id = p_game_id for update;
    if g_delta is not null or g_rated = false or g_bot then
      return;
    end if;
  end if;

  tc  := coalesce(p_time_control, g_tc, 'blitz');
  var := coalesce(p_variant, g_var, 'standard');

  insert into public.ratings (user_id, time_control, variant)
  values (p_white, tc, var), (p_black, tc, var)
  on conflict (user_id, time_control, variant) do nothing;

  select rating, games_played into rw, gw from public.ratings
    where user_id = p_white and time_control = tc and variant = var for update;
  select rating, games_played into rb, gb from public.ratings
    where user_id = p_black and time_control = tc and variant = var for update;

  kw := case when gw < 30 then 40 when gw < 100 then 20 else 10 end;
  kb := case when gb < 30 then 40 when gb < 100 then 20 else 10 end;

  ew := 1.0 / (1.0 + power(10, (rb - rw) / 400.0));
  if p_result = 'white' then sw := 1.0; sb := 0.0;
  elsif p_result = 'black' then sw := 0.0; sb := 1.0;
  else sw := 0.5; sb := 0.5; end if;

  new_rw := greatest(400, round(rw + kw * (sw - ew)));
  new_rb := greatest(400, round(rb + kb * (sb - (1.0 - ew))));

  update public.ratings set
    rating = new_rw,
    games_played = games_played + 1,
    wins = wins + (sw = 1)::int,
    losses = losses + (sw = 0)::int,
    draws = draws + (sw = 0.5)::int,
    updated_at = now()
  where user_id = p_white and time_control = tc and variant = var;

  update public.ratings set
    rating = new_rb,
    games_played = games_played + 1,
    wins = wins + (sb = 1)::int,
    losses = losses + (sb = 0)::int,
    draws = draws + (sb = 0.5)::int,
    updated_at = now()
  where user_id = p_black and time_control = tc and variant = var;

  -- Profile keeps the headline rating (most recent pool played) and lifetime totals.
  update public.profiles set
    rating = new_rw,
    games_played = games_played + 1,
    wins = wins + (sw = 1)::int,
    losses = losses + (sw = 0)::int,
    draws = draws + (sw = 0.5)::int
  where id = p_white;

  update public.profiles set
    rating = new_rb,
    games_played = games_played + 1,
    wins = wins + (sb = 1)::int,
    losses = losses + (sb = 0)::int,
    draws = draws + (sb = 0.5)::int
  where id = p_black;

  if p_game_id is not null then
    update public.games set
      white_rating_before = coalesce(white_rating_before, rw),
      black_rating_before = coalesce(black_rating_before, rb),
      white_rating_delta = new_rw - rw,
      black_rating_delta = new_rb - rb
    where id = p_game_id;
  end if;
end;
$$;

-- Bot games never change Elo; they are only counted for streaks and stats.
CREATE OR REPLACE FUNCTION public.record_bot_game(
  p_time_control text,
  p_variant text DEFAULT 'standard'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  me uuid := auth.uid();
begin
  if me is null then return; end if;
  insert into public.ratings (user_id, time_control, variant, bot_games)
  values (me, p_time_control, coalesce(p_variant, 'standard'), 1)
  on conflict (user_id, time_control, variant)
  do update set bot_games = public.ratings.bot_games + 1, updated_at = now();
end;
$$;
