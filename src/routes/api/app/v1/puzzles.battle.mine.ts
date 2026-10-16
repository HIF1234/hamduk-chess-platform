import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** My last few finished battles, newest first. */
export const Route = createFileRoute("/api/app/v1/puzzles/battle/mine")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { myPuzzleBattles } = await import("@/lib/puzzle-battle.app.server");
        return { battles: await myPuzzleBattles(ctx) };
      }),
    },
  },
});
