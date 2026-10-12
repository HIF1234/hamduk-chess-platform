import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** My conversations, most recent first: { conversations: [{ userId, username, lastMessage, lastAt, unread }] }. */
export const Route = createFileRoute("/api/app/v1/social/messages")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { getConversations } = await import("@/lib/social.functions");
        return getConversations();
      }),
    },
  },
});
