-- chess.com requires a government ID, a photo holding a dated sign, and a copy of the title
-- certificate before a title shows on a profile -- it is never just a self-selected claim.
-- We don't collect ID documents here (a much larger, sensitive-data undertaking), but a claim
-- must still be checked against something real before it's shown to anyone else: the FIDE ID
-- a player submits, cross-checked by staff against FIDE's own public ratings list
-- (ratings.fide.com) before fide_title_verified is set. Unverified claims stay visible only to
-- the player who made them (so they can see it's pending), never on a player bar.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fide_id text,
  ADD COLUMN IF NOT EXISTS fide_title_verified boolean NOT NULL DEFAULT false;
