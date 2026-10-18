import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** Think-aloud review: the player explains what they were thinking on a move; the coach
 *  checks the reasoning against the engine's own numbers. { markdown, remaining } | { error }.
 *  Calls the web's own coachMyThinking directly (same auth pattern as coach/explain). */
export const Route = createFileRoute("/api/app/v1/coach/think-aloud")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { coachMyThinking } = await import("@/lib/coach.functions");
        return coachMyThinking({ data: await body(request) });
      }),
    },
  },
});
