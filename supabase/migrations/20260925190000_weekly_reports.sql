-- Weekly summary emails. The cron tick sends them in small batches from Monday 07:00 UTC,
-- to players who were active in the last week and haven't switched the email off.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_report_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.weekly_report_candidates(p_week_start timestamptz, p_limit int)
RETURNS TABLE (id uuid, username text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, u.email::text
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE NOT p.is_guest
    AND p.banned_at IS NULL
    AND u.email IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL
    AND coalesce((p.preferences->>'weeklySummary')::boolean, true)
    AND p.last_active_at >= p_week_start - interval '7 days'
    AND (p.weekly_report_sent_at IS NULL OR p.weekly_report_sent_at < p_week_start)
  ORDER BY p.last_active_at DESC
  LIMIT p_limit;
$$;
REVOKE EXECUTE ON FUNCTION public.weekly_report_candidates(timestamptz, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_report_candidates(timestamptz, int) TO service_role;
