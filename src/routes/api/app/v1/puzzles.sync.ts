import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** Upload offline attempts: { attempts: [{ puzzleId, success }] }, oldest first. */
export const Route = createFileRoute("/api/app/v1/puzzles/sync")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { syncPuzzleAttempts } = await import("@/lib/app.server");
        return syncPuzzleAttempts(ctx, await body(request));
      }),
    },
  },
});
