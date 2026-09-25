import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, query } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** My games in progress and recent finished ones. */
export const Route = createFileRoute("/api/app/v1/games/")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { listMyGames } = await import("@/lib/app.server");
        return listMyGames(ctx, query(request));
      }),
    },
  },
});
