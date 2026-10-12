import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** My conversation with one player by username; marks their unread messages read on fetch. */
export const Route = createFileRoute("/api/app/v1/social/messages/$username")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ params }) => {
        const { getConversation } = await import("@/lib/social.functions");
        return getConversation({ data: { username: params.username } });
      }),
    },
  },
});
