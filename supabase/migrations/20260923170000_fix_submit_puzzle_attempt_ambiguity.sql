-- submit_puzzle_attempt declared variables with the same names as user_puzzle_stats
-- columns (best_streak, ...), so every call failed with 'column reference is
-- ambiguous'. Variables are renamed with a v_ prefix.
CREATE OR REPLACE FUNCTION public.submit_puzzle_attempt(
  p_puzzle_id UUID,
  p_success BOOLEAN
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  pz_rating INT;
  cur_rating INT;
  cur_box INT;
  new_box INT;
  due_interval INTERVAL;
  expected FLOAT;
  delta INT;
  new_rating INT;
  today DATE := (now() AT TIME ZONE 'UTC')::DATE;
  v_cur_streak INT;
  v_best_streak INT;
  v_last_date DATE;
  my_tier subscription_tier_enum;
  used_today INT;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT rating INTO pz_rating FROM public.puzzles WHERE id = p_puzzle_id;
  IF pz_rating IS NULL THEN RAISE EXCEPTION 'puzzle not found'; END IF;

  -- Free tier: 20 distinct puzzles per UTC day. Retrying a puzzle already
  -- attempted today does not count again.
  SELECT subscription_tier INTO my_tier FROM public.profiles WHERE id = me;
  used_today := public.puzzles_attempted_today(me);
  IF COALESCE(my_tier, 'free') = 'free' AND used_today >= public.free_daily_puzzle_limit()
     AND NOT EXISTS (
       SELECT 1 FROM public.puzzle_attempts
       WHERE user_id = me AND puzzle_id = p_puzzle_id
         AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
     ) THEN
    RAISE EXCEPTION 'daily_puzzle_limit' USING HINT = 'Free accounts can solve 20 puzzles a day. Upgrade to Hamduk Plus for unlimited puzzles.';
  END IF;

  INSERT INTO public.puzzle_attempts (user_id, puzzle_id, correct) VALUES (me, p_puzzle_id, p_success);

  -- Seed user stats
  INSERT INTO public.user_puzzle_stats (user_id) VALUES (me) ON CONFLICT DO NOTHING;
  SELECT rating, current_streak, best_streak, last_solved_date
    INTO cur_rating, v_cur_streak, v_best_streak, v_last_date
    FROM public.user_puzzle_stats WHERE user_id = me FOR UPDATE;

  expected := 1.0 / (1.0 + power(10, (pz_rating - cur_rating) / 400.0));
  delta := round(20 * ((CASE WHEN p_success THEN 1 ELSE 0 END) - expected));
  new_rating := greatest(400, cur_rating + delta);

  -- Existing attempt?
  SELECT leitner_box INTO cur_box FROM public.puzzle_ratings
    WHERE user_id = me AND puzzle_id = p_puzzle_id FOR UPDATE;
  cur_box := COALESCE(cur_box, 1);

  IF p_success THEN
    new_box := least(5, cur_box + 1);
  ELSE
    new_box := 1;
  END IF;

  due_interval := (CASE new_box
    WHEN 1 THEN INTERVAL '1 day'
    WHEN 2 THEN INTERVAL '3 days'
    WHEN 3 THEN INTERVAL '7 days'
    WHEN 4 THEN INTERVAL '21 days'
    ELSE INTERVAL '60 days'
  END);

  INSERT INTO public.puzzle_ratings (user_id, puzzle_id, success, leitner_box, next_due_at, solved_at)
    VALUES (me, p_puzzle_id, p_success, new_box, now() + due_interval,
            CASE WHEN p_success THEN now() ELSE NULL END)
    ON CONFLICT (user_id, puzzle_id) DO UPDATE SET
      success = EXCLUDED.success,
      attempts = public.puzzle_ratings.attempts + 1,
      leitner_box = EXCLUDED.leitner_box,
      next_due_at = EXCLUDED.next_due_at,
      solved_at = COALESCE(EXCLUDED.solved_at, public.puzzle_ratings.solved_at),
      updated_at = now();

  -- Streak logic
  IF p_success THEN
    IF v_last_date IS NULL OR v_last_date < today - INTERVAL '1 day' THEN
      v_cur_streak := 1;
    ELSIF v_last_date = today - INTERVAL '1 day' THEN
      v_cur_streak := v_cur_streak + 1;
    END IF;
    v_best_streak := greatest(v_best_streak, v_cur_streak);
    v_last_date := today;
  END IF;

  UPDATE public.user_puzzle_stats SET
    rating = new_rating,
    solved_count = solved_count + (CASE WHEN p_success THEN 1 ELSE 0 END),
    failed_count = failed_count + (CASE WHEN p_success THEN 0 ELSE 1 END),
    current_streak = v_cur_streak,
    best_streak = v_best_streak,
    last_solved_date = v_last_date,
    updated_at = now()
  WHERE user_id = me;

  RETURN jsonb_build_object(
    'rating', new_rating,
    'delta', new_rating - cur_rating,
    'leitner_box', new_box,
    'next_due_at', now() + due_interval,
    'remaining_today', CASE WHEN COALESCE(my_tier, 'free') = 'free'
      THEN greatest(0, public.free_daily_puzzle_limit() - public.puzzles_attempted_today(me))
      ELSE NULL END
  );
END;
$$;
