import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** GET: a shuffled batch of positions for the Board vision drill -> { puzzles: [{ fen,
 *  solution, themes }] }. The mobile app classifies each as "hanging piece" (themes include
 *  hangingPiece) or "checking move" (computed client-side) and skips the rest. */
export const Route = createFileRoute("/api/app/v1/board-vision/puzzles")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { getBoardVisionPuzzles } = await import("@/lib/app.server");
        return getBoardVisionPuzzles(ctx);
      }),
    },
  },
});
