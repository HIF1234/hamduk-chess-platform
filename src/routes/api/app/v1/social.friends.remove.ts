import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** POST { userId }: remove an accepted friend, or cancel a pending request either way. */
export const Route = createFileRoute("/api/app/v1/social/friends/remove")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { removeFriend } = await import("@/lib/social.functions");
        return removeFriend({ data: (await body(request)) as never });
      }),
    },
  },
});
