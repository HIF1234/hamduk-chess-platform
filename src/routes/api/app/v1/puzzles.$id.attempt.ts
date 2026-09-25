import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** Record an attempt: { success: true }. */
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
