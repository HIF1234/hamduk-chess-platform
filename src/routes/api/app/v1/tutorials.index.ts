import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, query } from "@/lib/app-api.server";

/** Static, interactive board tutorials (no video) -- small enough to return whole.
 *  ?lang=pcm|yo|ha|ig overlays machine-translated text for the 5 basics tutorials where
 *  available, falling back to English; omit or "en" for English. */
export const Route = createFileRoute("/api/app/v1/tutorials/")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request }) => {
        const { TUTORIALS, localizeTutorial } = await import("@/lib/tutorials-data");
        const { lang } = query(request);
        return TUTORIALS.map((t) => localizeTutorial(t, lang));
      }),
    },
  },
});
