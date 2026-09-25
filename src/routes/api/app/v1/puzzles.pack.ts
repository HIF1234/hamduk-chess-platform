import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, query } from "@/lib/app-api.server";

/** Unseen puzzles near my rating for offline play; ?count=100 (free players get up to 30). */
export const Route = createFileRoute("/api/app/v1/puzzles/pack")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const { getPuzzlePack } = await import("@/lib/app.functions");
        return getPuzzlePack({ data: query(request) });
      }),
    },
  },
});
