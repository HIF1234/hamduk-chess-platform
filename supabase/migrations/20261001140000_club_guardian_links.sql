-- Section 11 of the product vision: a parent/guardian dashboard. Vision §10 already added
-- 'parent' as an org-scoped role_in_org value; this is the actual link between a guardian and
-- the child/children they can see activity for -- not a global relationship, scoped to one
-- organization, since the same person could be staff at one org and just a parent at another.
--
-- The org admin creates these links (that's how a school onboards a parent in practice), not
-- the guardian or the child themselves -- there's no self-service "claim a child" flow here on
-- purpose, since that would let anyone link themselves to anyone's account.

CREATE TABLE club.guardian_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES club.organizations(id) ON DELETE CASCADE,
  guardian_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (organization_id, guardian_user_id, child_user_id),
  CHECK (guardian_user_id <> child_user_id)
);
ALTER TABLE club.guardian_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guardian views own links" ON club.guardian_links FOR SELECT TO authenticated
  USING (guardian_user_id = auth.uid());
CREATE POLICY "super admin manage guardian links" ON club.guardian_links FOR ALL TO authenticated
  USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "organization owner manage guardian links" ON club.guardian_links FOR ALL TO authenticated
  USING (club.is_org_privileged(organization_id, ARRAY[]::text[]))
  WITH CHECK (club.is_org_privileged(organization_id, ARRAY[]::text[]));

CREATE POLICY "mfa_required" ON club.guardian_links AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
