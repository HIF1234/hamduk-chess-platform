-- Onboarding's "How well do you play?" sets a starting rating (400/800/1200/1600) instead of
-- everyone beginning at the same 1200. profiles.starting_rating is the seed used the first
-- time a ratings row is created for that player, in every time control; profiles.rating itself
-- (the headline number shown immediately on the profile) is set to the same value at sign-up.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS starting_rating integer,
  ADD COLUMN IF NOT EXISTS language text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  base_name text;
  final_name text;
  counter int := 0;
  is_anon boolean := coalesce((new.raw_app_meta_data->>'provider') = 'anonymous', new.email is null);
  bracket text := new.raw_user_meta_data->>'age_bracket';
  g_email text := new.raw_user_meta_data->>'guardian_email';
  g_token text;
  start_rating_raw text := new.raw_user_meta_data->>'starting_rating';
  start_rating int;
  lang text := new.raw_user_meta_data->>'language';
  reserved text[] := array[
    'admin', 'administrator', 'hamduk', 'hamdukchess', 'moderator', 'mod', 'staff', 'support',
    'official', 'root', 'system', 'owner', 'superadmin', 'webmaster', 'help', 'security',
    'magnuscarlsen', 'hikarunakamura', 'fabianocaruana', 'dingliren', 'garrykasparov',
    'bobbyfischer', 'viswanathananand', 'judithpolgar', 'wesleyso', 'alirezafirouzja',
    'anishgiri', 'maximevachierlagrave', 'levonaronian'
  ];
begin
  if is_anon then
    base_name := 'guest_' || substr(replace(new.id::text,'-',''), 1, 8);
  else
    base_name := coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1),
      'player'
    );
    base_name := regexp_replace(lower(base_name), '[^a-z0-9_]', '', 'g');
    if length(base_name) < 3 or replace(base_name, '_', '') = any(reserved) then
      base_name := 'player' || substr(new.id::text, 1, 6);
    end if;
  end if;
  final_name := base_name;
  while exists (select 1 from public.profiles where username = final_name) loop
    counter := counter + 1;
    final_name := base_name || counter::text;
  end loop;
  if bracket = 'under13' and g_email is not null then
    g_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  end if;
  if start_rating_raw ~ '^\d+$' then
    start_rating := start_rating_raw::int;
  end if;
  if start_rating is not null and start_rating not in (400, 800, 1200, 1600) then
    start_rating := null; -- ignore anything malformed or out of range; keep the column default
  end if;
  insert into public.profiles (
    id, username, is_guest, country, state, terms_accepted_at,
    age_bracket, guardian_email, guardian_token, starting_rating,
    rating, language
  )
  values (
    new.id,
    final_name,
    is_anon,
    coalesce(new.raw_user_meta_data->>'country', 'NG'),
    new.raw_user_meta_data->>'state',
    case when new.raw_user_meta_data->>'terms_accepted' = 'true' then now() else null end,
    bracket,
    g_email,
    g_token,
    start_rating,
    coalesce(start_rating, 1200),
    lang
  );
  return new;
end;
$function$;

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

  insert into public.ratings (user_id, time_control, variant, rating)
  select p.id, tc, var, coalesce(p.starting_rating, 1200)
  from public.profiles p where p.id in (p_white, p_black)
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
  insert into public.ratings (user_id, time_control, variant, bot_games, rating)
  select me, p_time_control, coalesce(p_variant, 'standard'), 1, coalesce(starting_rating, 1200)
  from public.profiles where id = me
  on conflict (user_id, time_control, variant)
  do update set bot_games = public.ratings.bot_games + 1, updated_at = now();
end;
$$;

-- Don't pair two players who already have an active/waiting game together (unchanged from
-- 20260928090000); only the new-ratings-row seed changed, from a hardcoded 1200 to the
-- player's own starting_rating.
CREATE OR REPLACE FUNCTION public.find_or_join_match(p_time_control text, p_rating_window integer DEFAULT 200, p_variant text DEFAULT 'standard'::text, p_start_fen text DEFAULT NULL::text, p_region text DEFAULT 'africa-west-1'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  my_tier subscription_tier_enum;
  my_priority boolean;
  my_rating int;
  my_seed int;
  opponent uuid;
  new_game_id uuid;
  white uuid; black uuid;
  init_sec int := (split_part(p_time_control,'+',1))::int * 60;
  inc_sec  int := (split_part(p_time_control,'+',2))::int;
  start_fen text := COALESCE(p_start_fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  white_r int; black_r int;
  window_clamped int := LEAST(GREATEST(COALESCE(p_rating_window, 200), 50), 200);
begin
  if me is null then raise exception 'not authenticated'; end if;

  select subscription_tier, coalesce(starting_rating, 1200) into my_tier, my_seed
    from public.profiles where id = me;
  my_priority := (my_tier = 'gold');

  select rating into my_rating
    from public.ratings
    where user_id = me and time_control = p_time_control and variant = p_variant;
  if my_rating is null then
    insert into public.ratings (user_id, time_control, variant, rating)
    values (me, p_time_control, p_variant, my_seed)
    on conflict do nothing;
    my_rating := my_seed;
  end if;

  select q.user_id into opponent
  from public.matchmaking_queue q
  where q.time_control = p_time_control
    and q.variant = p_variant
    and q.user_id <> me
    and abs(
      coalesce((
        select r.rating from public.ratings r
        where r.user_id = q.user_id
          and r.time_control = p_time_control
          and r.variant = p_variant
      ), 1200) - my_rating
    ) <= window_clamped
    -- Skip anyone we already have a game in progress with.
    and not exists (
      select 1 from public.games g
      where g.status in ('waiting', 'active')
        and ((g.white_id = me and g.black_id = q.user_id)
          or (g.black_id = me and g.white_id = q.user_id))
    )
  order by q.is_priority desc, q.joined_at asc
  for update skip locked
  limit 1;

  if opponent is null then
    insert into public.matchmaking_queue (user_id, time_control, variant, region, rating, is_priority)
    values (me, p_time_control, p_variant, p_region, my_rating, my_priority)
    on conflict (user_id) do update
      set time_control = excluded.time_control,
          variant = excluded.variant,
          region = excluded.region,
          rating = excluded.rating,
          is_priority = excluded.is_priority,
          joined_at = now();
    return null;
  end if;

  if random() < 0.5 then white := me; black := opponent;
  else white := opponent; black := me; end if;

  select rating into white_r from public.ratings
    where user_id = white and time_control = p_time_control and variant = p_variant;
  select rating into black_r from public.ratings
    where user_id = black and time_control = p_time_control and variant = p_variant;

  insert into public.games (
    white_id, black_id, time_control, variant, chess960_start_fen,
    initial_sec, increment_sec, time_white_ms, time_black_ms,
    last_clock_update, fen, region,
    white_rating_before, black_rating_before
  )
  values (
    white, black, p_time_control, p_variant,
    case when p_variant = 'chess960' then start_fen else null end,
    init_sec, inc_sec, init_sec * 1000, init_sec * 1000,
    now(), start_fen, p_region,
    coalesce(white_r, 1200), coalesce(black_r, 1200)
  )
  returning id into new_game_id;

  delete from public.matchmaking_queue where user_id in (me, opponent);
  return new_game_id;
end;
$function$;
