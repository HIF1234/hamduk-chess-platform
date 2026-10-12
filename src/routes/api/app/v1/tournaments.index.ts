import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Public tournaments (not scoped to a club), with entrant counts. */
export const Route = createFileRoute("/api/app/v1/tournaments/")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { listTournaments } = await import("@/lib/tournaments.functions");
        return listTournaments();
      }),
    },
  },
});
