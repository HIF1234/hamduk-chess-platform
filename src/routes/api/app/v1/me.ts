import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** The signed-in player: profile, tier, ratings per time control and puzzle stats. */
export const Route = createFileRoute("/api/app/v1/me")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const [{ getMyRatings, getMyBilling }, { getMyPuzzleStats }, { getMySettings }] =
          await Promise.all([
            import("@/lib/ratings.functions"),
            import("@/lib/puzzles.functions"),
            import("@/lib/preferences.functions"),
          ]);
        const [account, billing, ratings, puzzles] = await Promise.all([
          getMySettings(),
          getMyBilling(),
          getMyRatings(),
          getMyPuzzleStats(),
        ]);
        return { account, billing, ratings: ratings.ratings, puzzles };
      }),
    },
  },
});
