import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** Plus/Gold — submit a finished Storm run: { score, solved, mistakes, durationSec? }. */
export const Route = createFileRoute("/api/app/v1/puzzles/storm/submit")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { submitStormRun } = await import("@/lib/app.server");
        return submitStormRun(ctx, await body(request));
      }),
    },
  },
});
