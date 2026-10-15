import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, query } from "@/lib/app-api.server";

export const Route = createFileRoute("/api/app/v1/username-available")({
  server: {
    handlers: {
      // No auth: this runs while signing up, before an account (or token) exists.
      GET: appEndpoint(async ({ request }) => {
        const { checkUsernameAvailable } = await import("@/lib/username.functions");
        return checkUsernameAvailable({ data: { username: query(request).username ?? "" } });
      }),
    },
  },
});
