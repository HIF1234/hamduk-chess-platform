import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, query } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** Top Storm scores: ?scope=daily|alltime&limit= */
export const Route = createFileRoute("/api/app/v1/puzzles/storm/leaderboard")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { getStormLeaderboard } = await import("@/lib/app.server");
        return getStormLeaderboard(ctx, query(request));
      }),
    },
  },
});
