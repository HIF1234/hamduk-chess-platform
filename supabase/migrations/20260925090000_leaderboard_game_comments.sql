-- Leaderboards per time-control category and variant, filterable by country,
-- friends and "active this month", with ranks computed in the database.
CREATE INDEX IF NOT EXISTS ratings_tc_variant_rating_idx ON public.ratings (time_control, variant, rating DESC);
CREATE INDEX IF NOT EXISTS games_rated_ended_idx ON public.games (ended_at DESC) WHERE status = 'completed' AND rated;

CREATE OR REPLACE FUNCTION public.leaderboard(
  p_tcs text[],
  p_variant text DEFAULT 'standard',
  p_country text DEFAULT NULL,
  p_friends_of uuid DEFAULT NULL,
  p_month boolean DEFAULT false,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_only uuid DEFAULT NULL
)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  username text,
  country text,
  rating integer,
  games integer,
  wins integer,
  losses integer,
  draws integer,
  games_month integer,
  last_active_at timestamptz,
  total bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH best AS (
    -- A player's best rating across the time controls in the category.
    SELECT DISTINCT ON (r.user_id) r.user_id, r.rating, r.games_played, r.wins, r.losses, r.draws
    FROM public.ratings r
    WHERE r.time_control = ANY (p_tcs) AND r.variant = p_variant AND r.games_played > 0
    ORDER BY r.user_id, r.rating DESC
  ),
  month_games AS (
    SELECT u AS user_id, count(*)::int AS n FROM (
      SELECT white_id AS u FROM public.games
        WHERE status = 'completed' AND rated AND ended_at >= date_trunc('month', now())
          AND time_control = ANY (p_tcs) AND variant = p_variant
      UNION ALL
      SELECT black_id FROM public.games
        WHERE status = 'completed' AND rated AND ended_at >= date_trunc('month', now())
          AND time_control = ANY (p_tcs) AND variant = p_variant
    ) g GROUP BY u
  ),
  friend_ids AS (
    SELECT CASE WHEN f.requester_id = p_friends_of THEN f.addressee_id ELSE f.requester_id END AS user_id
    FROM public.friends f
    WHERE p_friends_of IS NOT NULL AND f.status = 'accepted'
      AND (f.requester_id = p_friends_of OR f.addressee_id = p_friends_of)
    UNION SELECT p_friends_of WHERE p_friends_of IS NOT NULL
  ),
  pool AS (
    SELECT b.*, p.username, p.country, p.last_active_at, COALESCE(m.n, 0) AS games_month
    FROM best b
    JOIN public.profiles p ON p.id = b.user_id AND NOT p.is_guest AND p.banned_at IS NULL
    LEFT JOIN month_games m ON m.user_id = b.user_id
    WHERE (p_country IS NULL OR p.country = p_country)
      AND (p_friends_of IS NULL OR b.user_id IN (SELECT user_id FROM friend_ids))
      AND (NOT p_month OR COALESCE(m.n, 0) > 0)
  ),
  ranked AS (
    SELECT rank() OVER (ORDER BY rating DESC, games_played DESC) AS rk, count(*) OVER () AS total, *
    FROM pool
  )
  SELECT rk, user_id, username, country, rating, games_played, wins, losses, draws, games_month,
         last_active_at, total
  FROM ranked
  WHERE p_only IS NULL OR user_id = p_only
  ORDER BY rk
  LIMIT LEAST(GREATEST(p_limit, 1), 100) OFFSET GREATEST(p_offset, 0);
$$;
GRANT EXECUTE ON FUNCTION public.leaderboard(text[], text, text, uuid, boolean, integer, integer, uuid) TO anon, authenticated;

-- Comments on finished public games, optionally tied to a move.
CREATE TABLE public.game_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ply integer CHECK (ply IS NULL OR ply >= 1),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  likes integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX game_comments_game_idx ON public.game_comments (game_id, created_at);

CREATE TABLE public.game_comment_likes (
  comment_id uuid NOT NULL REFERENCES public.game_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (comment_id, user_id)
);

GRANT SELECT ON public.game_comments TO anon, authenticated;
GRANT SELECT ON public.game_comment_likes TO authenticated;
GRANT ALL ON public.game_comments, public.game_comment_likes TO service_role;
ALTER TABLE public.game_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments on public games are readable"
  ON public.game_comments FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL AND EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.is_public));
CREATE POLICY "Users see their own comment likes"
  ON public.game_comment_likes FOR SELECT TO authenticated USING (user_id = auth.uid());
