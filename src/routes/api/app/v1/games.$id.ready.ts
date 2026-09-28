import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** White's client confirms the game screen has loaded; starts the first-move no-show clock. */
export const Route = createFileRoute("/api/app/v1/games/$id/ready")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ params }) => {
        const { confirmGameReady } = await import("@/lib/matchmaking.functions");
        return confirmGameReady({ data: { gameId: params.id } });
      }),
    },
  },
});
