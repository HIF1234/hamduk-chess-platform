import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, query } from "@/lib/app-api.server";

/** My games in progress and recent finished ones. */
export const Route = createFileRoute("/api/app/v1/games/")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const { listMyGames } = await import("@/lib/app.functions");
        return listMyGames({ data: query(request) });
      }),
    },
  },
});
