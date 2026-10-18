import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** AI coach: a plain-language assessment of a position. { fen } -> { markdown } | { error }.
 *  Gold. Calls the web's own explainPosition directly -- requireSupabaseAuth's middleware
 *  reads the Authorization header the same way authenticateRequest does. */
export const Route = createFileRoute("/api/app/v1/coach/explain")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { explainPosition } = await import("@/lib/coach.functions");
        return explainPosition({ data: await body(request) });
      }),
    },
  },
});
