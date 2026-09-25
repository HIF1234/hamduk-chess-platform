import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** Offer a draw, or answer the opponent's offer with { accept: true | false }. */
export const Route = createFileRoute("/api/app/v1/games/$id/draw")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request, params }) => {
        const { offerDraw, respondDraw } = await import("@/lib/game-actions.functions");
        const b = (await body(request)) as { accept?: boolean };
        if (typeof b.accept === "boolean") {
          return respondDraw({ data: { gameId: params.id, accept: b.accept } });
        }
        return offerDraw({ data: { gameId: params.id } });
      }),
    },
  },
});
