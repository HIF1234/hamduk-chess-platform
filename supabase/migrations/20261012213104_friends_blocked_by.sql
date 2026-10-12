-- The 'blocked' status on public.friends has existed since it was created but was never
-- reachable from any code path (no blockUser/unblockUser function). This adds the one column
-- needed to implement it properly: which of the two people in the row did the blocking, so
-- only they can undo it and so a block survives regardless of who happened to be
-- requester/addressee when the row was first created (e.g. by a friend request before either
-- side blocked the other).
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES public.profiles(id);
