-- New members shouldn't have to find and enter a join code just to land somewhere -- if they
-- didn't come in through another organization's code, they should just be a Hamduk Chess Club
-- member immediately, the same way signup worked before organizations existed as a concept.
-- A join code remains how you additionally join a *different* school/club/academy; it's not a
-- gate on using the platform at all.
--
-- is_default marks which organization that is (Hamduk Chess Club), without hardcoding its name
-- or id anywhere in app code -- still "just the first organization", per the product vision, but
-- now explicitly flagged as the one new members land in by default.

ALTER TABLE club.organizations ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_one_default ON club.organizations ((is_default)) WHERE is_default;

UPDATE club.organizations SET is_default = true WHERE name = 'Hamduk Chess Club' AND NOT is_default;

CREATE OR REPLACE FUNCTION club.handle_new_club_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = club AS $$
DECLARE
  _requested TEXT;
  _role club.app_role;
  _full_name TEXT;
  _default_org_id UUID;
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

  -- org_admins set up their own organization during onboarding -- don't also drop them into
  -- the default one. Everyone else lands in it immediately, no join code required.
  IF _role <> 'org_admin' THEN
    SELECT id INTO _default_org_id FROM club.organizations WHERE is_default LIMIT 1;
    IF _default_org_id IS NOT NULL THEN
      INSERT INTO club.organization_memberships (organization_id, user_id, role_in_org, status)
      VALUES (_default_org_id, NEW.id, 'student', 'approved')
      ON CONFLICT (organization_id, user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
