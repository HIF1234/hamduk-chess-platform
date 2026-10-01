-- Folds the club app's (club.chess.hamduk.com.ng) schema into this project, under its own
-- "club" schema, so a club member's auth.users row is the exact same row a play.chess player
-- uses -- one global identity, organization memberships layered on top, per the product vision.
-- Ported from hamdukchessclub's own migration history (16 files, project tgtlilwfqxmjndmcppep),
-- consolidated to final state, with two changes made during the port:
--   1. "schools"/"school_memberships" -> "organizations"/"organization_memberships", with a
--      new `type` column, so Hamduk Chess Club is just the first seeded organization, not a
--      hardcoded special case.
--   2. hamduk_accounts/hamduk_ratings/hamduk_games/hamduk_webhooks/hamduk_webhook_events are
--      dropped entirely -- those existed only to "link" a club account to a separate play.chess
--      account over HTTP. Once both apps share one auth.users, that's meaningless: ratings and
--      games are read directly from this project's own public.ratings/public.games.
-- hamduk_embeds is kept (as club.embeds) -- it's a real "public shareable iframe" feature, not
-- an identity bridge.

CREATE SCHEMA club;

-- ============ ENUMS ============
CREATE TYPE club.app_role AS ENUM ('super_admin', 'org_admin', 'tutor', 'member');
CREATE TYPE club.account_state AS ENUM ('unverified', 'pending_payment', 'active', 'expired', 'suspended');
CREATE TYPE club.membership_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE club.organization_type AS ENUM ('school', 'club', 'academy', 'other');
CREATE TYPE club.organization_tier AS ENUM ('starter', 'standard', 'premium');
CREATE TYPE club.subscription_status AS ENUM ('none', 'pending', 'active', 'expired', 'cancelled');
CREATE TYPE club.profile_visibility AS ENUM ('members_only', 'public');
CREATE TYPE club.class_level AS ENUM ('beginner', 'intermediate', 'advanced', 'all_levels');
CREATE TYPE club.class_status AS ENUM ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE club.tournament_format AS ENUM ('swiss', 'round_robin', 'knockout', 'arena');
CREATE TYPE club.tournament_status AS ENUM ('draft', 'registration_open', 'in_progress', 'completed', 'cancelled');

-- Note: 'school_admin' became 'org_admin' in club.app_role to match the organizations rename.

-- ============ PROFILES ============
-- Extended club profile, separate from this project's own public.profiles (username/rating for
-- play.chess). Every signed-in user gets one automatically (see club.handle_new_club_user below)
-- -- it's just extended profile data, not organization membership.
CREATE TABLE club.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT,
  location TEXT,
  bio TEXT,
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',
  theme TEXT DEFAULT 'dark',
  visibility club.profile_visibility DEFAULT 'members_only',
  membership_level club.membership_level DEFAULT 'beginner',
  chess_rating INT DEFAULT 800,
  account_state club.account_state DEFAULT 'unverified',
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step INTEGER NOT NULL DEFAULT 0,
  chess_goals TEXT,
  member_since TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now(),
  membership_expires_at TIMESTAMPTZ,
  selected_plan_id UUID,
  notification_prefs JSONB NOT NULL DEFAULT '{"email":{"class_reminders":true,"tournament_alerts":true,"payment_due":true,"results":true,"announcements":true,"messages":true},"in_app":{"class_reminders":true,"tournament_alerts":true,"payment_due":true,"results":true,"announcements":true,"messages":true},"sms":{"class_reminders":false,"tournament_alerts":false,"payment_due":false,"results":false,"announcements":false,"messages":false}}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE club.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE club.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role club.app_role NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);
ALTER TABLE club.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION club.has_role(_user_id UUID, _role club.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = club AS $$
  SELECT EXISTS (SELECT 1 FROM club.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION club.get_user_roles(_user_id UUID)
RETURNS SETOF club.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = club AS $$
  SELECT role FROM club.user_roles WHERE user_id = _user_id;
$$;

-- ============ ORGANIZATIONS (was schools) ============
CREATE TABLE club.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type club.organization_type NOT NULL DEFAULT 'school',
  address TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  program_tier club.organization_tier DEFAULT 'starter',
  subscription_status club.subscription_status DEFAULT 'none',
  subscription_started_at TIMESTAMPTZ,
  subscription_expires_at TIMESTAMPTZ,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_suspended BOOLEAN DEFAULT false,
  suspended_reason TEXT,
  selected_plan_id UUID,
  student_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE club.organizations ENABLE ROW LEVEL SECURITY;

-- ============ ORGANIZATION MEMBERSHIPS (was school_memberships) ============
CREATE TABLE club.organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES club.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cohort TEXT,
  role_in_org TEXT NOT NULL DEFAULT 'student',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
ALTER TABLE club.organization_memberships ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION club.is_org_member(_user_id UUID, _organization_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = club AS $$
  SELECT EXISTS (SELECT 1 FROM club.organization_memberships WHERE user_id = _user_id AND organization_id = _organization_id);
$$;

-- Hamduk Chess Club is simply the first organization on the platform, not a special case.
INSERT INTO club.organizations (name, type, program_tier, subscription_status)
VALUES ('Hamduk Chess Club', 'club', 'premium', 'active');

-- ============ AUDIT LOG ============
CREATE TABLE club.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE club.audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_club_audit_log_user ON club.audit_log(user_id);
CREATE INDEX idx_club_audit_log_created ON club.audit_log(created_at DESC);

CREATE OR REPLACE FUNCTION club.log_audit_event(
  _action text, _target_type text DEFAULT NULL, _target_id text DEFAULT NULL, _metadata jsonb DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = club AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _action IS NULL OR length(_action) = 0 OR length(_action) > 100 THEN RAISE EXCEPTION 'Invalid action'; END IF;
  INSERT INTO club.audit_log (user_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), _action, _target_type, _target_id, _metadata) RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION club.log_audit_event(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION club.log_audit_event(text, text, text, jsonb) TO authenticated;

-- ============ SIGNUP TRIGGERS ============
-- Independent of this project's own public.handle_new_user (left untouched) -- writes to
-- disjoint tables, so firing alongside it on every auth.users insert is safe. Hardened the same
-- way the club app's own trigger was: elevated roles can't be self-claimed via signup metadata.
CREATE OR REPLACE FUNCTION club.handle_new_club_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = club AS $$
DECLARE
  _requested TEXT;
  _role club.app_role;
  _full_name TEXT;
BEGIN
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
REVOKE EXECUTE ON FUNCTION club.handle_new_club_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER club_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION club.handle_new_club_user();

CREATE OR REPLACE FUNCTION club.handle_user_email_confirmed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = club AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE club.profiles SET account_state = 'pending_payment'
     WHERE id = NEW.id AND account_state = 'unverified';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION club.handle_user_email_confirmed() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER club_on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION club.handle_user_email_confirmed();

-- ============ updated_at HELPER ============
CREATE OR REPLACE FUNCTION club.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = club AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON club.profiles FOR EACH ROW EXECUTE FUNCTION club.touch_updated_at();
CREATE TRIGGER organizations_touch BEFORE UPDATE ON club.organizations FOR EACH ROW EXECUTE FUNCTION club.touch_updated_at();

-- ============ PLANS ============
CREATE TABLE club.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  audience text NOT NULL CHECK (audience IN ('member','school')),
  tier text NOT NULL,
  price_kobo integer NOT NULL CHECK (price_kobo >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  interval text NOT NULL DEFAULT 'monthly' CHECK (interval IN ('monthly','quarterly','yearly','one_time')),
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE club.plans ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_plans_touch BEFORE UPDATE ON club.plans FOR EACH ROW EXECUTE FUNCTION club.touch_updated_at();

ALTER TABLE club.profiles ADD CONSTRAINT profiles_selected_plan_fk FOREIGN KEY (selected_plan_id) REFERENCES club.plans(id);
ALTER TABLE club.organizations ADD CONSTRAINT organizations_selected_plan_fk FOREIGN KEY (selected_plan_id) REFERENCES club.plans(id);

INSERT INTO club.plans (slug, name, description, audience, tier, price_kobo, interval, features, sort_order)
VALUES
  ('member-beginner', 'Beginner', 'Get started with the club basics', 'member', 'beginner', 500000, 'monthly',
    '["Weekly group classes","Puzzles library","Casual play"]'::jsonb, 1),
  ('member-standard', 'Standard', 'For improving players', 'member', 'standard', 1500000, 'monthly',
    '["Everything in Beginner","Tournaments entry","Tutor messaging","Progress tracking"]'::jsonb, 2),
  ('member-premium', 'Premium', 'Serious competitor track', 'member', 'premium', 3000000, 'monthly',
    '["Everything in Standard","1:1 tutor sessions","Priority support","Advanced analytics"]'::jsonb, 3),
  ('school-starter', 'School Starter', 'For schools onboarding their first cohort', 'school', 'starter', 5000000, 'monthly',
    '["Up to 30 students","School admin dashboard","Tutor assignment","Class scheduling"]'::jsonb, 1)
ON CONFLICT (slug) DO NOTHING;

-- ============ PAYMENTS ============
CREATE TABLE club.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES club.organizations(id) ON DELETE SET NULL,
  plan_id uuid NOT NULL REFERENCES club.plans(id),
  reference text NOT NULL UNIQUE,
  amount_kobo integer NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'initialized' CHECK (status IN ('initialized','success','failed','abandoned')),
  authorization_url text,
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_club_payments_user ON club.payments(user_id);
CREATE INDEX idx_club_payments_reference ON club.payments(reference);
ALTER TABLE club.payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_payments_touch BEFORE UPDATE ON club.payments FOR EACH ROW EXECUTE FUNCTION club.touch_updated_at();

-- ============ CLASSES ============
CREATE TABLE club.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  tutor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES club.organizations(id) ON DELETE SET NULL,
  level club.class_level NOT NULL DEFAULT 'all_levels',
  status club.class_status NOT NULL DEFAULT 'scheduled',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  capacity INTEGER DEFAULT 20,
  meeting_url TEXT,
  resources JSONB DEFAULT '[]'::jsonb,
  session_notes TEXT,
  attendance_taken_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE club.classes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_classes_updated_at BEFORE UPDATE ON club.classes FOR EACH ROW EXECUTE FUNCTION club.touch_updated_at();
CREATE INDEX idx_club_classes_org ON club.classes(organization_id);
CREATE INDEX idx_club_classes_tutor ON club.classes(tutor_id);
CREATE INDEX idx_club_classes_starts_at ON club.classes(starts_at);

-- Public-safe view for browsing/discovery (no meeting_url, no resources).
CREATE VIEW club.classes_public WITH (security_invoker = on) AS
SELECT id, title, description, tutor_id, organization_id, level, status, starts_at, ends_at, capacity, created_at
FROM club.classes WHERE status IN ('scheduled', 'in_progress', 'completed');

-- ============ CLASS ENROLLMENTS (also attendance) ============
CREATE TABLE club.class_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES club.classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attended BOOLEAN DEFAULT false,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, user_id)
);
ALTER TABLE club.class_enrollments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_club_class_enrollments_user ON club.class_enrollments(user_id);

-- ============ TOURNAMENTS ============
CREATE TABLE club.tournaments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  format club.tournament_format NOT NULL DEFAULT 'swiss',
  status club.tournament_status NOT NULL DEFAULT 'draft',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  max_participants INTEGER,
  organization_id UUID REFERENCES club.organizations(id) ON DELETE SET NULL,
  rounds INTEGER DEFAULT 5,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE club.tournaments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tournaments_updated_at BEFORE UPDATE ON club.tournaments FOR EACH ROW EXECUTE FUNCTION club.touch_updated_at();
CREATE INDEX idx_club_tournaments_org ON club.tournaments(organization_id);
CREATE INDEX idx_club_tournaments_starts_at ON club.tournaments(starts_at);

CREATE TABLE club.tournament_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES club.tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seed INTEGER,
  score NUMERIC DEFAULT 0,
  rank INTEGER,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);
ALTER TABLE club.tournament_participants ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_club_tournament_participants_user ON club.tournament_participants(user_id);

CREATE TABLE club.tournament_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES club.tournaments(id) ON DELETE CASCADE,
  round_number int NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | in_progress | completed
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, round_number)
);
ALTER TABLE club.tournament_rounds ENABLE ROW LEVEL SECURITY;

CREATE TABLE club.tournament_pairings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES club.tournaments(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES club.tournament_rounds(id) ON DELETE CASCADE,
  board int NOT NULL,
  white_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  black_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  result text, -- '1-0' | '0-1' | '1/2-1/2' | 'bye'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE club.tournament_pairings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_club_pairings_round ON club.tournament_pairings(round_id);
CREATE INDEX idx_club_pairings_tournament ON club.tournament_pairings(tournament_id);
CREATE TRIGGER touch_tournament_pairings BEFORE UPDATE ON club.tournament_pairings FOR EACH ROW EXECUTE FUNCTION club.touch_updated_at();

-- ============ ANNOUNCEMENTS ============
CREATE TABLE club.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all','organization','members','tutors','org_admins')),
  organization_id uuid REFERENCES club.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pinned boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE club.announcements ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER announcements_touch BEFORE UPDATE ON club.announcements FOR EACH ROW EXECUTE FUNCTION club.touch_updated_at();
CREATE INDEX idx_club_announcements_published ON club.announcements (published_at DESC);

-- ============ NOTIFICATIONS ============
CREATE TABLE club.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE club.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_club_notifications_user_unread ON club.notifications (user_id, read_at, created_at DESC);

-- ============ MESSAGES ============
CREATE TABLE club.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id uuid,
  subject text,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_club_messages_recipient_created ON club.messages (recipient_id, created_at DESC);
CREATE INDEX idx_club_messages_sender_created ON club.messages (sender_id, created_at DESC);
CREATE INDEX idx_club_messages_thread ON club.messages (thread_id, created_at);
ALTER TABLE club.messages ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER messages_touch_updated_at BEFORE UPDATE ON club.messages FOR EACH ROW EXECUTE FUNCTION club.touch_updated_at();

-- ============ LOGIN EVENTS ============
CREATE TABLE club.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  success boolean NOT NULL DEFAULT true,
  method text NOT NULL DEFAULT 'password',
  ip_address text,
  user_agent text,
  device text,
  browser text,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_club_login_events_user_created ON club.login_events (user_id, created_at DESC);
ALTER TABLE club.login_events ENABLE ROW LEVEL SECURITY;

-- ============ EMBEDS (was hamduk_embeds) ============
-- Public shareable board/puzzle/leaderboard/live-game iframes. Kept as-is -- this is a real
-- feature (see src/routes/embed.$kind.$token.tsx and /api/public/v1/embed/token), not part of
-- the identity-linking bridge that's being retired.
CREATE TABLE club.embeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  label text NOT NULL,
  token text NOT NULL,
  embed_url text NOT NULL,
  iframe_html text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE club.embeds ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "view own profile" ON club.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "update own profile" ON club.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "super admin all profiles" ON club.profiles FOR ALL TO authenticated USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));

CREATE VIEW club.profiles_public WITH (security_invoker = on) AS
SELECT id, full_name, avatar_url, membership_level, chess_rating, visibility, member_since
FROM club.profiles WHERE visibility IN ('members_only', 'public');

-- user_roles (own-row select, super-admin manage, plus RESTRICTIVE anti-escalation guards)
CREATE POLICY "view own roles" ON club.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "super admin manage roles" ON club.user_roles FOR ALL TO authenticated USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "deny self insert roles" ON club.user_roles AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (club.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "deny self update roles" ON club.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "deny self delete roles" ON club.user_roles AS RESTRICTIVE FOR DELETE TO authenticated USING (club.has_role(auth.uid(), 'super_admin'));

-- organizations (owner/admin/member select, column-level grant restriction below)
CREATE POLICY "view organization if owner or super admin" ON club.organizations FOR SELECT TO authenticated
  USING (club.has_role(auth.uid(), 'super_admin') OR owner_user_id = auth.uid());
CREATE POLICY "members can view safe organization columns" ON club.organizations FOR SELECT TO authenticated
  USING (club.is_org_member(auth.uid(), id));
CREATE POLICY "super admin manage organizations" ON club.organizations FOR ALL TO authenticated USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "organization owner update own organization" ON club.organizations FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE VIEW club.organizations_public WITH (security_invoker = on) AS
SELECT id, name, type, address, student_count, created_at FROM club.organizations;

-- organization_memberships
CREATE POLICY "view own organization memberships" ON club.organization_memberships FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "view organization memberships if owner" ON club.organization_memberships FOR SELECT TO authenticated
  USING (club.has_role(auth.uid(), 'super_admin') OR EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = organization_memberships.organization_id AND o.owner_user_id = auth.uid()));
CREATE POLICY "super admin manage org memberships" ON club.organization_memberships FOR ALL TO authenticated USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "organization owner insert memberships" ON club.organization_memberships FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = organization_memberships.organization_id AND o.owner_user_id = auth.uid()));
CREATE POLICY "organization owner delete memberships" ON club.organization_memberships FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = organization_memberships.organization_id AND o.owner_user_id = auth.uid()));

-- audit_log (insert only via club.log_audit_event)
CREATE POLICY "super admin read audit" ON club.audit_log FOR SELECT TO authenticated USING (club.has_role(auth.uid(), 'super_admin'));

-- plans
CREATE POLICY "anyone can view active plans" ON club.plans FOR SELECT TO authenticated, anon USING (is_active = true);
CREATE POLICY "super admin manage plans" ON club.plans FOR ALL TO authenticated USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));

-- payments
CREATE POLICY "view own payments" ON club.payments FOR SELECT TO authenticated USING (user_id = auth.uid() OR club.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "create own payments" ON club.payments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "super admin manage payments" ON club.payments FOR ALL TO authenticated USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));

-- classes
CREATE POLICY "view classes if participant or admin" ON club.classes FOR SELECT TO authenticated
  USING (
    club.has_role(auth.uid(), 'super_admin')
    OR tutor_id = auth.uid()
    OR (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = classes.organization_id AND o.owner_user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM club.class_enrollments e WHERE e.class_id = classes.id AND e.user_id = auth.uid())
  );
CREATE POLICY "super admin manage classes" ON club.classes FOR ALL TO authenticated USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "organization admin manage own classes" ON club.classes FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = classes.organization_id AND o.owner_user_id = auth.uid()))
  WITH CHECK (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = classes.organization_id AND o.owner_user_id = auth.uid()));
CREATE POLICY "tutor update own classes" ON club.classes FOR UPDATE TO authenticated USING (tutor_id = auth.uid()) WITH CHECK (tutor_id = auth.uid());

-- class_enrollments
CREATE POLICY "view own enrollments" ON club.class_enrollments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR club.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM club.classes c WHERE c.id = class_enrollments.class_id AND c.tutor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM club.classes c JOIN club.organizations o ON o.id = c.organization_id WHERE c.id = class_enrollments.class_id AND o.owner_user_id = auth.uid())
  );
CREATE POLICY "enroll self" ON club.class_enrollments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "unenroll self" ON club.class_enrollments FOR DELETE TO authenticated USING (user_id = auth.uid() OR club.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super admin manage enrollments" ON club.class_enrollments FOR ALL TO authenticated USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "tutor mark attendance" ON club.class_enrollments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM club.classes c WHERE c.id = class_enrollments.class_id AND c.tutor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM club.classes c WHERE c.id = class_enrollments.class_id AND c.tutor_id = auth.uid()));

-- tournaments
CREATE POLICY "view tournaments if visible" ON club.tournaments FOR SELECT TO authenticated
  USING (
    status IN ('registration_open','in_progress','completed')
    OR club.has_role(auth.uid(), 'super_admin')
    OR (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = tournaments.organization_id AND o.owner_user_id = auth.uid()))
  );
CREATE POLICY "super admin manage tournaments" ON club.tournaments FOR ALL TO authenticated USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "organization admin manage own tournaments" ON club.tournaments FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = tournaments.organization_id AND o.owner_user_id = auth.uid()))
  WITH CHECK (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = tournaments.organization_id AND o.owner_user_id = auth.uid()));

-- tournament_participants
CREATE POLICY "view tournament participants if visible" ON club.tournament_participants FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM club.tournaments t WHERE t.id = tournament_participants.tournament_id AND t.status IN ('registration_open','in_progress','completed'))
    OR user_id = auth.uid()
    OR club.has_role(auth.uid(), 'super_admin')
  );
CREATE POLICY "register self" ON club.tournament_participants FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "withdraw self" ON club.tournament_participants FOR DELETE TO authenticated USING (user_id = auth.uid() OR club.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super admin manage participants" ON club.tournament_participants FOR ALL TO authenticated USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));

-- tournament_rounds
CREATE POLICY "view rounds if tournament visible" ON club.tournament_rounds FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM club.tournaments t WHERE t.id = tournament_rounds.tournament_id
      AND (t.status IN ('registration_open','in_progress','completed')
        OR club.has_role(auth.uid(), 'super_admin')
        OR (t.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = t.organization_id AND o.owner_user_id = auth.uid())))
  ));
CREATE POLICY "super admin manage rounds" ON club.tournament_rounds FOR ALL TO authenticated USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "organization admin manage own rounds" ON club.tournament_rounds FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM club.tournaments t JOIN club.organizations o ON o.id = t.organization_id WHERE t.id = tournament_rounds.tournament_id AND o.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM club.tournaments t JOIN club.organizations o ON o.id = t.organization_id WHERE t.id = tournament_rounds.tournament_id AND o.owner_user_id = auth.uid()));

-- tournament_pairings
CREATE POLICY "view pairings if tournament visible" ON club.tournament_pairings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM club.tournaments t WHERE t.id = tournament_pairings.tournament_id
      AND (t.status IN ('registration_open','in_progress','completed')
        OR club.has_role(auth.uid(), 'super_admin')
        OR (t.organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = t.organization_id AND o.owner_user_id = auth.uid())))
  ));
CREATE POLICY "super admin manage pairings" ON club.tournament_pairings FOR ALL TO authenticated USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "organization admin manage own pairings" ON club.tournament_pairings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM club.tournaments t JOIN club.organizations o ON o.id = t.organization_id WHERE t.id = tournament_pairings.tournament_id AND o.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM club.tournaments t JOIN club.organizations o ON o.id = t.organization_id WHERE t.id = tournament_pairings.tournament_id AND o.owner_user_id = auth.uid()));

-- announcements
CREATE POLICY "super admin manage announcements" ON club.announcements FOR ALL TO authenticated USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "organization owner manage own announcements" ON club.announcements FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = organization_id AND o.owner_user_id = auth.uid()))
  WITH CHECK (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = organization_id AND o.owner_user_id = auth.uid()));
CREATE POLICY "view announcements" ON club.announcements FOR SELECT TO authenticated
  USING (
    audience = 'all'
    OR (audience = 'organization' AND organization_id IS NOT NULL AND club.is_org_member(auth.uid(), organization_id))
    OR (audience = 'members' AND club.has_role(auth.uid(), 'member'))
    OR (audience = 'tutors' AND club.has_role(auth.uid(), 'tutor'))
    OR (audience = 'org_admins' AND club.has_role(auth.uid(), 'org_admin'))
    OR club.has_role(auth.uid(), 'super_admin')
  );

-- notifications
CREATE POLICY "view own notifications" ON club.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "update own notifications" ON club.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own notifications" ON club.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "super admin manage notifications" ON club.notifications FOR ALL TO authenticated USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));

-- messages
CREATE POLICY "users read their own messages" ON club.messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "users send messages as themselves" ON club.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "recipients can mark messages read" ON club.messages FOR UPDATE TO authenticated USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);

-- login_events
CREATE POLICY "login_events_select_own" ON club.login_events FOR SELECT TO authenticated USING (auth.uid() = user_id OR club.has_role(auth.uid(), 'super_admin'));

-- embeds
CREATE POLICY "members view embeds" ON club.embeds FOR SELECT TO authenticated USING (true);

-- ============ TABLE / FUNCTION GRANTS ============
GRANT USAGE ON SCHEMA club TO authenticated, anon, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  club.profiles, club.user_roles, club.classes, club.class_enrollments, club.tournaments,
  club.tournament_participants, club.tournament_rounds, club.tournament_pairings,
  club.announcements, club.payments, club.organization_memberships, club.audit_log, club.plans
  TO authenticated;
GRANT SELECT, UPDATE, DELETE ON club.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON club.messages TO authenticated;
GRANT SELECT ON club.login_events, club.embeds TO authenticated;

-- organizations: column-level grant only -- contact/subscription/owner fields stay hidden from
-- authenticated at the privilege level, not just RLS (matches the source project exactly).
GRANT SELECT (id, name, type, address, student_count, created_at) ON club.organizations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON club.organizations TO authenticated;

GRANT SELECT ON club.plans TO anon;

GRANT SELECT ON club.profiles_public, club.organizations_public, club.classes_public TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA club TO service_role;

GRANT EXECUTE ON FUNCTION club.has_role(uuid, club.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION club.get_user_roles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION club.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION club.log_audit_event(text, text, text, jsonb) TO authenticated;

-- ============ MFA REQUIRED ON EVERY NEW TABLE (project convention) ============
-- Same restrictive policy as every public.* table: a session that only knows the password
-- (aal1) may not read/write once the user has a verified authenticator. No-op for everyone
-- else (see public.mfa_ok()).
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'club'
  LOOP
    EXECUTE format(
      'CREATE POLICY mfa_required ON club.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()))',
      t.tablename
    );
  END LOOP;
END $$;
