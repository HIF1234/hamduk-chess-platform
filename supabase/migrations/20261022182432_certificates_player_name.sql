-- public.profiles has no "full name" (it's username-only); rename to match what's actually
-- stored, before anything depends on the wrong name. Table has no rows yet.
ALTER TABLE public.certificates RENAME COLUMN full_name TO player_name;
