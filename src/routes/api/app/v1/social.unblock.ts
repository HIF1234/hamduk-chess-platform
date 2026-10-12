import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** POST { userId }: lift a block you placed. Only the person who blocked can unblock. */
export const Route = createFileRoute("/api/app/v1/social/unblock")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { unblockUser } = await import("@/lib/social.functions");
        return unblockUser({ data: (await body(request)) as never });
      }),
    },
  },
});
