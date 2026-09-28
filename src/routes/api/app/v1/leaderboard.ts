import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, query } from "@/lib/app-api.server";

/** Top players by rating: ?category=blitz&variant=standard&country=NG&month=true&page=1 */
export const Route = createFileRoute("/api/app/v1/leaderboard")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const { getLeaderboard } = await import("@/lib/app.server");
        return getLeaderboard(null, query(request));
      }),
    },
  },
});
