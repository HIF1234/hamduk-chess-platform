import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** Ask for a takeback, or answer one with { accept: true | false }. */
export const Route = createFileRoute("/api/app/v1/games/$id/takeback")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request, params }) => {
        const { requestTakeback, respondTakeback } = await import("@/lib/game-actions.functions");
        const b = (await body(request)) as { accept?: boolean };
        if (typeof b.accept === "boolean") {
          return respondTakeback({ data: { gameId: params.id, accept: b.accept } });
        }
        return requestTakeback({ data: { gameId: params.id } });
      }),
    },
  },
});
