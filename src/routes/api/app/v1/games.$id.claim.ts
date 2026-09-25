import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Claim the game when the opponent has been away longer than the grace period. Returns { ended: false, reason: "grace", remainingMs } if it is too early. */
export const Route = createFileRoute("/api/app/v1/games/$id/claim")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ params }) => {
        const { claimDisconnectWin } = await import("@/lib/presence.functions");
        return claimDisconnectWin({ data: { gameId: params.id } });
      }),
    },
  },
});
