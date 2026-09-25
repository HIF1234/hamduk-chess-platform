import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Abort before enough moves have been played. */
export const Route = createFileRoute("/api/app/v1/games/$id/abort")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ params }) => {
        const { abortGame } = await import("@/lib/game-actions.functions");
        return abortGame({ data: { gameId: params.id } });
      }),
    },
  },
});
