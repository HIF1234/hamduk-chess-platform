import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** My recent Storm runs and personal best. */
export const Route = createFileRoute("/api/app/v1/puzzles/storm/stats")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { getMyStormStats } = await import("@/lib/app.server");
        return getMyStormStats(ctx);
      }),
    },
  },
});
