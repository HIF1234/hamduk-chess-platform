import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, query } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** My notifications, newest first. */
export const Route = createFileRoute("/api/app/v1/notifications/")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { listNotifications } = await import("@/lib/app.server");
        return listNotifications(ctx, query(request));
      }),
    },
  },
});
