import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** I'm back on the game screen; cancels the opponent's countdown. */
export const Route = createFileRoute("/api/app/v1/games/$id/back")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ params }) => {
        const { reconnect } = await import("@/lib/presence.functions");
        return reconnect({ data: { gameId: params.id } });
      }),
    },
  },
});
