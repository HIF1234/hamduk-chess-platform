import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** Takes the empty seat in a private (link-only) battle. */
export const Route = createFileRoute("/api/app/v1/puzzles/battle/$id/join")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request, params }) => {
        const ctx = await authenticateRequest(request);
        const { joinPuzzleBattle } = await import("@/lib/puzzle-battle.app.server");
        return joinPuzzleBattle(ctx, { battleId: params.id });
      }),
    },
  },
});
