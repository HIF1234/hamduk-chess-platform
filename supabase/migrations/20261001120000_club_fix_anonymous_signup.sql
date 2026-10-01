-- Fixes a regression introduced by the club schema merge: club.handle_new_club_user() fires on
-- every auth.users insert (including play.chess's anonymous sign-in, which has NEW.email = NULL),
-- and tried to insert that NULL into club.profiles.email, which is NOT NULL. That raised inside
-- the trigger, which aborted the whole auth.users insert transaction -- breaking anonymous play
-- on play.chess entirely ("Database error creating anonymous user").
--
-- Anonymous users aren't part of the club app's domain at all, so the fix is simply to skip
-- creating a club.profiles/club.user_roles row for them -- not to relax the NOT NULL constraint
-- (every real club.profiles row should have a real email).

CREATE OR REPLACE FUNCTION club.handle_new_club_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = club AS $$
DECLARE
  _requested TEXT;
  _role club.app_role;
  _full_name TEXT;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  _full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO club.profiles (id, email, full_name, account_state)
  VALUES (
    NEW.id, NEW.email, _full_name,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN 'pending_payment'::club.account_state ELSE 'unverified'::club.account_state END
  );

  _requested := NEW.raw_user_meta_data ->> 'role';
  IF _requested IN ('org_admin', 'member') THEN
    _role := _requested::club.app_role;
  ELSE
    _role := 'member'::club.app_role;
  END IF;

  INSERT INTO club.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END;
$$;
