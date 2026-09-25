import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** One game with both players and the server time (for clock sync). */
export const Route = createFileRoute("/api/app/v1/games/$id")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request, params }) => {
        const ctx = await authenticateRequest(request);
        const { getGameForApp } = await import("@/lib/app.server");
        return getGameForApp(ctx, { gameId: params.id });
      }),
    },
  },
});
