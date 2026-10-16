import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, query } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** Plus/Gold — a puzzle stream for one Storm run. ?count=&minRating=&maxRating= */
export const Route = createFileRoute("/api/app/v1/puzzles/storm/stream")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { getStormStream } = await import("@/lib/app.server");
        return getStormStream(ctx, query(request));
      }),
    },
  },
});
