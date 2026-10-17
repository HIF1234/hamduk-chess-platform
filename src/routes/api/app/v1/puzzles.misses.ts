import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** This player's currently-missed puzzles, most recent first: { misses: [{ id, fen, solution, themes, rating, missedAt }] }. */
export const Route = createFileRoute("/api/app/v1/puzzles/misses")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { getPuzzleMisses } = await import("@/lib/app.server");
        return getPuzzleMisses(ctx);
      }),
    },
  },
});
