-- Section 12 of the product vision: the Hamduk-verified coach layer -- a platform-level trust
-- badge for tutors, independent of which organization they teach at (a tutor could teach at
-- several orgs; verification is about the person, not any one org's roster). Reviewed by
-- super admins only, same authority level that already gates the global /tutors page.

ALTER TABLE club.profiles
  ADD COLUMN IF NOT EXISTS coach_bio TEXT,
  ADD COLUMN IF NOT EXISTS coach_specialties TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS coach_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coach_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS coach_verified_by UUID REFERENCES auth.users(id);

CREATE TABLE club.coach_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bio TEXT NOT NULL,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One live application per person at a time -- resubmitting after a decision is fine (that row
-- is no longer 'pending'), but you can't have two pending applications stacked up.
CREATE UNIQUE INDEX coach_applications_one_pending ON club.coach_applications (user_id) WHERE status = 'pending';

ALTER TABLE club.coach_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own applications" ON club.coach_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "submit own application" ON club.coach_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND club.has_role(auth.uid(), 'tutor'));
CREATE POLICY "super admin manage applications" ON club.coach_applications FOR ALL TO authenticated
  USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "mfa_required" ON club.coach_applications AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
