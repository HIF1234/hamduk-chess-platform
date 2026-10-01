-- Section 13 of the product vision: organizations can generate a join code so a member can
-- self-join (e.g. "LIS-CHESS-82F4") instead of only ever being added by an org admin.
-- Joining can be auto-approved, require admin approval, or be disabled -- configurable per org.
-- The code/policy are deliberately NOT added to club.organizations' authenticated column
-- grant (id, name, type, address, student_count, created_at) -- they stay admin-only, reached
-- through SECURITY DEFINER-equivalent server functions (service-role client), same pattern as
-- the rest of this app's admin actions.

ALTER TABLE club.organizations
  ADD COLUMN IF NOT EXISTS join_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS join_policy text NOT NULL DEFAULT 'admin_approval'
    CHECK (join_policy IN ('auto', 'admin_approval', 'parent_approval', 'disabled'));

-- Existing memberships (all admin-added so far) default to 'approved' so nothing already in
-- the table silently becomes invisible/pending. New self-join requests set status explicitly
-- based on the org's join_policy at request time.
ALTER TABLE club.organization_memberships
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- The owner could insert/delete memberships already but had no way to update one (e.g. to
-- approve/reject a pending request) -- add that.
CREATE POLICY "organization owner update memberships" ON club.organization_memberships
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = organization_memberships.organization_id AND o.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM club.organizations o WHERE o.id = organization_memberships.organization_id AND o.owner_user_id = auth.uid()));
