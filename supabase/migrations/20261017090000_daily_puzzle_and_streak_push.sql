-- Daily puzzle push (08:00 Lagos) and streak-reminder push (20:00 Lagos). Free for
-- everyone -- no tier gate, unlike the existing Plus/Gold daily puzzle email.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_puzzle_pushed_on date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_reminder_pushed_on date;

CREATE OR REPLACE FUNCTION public.daily_puzzle_push_candidates(p_today date, p_limit int)
RETURNS TABLE (id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE NOT p.is_guest
    AND p.banned_at IS NULL
    AND EXISTS (SELECT 1 FROM public.device_tokens d WHERE d.user_id = p.id)
    AND (p.daily_puzzle_pushed_on IS NULL OR p.daily_puzzle_pushed_on < p_today)
  ORDER BY p.last_active_at DESC
  LIMIT p_limit;
$$;
REVOKE EXECUTE ON FUNCTION public.daily_puzzle_push_candidates(date, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_puzzle_push_candidates(date, int) TO service_role;

CREATE OR REPLACE FUNCTION public.streak_reminder_push_candidates(p_today date, p_limit int)
RETURNS TABLE (id uuid, current_streak int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, s.current_streak
  FROM public.profiles p
  JOIN public.user_puzzle_stats s ON s.user_id = p.id
  WHERE NOT p.is_guest
    AND p.banned_at IS NULL
    AND s.current_streak > 0
    AND (s.last_solved_date IS NULL OR s.last_solved_date < p_today)
    AND EXISTS (SELECT 1 FROM public.device_tokens d WHERE d.user_id = p.id)
    AND (p.streak_reminder_pushed_on IS NULL OR p.streak_reminder_pushed_on < p_today)
  ORDER BY s.current_streak DESC
  LIMIT p_limit;
$$;
REVOKE EXECUTE ON FUNCTION public.streak_reminder_push_candidates(date, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.streak_reminder_push_candidates(date, int) TO service_role;
