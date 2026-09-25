import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, query } from "@/lib/app-api.server";

/** The next rated puzzle for me; optional ?theme=fork. */
export const Route = createFileRoute("/api/app/v1/puzzles/next")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const { getNextPuzzle } = await import("@/lib/puzzles.functions");
        return getNextPuzzle({ data: query(request) });
      }),
    },
  },
});
