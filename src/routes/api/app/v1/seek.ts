import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** POST { timeControl: "5+0", variant? }: join or open a matchmaking seek. Returns
 *  { gameId } when paired at once, else { gameId: null } and the app waits on Realtime.
 *  DELETE: leave the queue. */
export const Route = createFileRoute("/api/app/v1/seek")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { findOrJoinMatch } = await import("@/lib/matchmaking.functions");
        return findOrJoinMatch({ data: (await body(request)) as never });
      }),
      DELETE: appEndpoint(async () => {
        const { cancelQueue } = await import("@/lib/matchmaking.functions");
        return cancelQueue();
      }),
    },
  },
});
