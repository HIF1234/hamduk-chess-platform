import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** POST { requestId, accept }: accept or decline an incoming friend request. */
export const Route = createFileRoute("/api/app/v1/social/friends/respond")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { respondFriendRequest } = await import("@/lib/social.functions");
        return respondFriendRequest({ data: (await body(request)) as never });
      }),
    },
  },
});
