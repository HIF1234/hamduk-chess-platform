-- Puzzle Battle: two players race through the same puzzles. First to 5 solved wins;
-- after 3 minutes the higher score wins. All writes go through the server (service role).

CREATE TABLE IF NOT EXISTS public.puzzle_battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player_b uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_private boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','active','finished','cancelled')),
  puzzle_ids uuid[] NOT NULL,
  a_rating int NOT NULL DEFAULT 1200,
  a_index int NOT NULL DEFAULT 0,
  b_index int NOT NULL DEFAULT 0,
  a_score int NOT NULL DEFAULT 0,
  b_score int NOT NULL DEFAULT 0,
  winner uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at timestamptz,
  ends_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS puzzle_battles_waiting_idx
  ON public.puzzle_battles (created_at) WHERE status = 'waiting' AND NOT is_private;
CREATE INDEX IF NOT EXISTS puzzle_battles_a_idx ON public.puzzle_battles (player_a, created_at DESC);
CREATE INDEX IF NOT EXISTS puzzle_battles_b_idx ON public.puzzle_battles (player_b, created_at DESC);

ALTER TABLE public.puzzle_battles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players see their battles" ON public.puzzle_battles;
CREATE POLICY "Players see their battles" ON public.puzzle_battles
  FOR SELECT TO authenticated
  USING (auth.uid() = player_a OR auth.uid() = player_b);
REVOKE INSERT, UPDATE, DELETE ON public.puzzle_battles FROM anon, authenticated;
GRANT SELECT ON public.puzzle_battles TO authenticated;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.puzzle_battles;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 20 puzzles climbing from about 300 below to 400 above the player's puzzle rating.
CREATE OR REPLACE FUNCTION public.puzzle_battle_pick(p_rating int)
RETURNS uuid[] LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT array_agg(id ORDER BY rating) FROM (
    SELECT id, rating FROM public.puzzles
    WHERE approved AND rating BETWEEN greatest(400, p_rating - 300) AND p_rating + 400
    ORDER BY random() LIMIT 20
  ) t;
$$;

-- Ends a battle whose clock has run out. Returns the (possibly updated) row.
CREATE OR REPLACE FUNCTION public.puzzle_battle_settle(p_battle uuid)
RETURNS public.puzzle_battles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.puzzle_battles;
BEGIN
  SELECT * INTO v FROM public.puzzle_battles WHERE id = p_battle FOR UPDATE;
  IF v.status = 'active' AND now() >= v.ends_at THEN
    UPDATE public.puzzle_battles SET
      status = 'finished', finished_at = now(),
      winner = CASE WHEN v.a_score > v.b_score THEN v.player_a
                    WHEN v.b_score > v.a_score THEN v.player_b END
    WHERE id = p_battle RETURNING * INTO v;
  END IF;
  RETURN v;
END $$;

-- Records one answer. The server has already checked the moves against the solution.
CREATE OR REPLACE FUNCTION public.puzzle_battle_answer(p_user uuid, p_battle uuid, p_index int, p_correct boolean)
RETURNS public.puzzle_battles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.puzzle_battles;
  v_is_a boolean;
  v_at int;
BEGIN
  v := public.puzzle_battle_settle(p_battle);
  IF v.id IS NULL THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF p_user NOT IN (v.player_a, coalesce(v.player_b, v.player_a)) THEN RAISE EXCEPTION 'Not your battle'; END IF;
  IF v.status <> 'active' OR now() < v.started_at THEN RETURN v; END IF;
  v_is_a := p_user = v.player_a;
  v_at := CASE WHEN v_is_a THEN v.a_index ELSE v.b_index END;
  IF p_index <> v_at THEN RETURN v; END IF;

  IF v_is_a THEN
    UPDATE public.puzzle_battles SET a_index = a_index + 1, a_score = a_score + p_correct::int
    WHERE id = p_battle RETURNING * INTO v;
  ELSE
    UPDATE public.puzzle_battles SET b_index = b_index + 1, b_score = b_score + p_correct::int
    WHERE id = p_battle RETURNING * INTO v;
  END IF;

  IF v.a_score >= 5 OR v.b_score >= 5
     OR (v.a_index >= cardinality(v.puzzle_ids) AND v.b_index >= cardinality(v.puzzle_ids)) THEN
    UPDATE public.puzzle_battles SET
      status = 'finished', finished_at = now(),
      winner = CASE WHEN v.a_score > v.b_score THEN v.player_a
                    WHEN v.b_score > v.a_score THEN v.player_b END
    WHERE id = p_battle RETURNING * INTO v;
  END IF;
  RETURN v;
END $$;

REVOKE EXECUTE ON FUNCTION public.puzzle_battle_pick(int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.puzzle_battle_settle(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.puzzle_battle_answer(uuid, uuid, int, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.puzzle_battle_pick(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.puzzle_battle_settle(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.puzzle_battle_answer(uuid, uuid, int, boolean) TO service_role;
