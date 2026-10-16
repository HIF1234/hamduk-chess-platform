import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** Opens a battle only reachable by link, to challenge a friend. */
export const Route = createFileRoute("/api/app/v1/puzzles/battle/create")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { createPrivatePuzzleBattle } = await import("@/lib/puzzle-battle.app.server");
        return createPrivatePuzzleBattle(ctx);
      }),
    },
  },
});
