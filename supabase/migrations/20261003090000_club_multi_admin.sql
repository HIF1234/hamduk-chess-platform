-- M0 foundations (per the full product spec): real multi-admin support per organization.
-- Today every "is this caller allowed to manage this org" check in the app is
-- organizations.owner_user_id = userId -- one person, no delegation. owner_user_id stays the
-- permanent billing owner (unremovable), but an org can now also have any number of additional
-- admins via role_in_org = 'org_admin', which club.is_org_privileged now treats as privileged
-- for ANY permission, same authority as the owner. This is a backstop-level fix: every RLS
-- policy already built on is_org_privileged (tournaments, classes, roster, guardian_links,
-- equipment, coach applications' org-scoped bits) gets multi-admin support for free, with no
-- per-table migration needed.

ALTER TABLE club.organization_memberships
  DROP CONSTRAINT organization_memberships_role_in_org_check;
ALTER TABLE club.organization_memberships
  ADD CONSTRAINT organization_memberships_role_in_org_check
  CHECK (role_in_org IN ('student', 'tutor', 'assistant_coach', 'parent', 'staff', 'tournament_manager', 'equipment_manager', 'org_admin'));

CREATE OR REPLACE FUNCTION club.is_org_privileged(_org_id UUID, _roles TEXT[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = club AS $$
  SELECT EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = _org_id AND o.owner_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM club.organization_memberships m
      WHERE m.organization_id = _org_id AND m.user_id = auth.uid() AND m.status = 'approved'
        AND (m.role_in_org = 'org_admin' OR m.role_in_org = ANY(_roles))
    );
$$;
