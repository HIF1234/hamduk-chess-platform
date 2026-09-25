import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Resign. */
export const Route = createFileRoute("/api/app/v1/games/$id/resign")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ params }) => {
        const { resignGame } = await import("@/lib/matchmaking.functions");
        return resignGame({ data: { gameId: params.id } });
      }),
    },
  },
});
