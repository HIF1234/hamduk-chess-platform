import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** GET: load one saved analysis (anyone with the link). DELETE: remove it (owner only). */
export const Route = createFileRoute("/api/app/v1/analyses/$id")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request, params }) => {
        const ctx = await authenticateRequest(request);
        const { getSavedAnalysis } = await import("@/lib/app.server");
        return getSavedAnalysis(ctx, params.id);
      }),
      DELETE: appEndpoint(async ({ request, params }) => {
        const ctx = await authenticateRequest(request);
        const { deleteSavedAnalysis } = await import("@/lib/app.server");
        return deleteSavedAnalysis(ctx, params.id);
      }),
    },
  },
});
