-- A self-reported chess title, same idea as chess.com's: restricted to the real, recognized
-- FIDE/national-federation abbreviations (not free text), so a player can claim "GM" but
-- can't claim "Grand Wizard". There's no FIDE-database verification here (that would mean
-- syncing FIDE's rating list and matching names, a much larger project) -- it's trust-based
-- like every other self-reported profile field (country, state). Players without a real
-- title get an in-house "Expert" badge once their own rating crosses 2200, computed from
-- rating rather than stored, so it's never stale.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fide_title text
  CHECK (fide_title IN ('GM', 'WGM', 'IM', 'WIM', 'FM', 'WFM', 'CM', 'WCM', 'NM', 'WNM'));
