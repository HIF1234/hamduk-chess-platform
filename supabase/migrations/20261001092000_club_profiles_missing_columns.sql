-- Three columns (membership_type, billing_cycle, lecture_level) exist on the live club
-- project's public.profiles but were never captured in any of its 16 migration files --
-- undocumented schema drift, added directly against the database at some point. Adding them
-- here so club.profiles actually matches what the app writes to on signup/onboarding.
ALTER TABLE club.profiles
  ADD COLUMN IF NOT EXISTS membership_type text CHECK (membership_type IN ('club_only', 'club_plus_lecture')),
  ADD COLUMN IF NOT EXISTS billing_cycle text CHECK (billing_cycle IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS lecture_level text CHECK (lecture_level IN ('beginner', 'intermediate', 'advanced'));
