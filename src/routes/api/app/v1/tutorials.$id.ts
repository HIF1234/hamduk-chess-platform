import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

export const Route = createFileRoute("/api/app/v1/tutorials/$id")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ params }) => {
        const { getTutorial } = await import("@/lib/tutorials-data");
        const t = getTutorial(params.id);
        if (!t) throw new Error("Tutorial not found");
        return t;
      }),
    },
  },
});
