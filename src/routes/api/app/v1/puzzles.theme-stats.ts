import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** This player's per-theme accuracy, weakest first: { themes: [{ theme, attempted, solved, accuracy }] }. */
export const Route = createFileRoute("/api/app/v1/puzzles/theme-stats")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { getPuzzleThemeStats } = await import("@/lib/app.server");
        return getPuzzleThemeStats(ctx);
      }),
    },
  },
});
