import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** Play a move: { uci: "e2e4", elapsedMs? }. */
export const Route = createFileRoute("/api/app/v1/games/$id/move")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request, params }) => {
        const { submitMove } = await import("@/lib/matchmaking.functions");
        return submitMove({ data: { ...((await body(request)) as object), gameId: params.id } });
      }),
    },
  },
});
