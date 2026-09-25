import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** Upload offline attempts: { attempts: [{ puzzleId, success }] }, oldest first. */
export const Route = createFileRoute("/api/app/v1/puzzles/sync")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { syncPuzzleAttempts } = await import("@/lib/app.functions");
        return syncPuzzleAttempts({ data: await body(request) });
      }),
    },
  },
});
