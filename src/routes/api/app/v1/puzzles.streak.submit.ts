import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** Submits a finished Puzzle Streak run: { streak }. */
export const Route = createFileRoute("/api/app/v1/puzzles/streak/submit")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { submitStreakRun } = await import("@/lib/puzzle-streak.app.server");
        return submitStreakRun(ctx, await body(request));
      }),
    },
  },
});
