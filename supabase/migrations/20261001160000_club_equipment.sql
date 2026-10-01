-- Section 20 of the product vision: physical/equipment management -- boards, clocks, sets,
-- books an organization owns, and who currently has them checked out. Activates the
-- equipment_manager role_in_org value added in §10, which until now had no permissions wired
-- to it at all.
--
-- Internal operations tooling, not a member-facing feature -- visibility is scoped to the org
-- owner and privileged roles (equipment_manager can manage, staff can view), not every member.

CREATE TABLE club.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES club.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('board', 'clock', 'pieces', 'books', 'other')),
  condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('new', 'good', 'fair', 'poor')),
  quantity_total INTEGER NOT NULL DEFAULT 1 CHECK (quantity_total >= 0),
  quantity_available INTEGER NOT NULL DEFAULT 1 CHECK (quantity_available >= 0),
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (quantity_available <= quantity_total)
);
ALTER TABLE club.equipment ENABLE ROW LEVEL SECURITY;

CREATE TABLE club.equipment_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES club.equipment(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES club.organizations(id) ON DELETE CASCADE,
  checked_out_to UUID NOT NULL REFERENCES auth.users(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  checked_out_by UUID REFERENCES auth.users(id),
  checked_out_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ
);
ALTER TABLE club.equipment_checkouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "privileged view equipment" ON club.equipment FOR SELECT TO authenticated
  USING (club.is_org_privileged(organization_id, ARRAY['equipment_manager', 'staff']));
CREATE POLICY "equipment manager manage equipment" ON club.equipment FOR ALL TO authenticated
  USING (club.is_org_privileged(organization_id, ARRAY['equipment_manager']))
  WITH CHECK (club.is_org_privileged(organization_id, ARRAY['equipment_manager']));
CREATE POLICY "super admin manage equipment" ON club.equipment FOR ALL TO authenticated
  USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "privileged view checkouts" ON club.equipment_checkouts FOR SELECT TO authenticated
  USING (club.is_org_privileged(organization_id, ARRAY['equipment_manager', 'staff']) OR checked_out_to = auth.uid());
CREATE POLICY "equipment manager manage checkouts" ON club.equipment_checkouts FOR ALL TO authenticated
  USING (club.is_org_privileged(organization_id, ARRAY['equipment_manager']))
  WITH CHECK (club.is_org_privileged(organization_id, ARRAY['equipment_manager']));
CREATE POLICY "super admin manage checkouts" ON club.equipment_checkouts FOR ALL TO authenticated
  USING (club.has_role(auth.uid(), 'super_admin')) WITH CHECK (club.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "mfa_required" ON club.equipment AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY "mfa_required" ON club.equipment_checkouts AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));

CREATE TRIGGER equipment_touch_updated_at BEFORE UPDATE ON club.equipment
  FOR EACH ROW EXECUTE FUNCTION club.touch_updated_at();
