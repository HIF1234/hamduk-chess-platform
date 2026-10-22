import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** GET: this player's opening progress map (per-ECO attempts/correct/masteredDepth). POST:
 *  record a finished session -- { eco, correct, attempts, masteredDepth }. Calls the web's
 *  own openings.functions directly -- requireSupabaseAuth's middleware reads the
 *  Authorization header the same way regardless of transport. */
export const Route = createFileRoute("/api/app/v1/openings/progress")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { getMyOpeningProgress } = await import("@/lib/openings.functions");
        return getMyOpeningProgress();
      }),
      POST: appEndpoint(async ({ request }) => {
        const { recordOpeningSession } = await import("@/lib/openings.functions");
        return recordOpeningSession({ data: await body(request) });
      }),
    },
  },
});
