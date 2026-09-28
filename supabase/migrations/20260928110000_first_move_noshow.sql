-- Point 5 of the mobile feedback pass: a player matched into a game shouldn't have their
-- first-move clock (and no-show consequences) start ticking before their client has even
-- loaded the board -- that's exactly what was punishing people on slow connections. White
-- confirms readiness once the game screen has actually rendered; only then does the
-- no-show deadline begin. The real chess clock is untouched by this -- it's a separate,
-- short "did you show up" window that only matters for ply 0.
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS first_move_ready_at timestamptz;

-- Consecutive no-show counter and ban-escalation stage. Reset to 0 whenever a player makes
-- their first move in time (see record_first_move_strike below); never reset by a normal
-- ban/unban so the escalation survives across the 12h ban.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_move_strikes integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_move_ban_stage integer NOT NULL DEFAULT 0;

-- Records one first-move no-show against p_user and applies the escalating consequence:
--   strikes 1-2 (stage 0): nothing but the counter.
--   strike 3 (stage 0->1): 12 hour suspension, counter resets.
--   strikes 1-2 after returning (stage 1): nothing but the counter.
--   strike 3 again (stage 1->2): indefinite suspension flagged "pending review"; the caller
--     (record_first_move_strike is called from app code, not SQL, for the email/push side)
--     is expected to notify admins -- this function only records the ban state.
-- Returns the new stage and strike count so the caller knows whether to notify admins.
CREATE OR REPLACE FUNCTION public.record_first_move_strike(p_user uuid)
RETURNS TABLE(new_strikes integer, new_stage integer, banned_until timestamptz, indefinite boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_strikes integer;
  v_stage integer;
  v_until timestamptz;
  v_indefinite boolean := false;
BEGIN
  SELECT first_move_strikes + 1, first_move_ban_stage INTO v_strikes, v_stage
  FROM public.profiles WHERE id = p_user FOR UPDATE;

  IF v_strikes >= 3 THEN
    IF v_stage = 0 THEN
      v_until := now() + interval '12 hours';
      UPDATE public.profiles SET
        first_move_strikes = 0,
        first_move_ban_stage = 1,
        banned_at = now(),
        banned_reason = 'Repeated first-move no-shows (automatic)',
        suspended_until = v_until
      WHERE id = p_user;
      v_strikes := 0;
      v_stage := 1;
    ELSE
      v_indefinite := true;
      UPDATE public.profiles SET
        first_move_strikes = 0,
        first_move_ban_stage = 2,
        banned_at = now(),
        banned_reason = 'Repeated first-move no-shows -- pending admin review',
        suspended_until = NULL
      WHERE id = p_user;
      v_strikes := 0;
      v_stage := 2;
    END IF;
  ELSE
    UPDATE public.profiles SET first_move_strikes = v_strikes WHERE id = p_user;
  END IF;

  RETURN QUERY SELECT v_strikes, v_stage, v_until, v_indefinite;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_first_move_strike(uuid) TO service_role;

-- A clean first move resets the streak so occasional slow connections never accumulate
-- toward a ban.
CREATE OR REPLACE FUNCTION public.clear_first_move_strikes(p_user uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles SET first_move_strikes = 0 WHERE id = p_user AND first_move_strikes != 0;
$$;
GRANT EXECUTE ON FUNCTION public.clear_first_move_strikes(uuid) TO service_role;
