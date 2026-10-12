import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** POST { userId }: block a player -- they can no longer message, follow or friend-request you. */
export const Route = createFileRoute("/api/app/v1/social/block")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { blockUser } = await import("@/lib/social.functions");
        return blockUser({ data: (await body(request)) as never });
      }),
    },
  },
});
