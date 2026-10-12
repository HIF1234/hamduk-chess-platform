import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Tournament detail: standings, this round's pairings/live boards, and the caller's entry. */
export const Route = createFileRoute("/api/app/v1/tournaments/$id")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ params }) => {
        const { getTournamentDetail } = await import("@/lib/tournaments.functions");
        return getTournamentDetail({ data: { tournamentId: params.id } });
      }),
    },
  },
});
