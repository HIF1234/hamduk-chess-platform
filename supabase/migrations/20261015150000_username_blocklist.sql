-- Defense in depth for the username blocklist: the app's live-availability check
-- (checkUsernameAvailable, same reserved words) already stops this at sign-up time, but
-- someone calling the API directly shouldn't be able to register as "admin" or "hamduk"
-- either. Falls back to an auto-generated name rather than erroring the whole sign-up.
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
