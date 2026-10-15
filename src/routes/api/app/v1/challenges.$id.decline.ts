import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Decline a friend's targeted challenge. */
export const Route = createFileRoute("/api/app/v1/challenges/$id/decline")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ params }) => {
        const { declineChallenge } = await import("@/lib/challenges.functions");
        return declineChallenge({ data: { id: params.id } });
      }),
    },
  },
});
