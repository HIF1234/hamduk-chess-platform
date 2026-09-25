import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Ask the server to end the game if a clock has run out. */
export const Route = createFileRoute("/api/app/v1/games/$id/flag")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ params }) => {
        const { checkFlag } = await import("@/lib/game-actions.functions");
        return checkFlag({ data: { gameId: params.id } });
      }),
    },
  },
});
