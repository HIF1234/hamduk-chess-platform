import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** GET: this player's saved analyses, most recent first. POST: save one -- { title, notes?,
 *  startFen, moves?, ply?, orientation? } -> { id }. */
export const Route = createFileRoute("/api/app/v1/analyses")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { listSavedAnalyses } = await import("@/lib/app.server");
        return listSavedAnalyses(ctx);
      }),
      POST: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { saveAnalysis } = await import("@/lib/app.server");
        return saveAnalysis(ctx, await body(request));
      }),
    },
  },
});
