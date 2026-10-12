import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** POST { recipientId, content }: send a direct message. */
export const Route = createFileRoute("/api/app/v1/social/messages/send")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { sendMessage } = await import("@/lib/social.functions");
        return sendMessage({ data: (await body(request)) as never });
      }),
    },
  },
});
