import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** Record a finished bot game played on the device. */
export const Route = createFileRoute("/api/app/v1/bot-games")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { recordBotGame } = await import("@/lib/ratings.functions");
        return recordBotGame({ data: await body(request) });
      }),
    },
  },
});
