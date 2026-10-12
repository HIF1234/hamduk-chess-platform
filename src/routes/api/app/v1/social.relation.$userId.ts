import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** My follow/friend state with another player: { isFollowing, friend }. */
export const Route = createFileRoute("/api/app/v1/social/relation/$userId")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ params }) => {
        const { getRelation } = await import("@/lib/social.functions");
        return getRelation({ data: { userId: params.userId } });
      }),
    },
  },
});
