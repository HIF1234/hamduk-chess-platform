import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** Joins the oldest compatible waiting battle, or opens one -- call again while waiting. */
export const Route = createFileRoute("/api/app/v1/puzzles/battle/find")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { findPuzzleBattle } = await import("@/lib/puzzle-battle.app.server");
        return findPuzzleBattle(ctx);
      }),
    },
  },
});
