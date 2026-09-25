import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** One game with both players and the server time (for clock sync). */
export const Route = createFileRoute("/api/app/v1/games/$id")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ params }) => {
        const { getGameForApp } = await import("@/lib/app.functions");
        return getGameForApp({ data: { gameId: params.id } });
      }),
    },
  },
});
