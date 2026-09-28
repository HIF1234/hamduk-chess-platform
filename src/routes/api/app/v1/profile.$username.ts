import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** A player's public profile: ratings, rank and recent games. */
export const Route = createFileRoute("/api/app/v1/profile/$username")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ params }) => {
        const { getPublicProfile } = await import("@/lib/app.server");
        return getPublicProfile(null, { username: params.username });
      }),
    },
  },
});
