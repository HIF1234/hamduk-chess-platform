import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** GET: this player's endgame-drill progress map. POST: record a finished attempt --
 *  { endgameId, completed, moveCount }. Calls the web's own endgames.functions directly. */
export const Route = createFileRoute("/api/app/v1/endgames/progress")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { getMyEndgameProgress } = await import("@/lib/endgames.functions");
        return getMyEndgameProgress();
      }),
      POST: appEndpoint(async ({ request }) => {
        const { recordEndgameAttempt } = await import("@/lib/endgames.functions");
        return recordEndgameAttempt({ data: await body(request) });
      }),
    },
  },
});
