import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Tell the opponent I've left the game screen (app backgrounded). Starts their 30s grace countdown. */
export const Route = createFileRoute("/api/app/v1/games/$id/away")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ params }) => {
        const { markDisconnected } = await import("@/lib/presence.functions");
        return markDisconnected({ data: { gameId: params.id } });
      }),
    },
  },
});
