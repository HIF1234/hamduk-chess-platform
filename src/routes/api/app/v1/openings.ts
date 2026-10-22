import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** GET: the 15-line opening repertoire -- public, same data the website's /openings pages
 *  use. Move-by-move quiz logic and the opponent's book replies live entirely on-device. */
export const Route = createFileRoute("/api/app/v1/openings")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { OPENINGS } = await import("@/lib/openings-data");
        return { openings: OPENINGS };
      }),
    },
  },
});
