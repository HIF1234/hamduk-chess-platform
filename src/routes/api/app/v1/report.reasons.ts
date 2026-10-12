import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** The valid `reason` values for POST /report, so the app doesn't hardcode its own copy. */
export const Route = createFileRoute("/api/app/v1/report/reasons")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { REPORT_REASONS } = await import("@/lib/reports.functions");
        return REPORT_REASONS;
      }),
    },
  },
});
