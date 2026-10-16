import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** Submits moves for the puzzle at `index`: { index, moves: ["e2e4", ...] }. */
export const Route = createFileRoute("/api/app/v1/puzzles/battle/$id/answer")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request, params }) => {
        const ctx = await authenticateRequest(request);
        const { answerPuzzleBattle } = await import("@/lib/puzzle-battle.app.server");
        return answerPuzzleBattle(ctx, {
          ...((await body(request)) as object),
          battleId: params.id,
        });
      }),
    },
  },
});
