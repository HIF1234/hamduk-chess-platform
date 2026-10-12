import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Static, interactive board tutorials (no video) -- small enough to return whole. */
export const Route = createFileRoute("/api/app/v1/tutorials/")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { TUTORIALS } = await import("@/lib/tutorials-data");
        return TUTORIALS;
      }),
    },
  },
});
