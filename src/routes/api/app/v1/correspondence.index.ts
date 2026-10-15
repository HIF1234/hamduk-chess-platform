import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** POST { opponentUsername, daysPerMove: 1|3|7, variant?, color?, notifyByEmail? }: starts a
 *  correspondence (daily) game. GET: your correspondence games, vacation status first. */
export const Route = createFileRoute("/api/app/v1/correspondence/")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { createCorrespondenceGame } = await import("@/lib/correspondence.functions");
        return createCorrespondenceGame({ data: (await body(request)) as never });
      }),
      GET: appEndpoint(async () => {
        const { listCorrespondenceGames } = await import("@/lib/correspondence.functions");
        return listCorrespondenceGames();
      }),
    },
  },
});
