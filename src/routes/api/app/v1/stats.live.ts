import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** "214 playing, 37 looking for 5 min" above the time-control tiles. */
export const Route = createFileRoute("/api/app/v1/stats/live")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { getLiveCounts } = await import("@/lib/app.server");
        return getLiveCounts(null);
      }),
    },
  },
});
