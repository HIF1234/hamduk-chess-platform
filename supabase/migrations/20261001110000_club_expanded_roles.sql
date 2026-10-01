-- Section 10 of the product vision: expanded roles & permissions -- Assistant Coach,
-- Parent/Guardian, Staff, Tournament Manager, Equipment Manager -- on top of the existing
-- student/tutor/org_admin roles.
--
-- These are added as values of club.organization_memberships.role_in_org, NOT as new values of
-- the global club.app_role enum. role_in_org is already per-(user, organization): the same
-- person can be a tournament manager at one org and just a student at another. app_role is
-- global (super_admin vs not) and stays that way -- scoping permissions per-org here matches
-- the vision's "organizations are independent, membership is layered on" model, rather than
-- hardcoding a single global capability set per user.
--
-- parent and equipment_manager get the role value and are allowed to be assigned, but no extra
-- RLS/permissions are wired for them yet -- their actual features are separate vision items
-- (§11 parent/guardian dashboard, §20 equipment management), deferred on purpose.

ALTER TABLE club.organization_memberships
  ADD CONSTRAINT organization_memberships_role_in_org_check
  CHECK (role_in_org IN ('student', 'tutor', 'assistant_coach', 'parent', 'staff', 'tournament_manager', 'equipment_manager'));

-- True if the caller owns the org, or holds one of the given roles as an approved member of it.
-- Centralizes the "owner OR privileged role" check used throughout the policies below instead
-- of repeating the owner EXISTS clause everywhere.
CREATE OR REPLACE FUNCTION club.is_org_privileged(_org_id UUID, _roles TEXT[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = club AS $$
  SELECT EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = _org_id AND o.owner_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM club.organization_memberships m
      WHERE m.organization_id = _org_id AND m.user_id = auth.uid() AND m.status = 'approved' AND m.role_in_org = ANY(_roles)
    );
$$;
GRANT EXECUTE ON FUNCTION club.is_org_privileged(uuid, text[]) TO authenticated;

-- ============ TOURNAMENTS: tournament_manager gets the same management rights as the owner ============
DROP POLICY "view tournaments if visible" ON club.tournaments;
CREATE POLICY "view tournaments if visible" ON club.tournaments FOR SELECT TO authenticated
  USING (
    status IN ('registration_open','in_progress','completed')
    OR club.has_role(auth.uid(), 'super_admin')
    OR (organization_id IS NOT NULL AND club.is_org_privileged(organization_id, ARRAY['staff','tournament_manager']))
  );

DROP POLICY "organization admin manage own tournaments" ON club.tournaments;
CREATE POLICY "organization admin manage own tournaments" ON club.tournaments FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND club.is_org_privileged(organization_id, ARRAY['tournament_manager']))
  WITH CHECK (organization_id IS NOT NULL AND club.is_org_privileged(organization_id, ARRAY['tournament_manager']));

DROP POLICY "view tournament participants if visible" ON club.tournament_participants;
CREATE POLICY "view tournament participants if visible" ON club.tournament_participants FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM club.tournaments t WHERE t.id = tournament_participants.tournament_id AND t.status IN ('registration_open','in_progress','completed'))
    OR user_id = auth.uid()
    OR club.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM club.tournaments t WHERE t.id = tournament_participants.tournament_id AND t.organization_id IS NOT NULL AND club.is_org_privileged(t.organization_id, ARRAY['staff','tournament_manager']))
  );

DROP POLICY "view rounds if tournament visible" ON club.tournament_rounds;
CREATE POLICY "view rounds if tournament visible" ON club.tournament_rounds FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM club.tournaments t WHERE t.id = tournament_rounds.tournament_id
      AND (t.status IN ('registration_open','in_progress','completed')
        OR club.has_role(auth.uid(), 'super_admin')
        OR (t.organization_id IS NOT NULL AND club.is_org_privileged(t.organization_id, ARRAY['staff','tournament_manager'])))
  ));
DROP POLICY "organization admin manage own rounds" ON club.tournament_rounds;
CREATE POLICY "organization admin manage own rounds" ON club.tournament_rounds FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM club.tournaments t WHERE t.id = tournament_rounds.tournament_id AND t.organization_id IS NOT NULL AND club.is_org_privileged(t.organization_id, ARRAY['tournament_manager'])))
  WITH CHECK (EXISTS (SELECT 1 FROM club.tournaments t WHERE t.id = tournament_rounds.tournament_id AND t.organization_id IS NOT NULL AND club.is_org_privileged(t.organization_id, ARRAY['tournament_manager'])));

DROP POLICY "view pairings if tournament visible" ON club.tournament_pairings;
CREATE POLICY "view pairings if tournament visible" ON club.tournament_pairings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM club.tournaments t WHERE t.id = tournament_pairings.tournament_id
      AND (t.status IN ('registration_open','in_progress','completed')
        OR club.has_role(auth.uid(), 'super_admin')
        OR (t.organization_id IS NOT NULL AND club.is_org_privileged(t.organization_id, ARRAY['staff','tournament_manager'])))
  ));
DROP POLICY "organization admin manage own pairings" ON club.tournament_pairings;
CREATE POLICY "organization admin manage own pairings" ON club.tournament_pairings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM club.tournaments t WHERE t.id = tournament_pairings.tournament_id AND t.organization_id IS NOT NULL AND club.is_org_privileged(t.organization_id, ARRAY['tournament_manager'])))
  WITH CHECK (EXISTS (SELECT 1 FROM club.tournaments t WHERE t.id = tournament_pairings.tournament_id AND t.organization_id IS NOT NULL AND club.is_org_privileged(t.organization_id, ARRAY['tournament_manager'])));

-- ============ CLASSES: assistant_coach can update org classes and mark attendance; staff gets read access ============
DROP POLICY "view classes if participant or admin" ON club.classes;
CREATE POLICY "view classes if participant or admin" ON club.classes FOR SELECT TO authenticated
  USING (
    club.has_role(auth.uid(), 'super_admin')
    OR tutor_id = auth.uid()
    OR (organization_id IS NOT NULL AND club.is_org_privileged(organization_id, ARRAY['staff','tournament_manager','assistant_coach']))
    OR EXISTS (SELECT 1 FROM club.class_enrollments e WHERE e.class_id = classes.id AND e.user_id = auth.uid())
  );

CREATE POLICY "assistant coach update org classes" ON club.classes FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND club.is_org_privileged(organization_id, ARRAY['assistant_coach']))
  WITH CHECK (organization_id IS NOT NULL AND club.is_org_privileged(organization_id, ARRAY['assistant_coach']));

DROP POLICY "view own enrollments" ON club.class_enrollments;
CREATE POLICY "view own enrollments" ON club.class_enrollments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR club.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM club.classes c WHERE c.id = class_enrollments.class_id AND c.tutor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM club.classes c WHERE c.id = class_enrollments.class_id AND c.organization_id IS NOT NULL AND club.is_org_privileged(c.organization_id, ARRAY['staff','tournament_manager','assistant_coach']))
  );

CREATE POLICY "assistant coach mark attendance" ON club.class_enrollments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM club.classes c WHERE c.id = class_enrollments.class_id AND c.organization_id IS NOT NULL AND club.is_org_privileged(c.organization_id, ARRAY['assistant_coach'])))
  WITH CHECK (EXISTS (SELECT 1 FROM club.classes c WHERE c.id = class_enrollments.class_id AND c.organization_id IS NOT NULL AND club.is_org_privileged(c.organization_id, ARRAY['assistant_coach'])));

-- ============ ORGANIZATION ROSTER: staff/tournament_manager/assistant_coach can see the roster ============
DROP POLICY "view organization memberships if owner" ON club.organization_memberships;
CREATE POLICY "view organization memberships if owner" ON club.organization_memberships FOR SELECT TO authenticated
  USING (
    club.has_role(auth.uid(), 'super_admin')
    OR club.is_org_privileged(organization_id, ARRAY['staff','tournament_manager','assistant_coach'])
  );
