import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** GET: this player's progress on every course unit touched. POST: mark one part of a unit
 *  done -- { unitId, step: "lesson"|"quiz"|"puzzles"|"bot" }. */
export const Route = createFileRoute("/api/app/v1/course/progress")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { getMyCourseProgress } = await import("@/lib/app.server");
        return getMyCourseProgress(ctx);
      }),
      POST: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { markCourseStep } = await import("@/lib/app.server");
        return markCourseStep(ctx, await body(request));
      }),
    },
  },
});
