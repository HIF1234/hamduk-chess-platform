import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, query } from "@/lib/app-api.server";

/** My notifications, newest first. */
export const Route = createFileRoute("/api/app/v1/notifications/")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const { listNotifications } = await import("@/lib/app.functions");
        return listNotifications({ data: query(request) });
      }),
    },
  },
});
