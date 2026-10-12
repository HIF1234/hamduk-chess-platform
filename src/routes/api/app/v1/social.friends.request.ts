import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** POST { userId }: send a friend request, or accept one already pending the other way. */
export const Route = createFileRoute("/api/app/v1/social/friends/request")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { sendFriendRequest } = await import("@/lib/social.functions");
        return sendFriendRequest({ data: (await body(request)) as never });
      }),
    },
  },
});
