-- Age gate + guardian consent (sign-up spec). Under-13 sign-ups get bots, puzzles and
-- lessons immediately but are held out of online play (matchmaking, challenges) until a
-- parent approves via the one-tap link sent to guardian_email.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_bracket text CHECK (age_bracket IN ('under13', '13_17', '18_plus')),
  ADD COLUMN IF NOT EXISTS guardian_email text,
  ADD COLUMN IF NOT EXISTS guardian_token text,
  ADD COLUMN IF NOT EXISTS guardian_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS guardian_approved_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_guardian_token_key ON public.profiles (guardian_token) WHERE guardian_token IS NOT NULL;

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
    if length(base_name) < 3 then base_name := 'player' || substr(new.id::text, 1, 6); end if;
  end if;
  final_name := base_name;
  while exists (select 1 from public.profiles where username = final_name) loop
    counter := counter + 1;
    final_name := base_name || counter::text;
  end loop;
  if bracket = 'under13' and g_email is not null then
    g_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  end if;
  insert into public.profiles (
    id, username, is_guest, country, state, terms_accepted_at,
    age_bracket, guardian_email, guardian_token
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
    g_token
  );
  return new;
end;
$function$;

-- Server-side gate: true when this user may use online play (matchmaking, challenges).
-- Guests, teens and adults are always allowed; an under-13 account needs guardian approval.
CREATE OR REPLACE FUNCTION public.online_play_allowed(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(age_bracket, '18_plus') != 'under13' OR guardian_approved_at IS NOT NULL
  FROM public.profiles WHERE id = p_user_id;
$function$;
