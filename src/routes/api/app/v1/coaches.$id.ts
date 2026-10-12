import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Coach detail: profile, weekly availability, reviews. */
export const Route = createFileRoute("/api/app/v1/coaches/$id")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ params }) => {
        const { getCoach } = await import("@/lib/coaching.functions");
        return getCoach({ data: { coach_id: params.id } });
      }),
    },
  },
});
