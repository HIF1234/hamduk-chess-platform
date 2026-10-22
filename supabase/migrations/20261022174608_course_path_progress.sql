-- Course path: "Six levels named after the pieces, Pawn to King. Each unit is a lesson,
-- practice puzzles, a short quiz and a bot to beat." One row per player per unit; the four
-- flags are set independently as each part is finished, and completed_at is stamped once
-- all four are true. Unit content itself (lesson/puzzle theme/quiz/bot) is static data in
-- src/lib/course-data.ts, not stored here.

CREATE TABLE public.user_course_progress (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_id text NOT NULL,
  lesson_done boolean NOT NULL DEFAULT false,
  quiz_passed boolean NOT NULL DEFAULT false,
  puzzles_done boolean NOT NULL DEFAULT false,
  bot_beaten boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, unit_id)
);

GRANT SELECT, INSERT, UPDATE ON public.user_course_progress TO authenticated;
GRANT ALL ON public.user_course_progress TO service_role;
ALTER TABLE public.user_course_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own course progress"
  ON public.user_course_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY mfa_required ON public.user_course_progress AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
