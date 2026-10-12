import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Recent activity from players I follow: { items: [{ id, type, payload, createdAt, username }] }. */
export const Route = createFileRoute("/api/app/v1/social/feed")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { getMyFeed } = await import("@/lib/social.functions");
        return getMyFeed();
      }),
    },
  },
});
