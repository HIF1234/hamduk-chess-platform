import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** GET: the website's endgame drill positions and their category labels -- public, same
 *  data /endgame pages use. Playing against the engine happens entirely on-device. */
export const Route = createFileRoute("/api/app/v1/endgames")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { ENDGAMES, ENDGAME_CATEGORIES } = await import("@/lib/endgames-data");
        return { endgames: ENDGAMES, categories: ENDGAME_CATEGORIES };
      }),
    },
  },
});
