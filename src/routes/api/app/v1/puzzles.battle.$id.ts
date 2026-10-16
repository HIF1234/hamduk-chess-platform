import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** Battle state plus the puzzles once both seats are filled and it's started. */
export const Route = createFileRoute("/api/app/v1/puzzles/battle/$id")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request, params }) => {
        const ctx = await authenticateRequest(request);
        const { getPuzzleBattle } = await import("@/lib/puzzle-battle.app.server");
        return getPuzzleBattle(ctx, { battleId: params.id });
      }),
    },
  },
});
