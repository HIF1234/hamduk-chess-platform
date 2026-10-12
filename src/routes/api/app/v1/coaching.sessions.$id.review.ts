import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** Student leaves a 1-5 star review on a completed session. */
export const Route = createFileRoute("/api/app/v1/coaching/sessions/$id/review")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request, params }) => {
        const { submitCoachReview } = await import("@/lib/coaching.functions");
        const { rating, comment } = (await body(request)) as { rating: number; comment?: string };
        return submitCoachReview({ data: { session_id: params.id, rating, comment } });
      }),
    },
  },
});
