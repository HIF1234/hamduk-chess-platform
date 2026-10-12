import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Published video lessons (YouTube/Vimeo/cloud). Gold-only lessons are listed too -- the
 *  app gates playback the same way the website does, using /me's billing tier. */
export const Route = createFileRoute("/api/app/v1/videos/")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { listVideoLessons } = await import("@/lib/videos.functions");
        return listVideoLessons();
      }),
    },
  },
});
