-- Daily puzzle email for Plus and Gold members who turned it on in Settings.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_puzzle_emailed_on date;

CREATE OR REPLACE FUNCTION public.daily_puzzle_email_candidates(p_today date, p_limit int)
RETURNS TABLE (id uuid, username text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, u.email::text
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE NOT p.is_guest
    AND p.banned_at IS NULL
    AND p.subscription_tier IN ('plus', 'gold')
    AND u.email IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL
    AND coalesce((p.preferences->>'emailDigest')::boolean, false)
    AND p.last_active_at >= p_today - interval '30 days'
    AND (p.daily_puzzle_emailed_on IS NULL OR p.daily_puzzle_emailed_on < p_today)
  ORDER BY p.last_active_at DESC
  LIMIT p_limit;
$$;
REVOKE EXECUTE ON FUNCTION public.daily_puzzle_email_candidates(date, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_puzzle_email_candidates(date, int) TO service_role;
