-- Offline puzzle packs for the mobile app: unseen approved puzzles in a rating band.
CREATE OR REPLACE FUNCTION public.puzzle_pack(p_user uuid, p_min int, p_max int, p_limit int)
RETURNS TABLE (id uuid, fen text, solution text[], themes text[], rating int)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.fen, p.solution, p.themes, p.rating
  FROM public.puzzles p
  WHERE p.approved AND p.rating BETWEEN p_min AND p_max
    AND NOT EXISTS (SELECT 1 FROM public.puzzle_ratings r WHERE r.user_id = p_user AND r.puzzle_id = p.id)
  ORDER BY random()
  LIMIT least(p_limit, 500);
$$;
REVOKE EXECUTE ON FUNCTION public.puzzle_pack(uuid, int, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.puzzle_pack(uuid, int, int, int) TO service_role;
