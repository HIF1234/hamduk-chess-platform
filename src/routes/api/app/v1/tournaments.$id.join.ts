import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Join a tournament. Response may include requiresPayment: true for a paid entry -- the app
 *  then sends the player to the website to complete checkout (no in-app Paystack flow yet). */
export const Route = createFileRoute("/api/app/v1/tournaments/$id/join")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ params }) => {
        const { joinTournament } = await import("@/lib/tournaments.functions");
        return joinTournament({ data: { tournamentId: params.id } });
      }),
    },
  },
});
