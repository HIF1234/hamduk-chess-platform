import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Signed playback URL for a cloud-hosted lesson (YouTube/Vimeo lessons just use their
 *  external_id client-side and never call this). Enforces Gold-tier gating server-side. */
export const Route = createFileRoute("/api/app/v1/videos/$id/url")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ params }) => {
        const { getSignedVideoUrl } = await import("@/lib/videos.functions");
        return getSignedVideoUrl({ data: { videoId: params.id } });
      }),
    },
  },
});
