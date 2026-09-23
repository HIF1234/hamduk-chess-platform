-- User preferences (spec: profiles.preferences JSONB): board theme, sound, email
-- opt-ins. Read and written only through server functions, so the existing
-- column-level SELECT grants on profiles stay unchanged.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
