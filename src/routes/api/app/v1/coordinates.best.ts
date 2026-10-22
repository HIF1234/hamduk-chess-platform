import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** GET: this player's coordinates-trainer best score -> { best }. POST: report a finished
 *  round's score -- { score } -> { best } (unchanged if not a new best). */
export const Route = createFileRoute("/api/app/v1/coordinates/best")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { getMyCoordinateDrillBest } = await import("@/lib/app.server");
        return getMyCoordinateDrillBest(ctx);
      }),
      POST: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { submitCoordinateDrillScore } = await import("@/lib/app.server");
        return submitCoordinateDrillScore(ctx, await body(request));
      }),
    },
  },
});
