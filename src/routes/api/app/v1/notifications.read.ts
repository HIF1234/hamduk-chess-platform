import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** Mark notifications read: { ids?: [...] } (all when omitted). */
export const Route = createFileRoute("/api/app/v1/notifications/read")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { markNotificationsRead } = await import("@/lib/app.functions");
        return markNotificationsRead({ data: await body(request) });
      }),
    },
  },
});
