import { createFileRoute } from "@tanstack/react-router";
import { withApiKey, json } from "@/lib/api-keys.server";

/** Cron-ready: starts due tournaments and keeps arenas paired. */
export const Route = createFileRoute("/api/public/v1/tournaments/sweep")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        withApiKey(request, "/v1/tournaments/sweep", "tournaments:manage", async () => {
          const { sweepTournaments } = await import("@/lib/tournaments.server");
          const result = await sweepTournaments();
          return json(result);
        }),
    },
  },
});
