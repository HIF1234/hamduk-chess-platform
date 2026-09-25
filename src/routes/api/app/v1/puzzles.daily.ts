import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, query } from "@/lib/app-api.server";

/** The daily puzzle; ?date=YYYY-MM-DD, default today (UTC). */
export const Route = createFileRoute("/api/app/v1/puzzles/daily")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const { getDailyPuzzle } = await import("@/lib/puzzles.functions");
        return getDailyPuzzle({
          data: { date: query(request).date ?? new Date().toISOString().slice(0, 10) },
        });
      }),
    },
  },
});
