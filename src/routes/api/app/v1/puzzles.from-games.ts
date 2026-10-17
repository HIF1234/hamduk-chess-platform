import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** GET: this player's unsolved puzzles from their own blunders, most recent first.
 *  POST: saves blunders found by an on-device review: { blunders: [{ fen, bestMove }] }. */
export const Route = createFileRoute("/api/app/v1/puzzles/from-games")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { getPersonalPuzzles } = await import("@/lib/app.server");
        return getPersonalPuzzles(ctx);
      }),
      POST: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { savePersonalPuzzlesFromReview } = await import("@/lib/app.server");
        return savePersonalPuzzlesFromReview(ctx, await body(request));
      }),
    },
  },
});
