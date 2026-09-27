import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Accept a friend's challenge. Returns { gameId }. */
export const Route = createFileRoute("/api/app/v1/challenges/$id/accept")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ params }) => {
        const { acceptChallenge } = await import("@/lib/challenges.functions");
        return acceptChallenge({ data: { id: params.id } });
      }),
    },
  },
});
