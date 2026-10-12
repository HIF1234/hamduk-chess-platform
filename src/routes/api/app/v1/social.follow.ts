import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** POST { userId }: follow a player. DELETE { userId }: unfollow. */
export const Route = createFileRoute("/api/app/v1/social/follow")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { followUser } = await import("@/lib/social.functions");
        return followUser({ data: (await body(request)) as never });
      }),
      DELETE: appEndpoint(async ({ request }) => {
        const { unfollowUser } = await import("@/lib/social.functions");
        return unfollowUser({ data: (await body(request)) as never });
      }),
    },
  },
});
