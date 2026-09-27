import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** POST { token, platform? }: send this phone push notifications. DELETE { token }: stop. */
export const Route = createFileRoute("/api/app/v1/devices")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { registerDevice } = await import("@/lib/app.server");
        return registerDevice(ctx, await body(request));
      }),
      DELETE: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { unregisterDevice } = await import("@/lib/app.server");
        return unregisterDevice(ctx, await body(request));
      }),
    },
  },
});
