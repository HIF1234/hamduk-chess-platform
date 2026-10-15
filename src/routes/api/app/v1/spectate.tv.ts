import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** TV: the single public game with the most spectators right now. */
export const Route = createFileRoute("/api/app/v1/spectate/tv")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { getTopLiveGame } = await import("@/lib/app.server");
        return getTopLiveGame(null);
      }),
    },
  },
});
