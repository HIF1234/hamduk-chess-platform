import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

export const Route = createFileRoute("/api/app/v1/tournaments/$id/withdraw")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ params }) => {
        const { withdrawFromTournament } = await import("@/lib/tournaments.functions");
        return withdrawFromTournament({ data: { tournamentId: params.id } });
      }),
    },
  },
});
