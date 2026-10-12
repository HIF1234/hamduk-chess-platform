import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

export const Route = createFileRoute("/api/app/v1/videos/progress")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { getMyVideoProgress } = await import("@/lib/videos.functions");
        return getMyVideoProgress();
      }),
      POST: appEndpoint(async ({ request }) => {
        const { recordVideoProgress } = await import("@/lib/videos.functions");
        const { videoId, positionSec, completed } = (await body(request)) as {
          videoId: string;
          positionSec: number;
          completed: boolean;
        };
        return recordVideoProgress({ data: { videoId, positionSec, completed } });
      }),
    },
  },
});
