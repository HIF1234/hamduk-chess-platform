import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** POST { targetType, targetId, reason, details? }: file a report into the moderation queue
 *  (max 5/day). See GET /report/reasons for the valid `reason` values. */
export const Route = createFileRoute("/api/app/v1/report")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { fileReport } = await import("@/lib/reports.functions");
        return fileReport({ data: (await body(request)) as never });
      }),
    },
  },
});
