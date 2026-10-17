import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** Record an attempt on a "from your games" puzzle: { success }. No rating impact. */
export const Route = createFileRoute("/api/app/v1/puzzles/from-games/$id/attempt")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request, params }) => {
        const ctx = await authenticateRequest(request);
        const { submitPersonalPuzzleAttempt } = await import("@/lib/app.server");
        return submitPersonalPuzzleAttempt(ctx, params.id, await body(request));
      }),
    },
  },
});
