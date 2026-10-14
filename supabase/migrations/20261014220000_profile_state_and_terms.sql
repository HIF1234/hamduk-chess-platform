-- Nigeria's 36 states + the FCT, for state-scoped leaderboards (profiles.country already
-- existed but was never actually set from sign-up -- it just defaulted to 'NG' for everyone).
-- Also records when a player agreed to the Terms and Privacy Policy at sign-up.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

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
  insert into public.profiles (id, username, is_guest, country, state, terms_accepted_at)
  values (
    new.id,
    final_name,
    is_anon,
    coalesce(new.raw_user_meta_data->>'country', 'NG'),
    new.raw_user_meta_data->>'state',
    case when new.raw_user_meta_data->>'terms_accepted' = 'true' then now() else null end
  );
  return new;
end;
$function$;
