-- Guest cleanup. Guests idle for 30 days are deleted; any finished games they played are
-- handed to one placeholder account so their opponents keep their history.

-- Moves games that point at the given guests over to the placeholder, and returns the
-- guests that are now safe to delete. Skips anyone with a game still in progress.
CREATE OR REPLACE FUNCTION public.guest_cleanup_prepare(p_placeholder uuid, p_limit int)
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ids uuid[];
BEGIN
  SELECT coalesce(array_agg(p.id), '{}') INTO v_ids FROM (
    SELECT p.id FROM public.profiles p
    WHERE p.is_guest
      AND p.id <> p_placeholder
      AND coalesce(p.last_active_at, p.created_at) < now() - interval '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.games g
        WHERE (g.white_id = p.id OR g.black_id = p.id) AND g.status <> 'finished'
      )
    ORDER BY coalesce(p.last_active_at, p.created_at)
    LIMIT p_limit
  ) p;
  IF cardinality(v_ids) = 0 THEN RETURN v_ids; END IF;

  UPDATE public.games SET white_id = p_placeholder WHERE white_id = ANY(v_ids);
  UPDATE public.games SET black_id = p_placeholder WHERE black_id = ANY(v_ids);
  UPDATE public.games SET winner_id = p_placeholder WHERE winner_id = ANY(v_ids);
  UPDATE public.moves SET by_user = p_placeholder WHERE by_user = ANY(v_ids);
  RETURN v_ids;
END $$;
REVOKE EXECUTE ON FUNCTION public.guest_cleanup_prepare(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_cleanup_prepare(uuid, int) TO service_role;
