import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, query } from "@/lib/app-api.server";

/** ?lang=pcm|yo|ha|ig overlays machine-translated text where available. */
export const Route = createFileRoute("/api/app/v1/tutorials/$id")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request, params }) => {
        const { getTutorial, localizeTutorial } = await import("@/lib/tutorials-data");
        const t = getTutorial(params.id);
        if (!t) throw new Error("Tutorial not found");
        const { lang } = query(request);
        return localizeTutorial(t, lang);
      }),
    },
  },
});
