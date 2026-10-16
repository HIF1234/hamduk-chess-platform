import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, query } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** A puzzle stream for one Puzzle Streak run, ascending difficulty. ?count= */
export const Route = createFileRoute("/api/app/v1/puzzles/streak/stream")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { getStreakStream } = await import("@/lib/puzzle-streak.app.server");
        return getStreakStream(ctx, query(request));
      }),
    },
  },
});
