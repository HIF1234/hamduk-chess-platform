import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** My recent Puzzle Streak runs and personal best. */
export const Route = createFileRoute("/api/app/v1/puzzles/streak/stats")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { getMyStreakStats } = await import("@/lib/puzzle-streak.app.server");
        return getMyStreakStats(ctx);
      }),
    },
  },
});
