import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** Cancels a battle you created, while it's still waiting for an opponent. */
export const Route = createFileRoute("/api/app/v1/puzzles/battle/$id/cancel")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request, params }) => {
        const ctx = await authenticateRequest(request);
        const { cancelPuzzleBattle } = await import("@/lib/puzzle-battle.app.server");
        return cancelPuzzleBattle(ctx, { battleId: params.id });
      }),
    },
  },
});
