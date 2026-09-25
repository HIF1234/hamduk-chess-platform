import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** Mark notifications read: { ids?: [...] } (all when omitted). */
export const Route = createFileRoute("/api/app/v1/notifications/read")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { markNotificationsRead } = await import("@/lib/app.server");
        return markNotificationsRead(ctx, await body(request));
      }),
    },
  },
});
