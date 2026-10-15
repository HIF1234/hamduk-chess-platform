import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

export const Route = createFileRoute("/api/app/v1/guardian-consent")({
  server: {
    handlers: {
      POST: appEndpoint(async () => {
        const { sendGuardianConsentEmail } = await import("@/lib/guardian.functions");
        return sendGuardianConsentEmail();
      }),
    },
  },
});
