import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** My friends: { accepted, incoming, outgoing }, each a list of { id, userId, username, rating }. */
export const Route = createFileRoute("/api/app/v1/social/friends")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { getMyFriends } = await import("@/lib/social.functions");
        return getMyFriends();
      }),
    },
  },
});
