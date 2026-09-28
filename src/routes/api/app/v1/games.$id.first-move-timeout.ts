import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Ask the server to abort the game if White never showed up for the first move. */
export const Route = createFileRoute("/api/app/v1/games/$id/first-move-timeout")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ params }) => {
        const { checkFirstMoveTimeout } = await import("@/lib/game-actions.functions");
        return checkFirstMoveTimeout({ data: { gameId: params.id } });
      }),
    },
  },
});
