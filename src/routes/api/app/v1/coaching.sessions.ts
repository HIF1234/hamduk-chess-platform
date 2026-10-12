import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** My coaching sessions, as student and (if I'm a coach) as coach. */
export const Route = createFileRoute("/api/app/v1/coaching/sessions")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { getMyCoachSessions } = await import("@/lib/coaching.functions");
        return getMyCoachSessions();
      }),
    },
  },
});
