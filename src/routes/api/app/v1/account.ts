import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** Change country/state (and other account-level settings) after sign-up. */
export const Route = createFileRoute("/api/app/v1/account")({
  server: {
    handlers: {
      PATCH: appEndpoint(async ({ request }) => {
        const { updateMyAccount } = await import("@/lib/preferences.functions");
        return updateMyAccount({ data: await body(request) });
      }),
    },
  },
});
