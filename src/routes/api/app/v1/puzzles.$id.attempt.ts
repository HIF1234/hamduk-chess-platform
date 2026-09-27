import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** Record an attempt: { success: true, hintsUsed?: 0|1|2 }. hintsUsed dampens the rating
 *  gain: 1 halves it (on 4+ ply puzzles) or zeroes it (on shorter ones), 2 always zeroes it. */
export const Route = createFileRoute("/api/app/v1/puzzles/$id/attempt")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request, params }) => {
        const { submitPuzzleAttempt } = await import("@/lib/puzzles.functions");
        return submitPuzzleAttempt({
          data: { ...((await body(request)) as object), puzzleId: params.id },
        });
      }),
    },
  },
});
