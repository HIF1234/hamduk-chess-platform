import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Public — browse active coaches. */
export const Route = createFileRoute("/api/app/v1/coaches/")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { listCoaches } = await import("@/lib/coaching.functions");
        return listCoaches();
      }),
    },
  },
});
