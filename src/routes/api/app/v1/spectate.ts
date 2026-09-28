import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Public games open to spectate right now. */
export const Route = createFileRoute("/api/app/v1/spectate")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { listLiveGames } = await import("@/lib/app.server");
        return listLiveGames(null);
      }),
    },
  },
});
