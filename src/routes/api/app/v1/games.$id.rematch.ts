import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** Offer a rematch, or accept the opponent's with { accept: true }. Declining needs no call. */
export const Route = createFileRoute("/api/app/v1/games/$id/rematch")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request, params }) => {
        const { offerRematch, acceptRematch } = await import("@/lib/game-actions.functions");
        const b = (await body(request)) as { accept?: boolean };
        if (b.accept === true) return acceptRematch({ data: { gameId: params.id } });
        return offerRematch({ data: { gameId: params.id } });
      }),
    },
  },
});
