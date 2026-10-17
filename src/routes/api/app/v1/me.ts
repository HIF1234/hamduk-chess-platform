import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** The signed-in player: profile, tier, ratings per time control, puzzle stats and the
 *  bot ladder (which bots they've beaten). */
export const Route = createFileRoute("/api/app/v1/me")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const [
          { getMyRatings, getMyBilling },
          { getMyPuzzleStats },
          { getMySettings },
          { getMyBeatenBots },
        ] = await Promise.all([
          import("@/lib/ratings.functions"),
          import("@/lib/puzzles.functions"),
          import("@/lib/preferences.functions"),
          import("@/lib/app.server"),
        ]);
        const ctx = await authenticateRequest(request);
        const [account, billing, ratings, puzzles, bots] = await Promise.all([
          getMySettings(),
          getMyBilling(),
          getMyRatings(),
          getMyPuzzleStats(),
          getMyBeatenBots(ctx),
        ]);
        return { account, billing, ratings: ratings.ratings, puzzles, bots };
      }),
    },
  },
});
