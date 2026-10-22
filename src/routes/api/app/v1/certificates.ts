import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** GET: this player's earned course-path certificates. The mobile app renders each one as
 *  a PDF on-device, with a QR code linking to /certificate/{id} for verification. */
export const Route = createFileRoute("/api/app/v1/certificates")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { getMyCertificates } = await import("@/lib/app.server");
        return getMyCertificates(ctx);
      }),
    },
  },
});
