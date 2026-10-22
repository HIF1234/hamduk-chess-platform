import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** GET: this player's tutorial progress (per tutorial_id: step_index, completed). POST:
 *  save progress on a step -- { tutorial_id, step_index, completed? }. Calls the web's own
 *  tutorials.functions directly, same table the website's own lesson player writes to, so
 *  progress is the same on both. */
export const Route = createFileRoute("/api/app/v1/tutorials/progress")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { getMyTutorialProgress } = await import("@/lib/tutorials.functions");
        return getMyTutorialProgress();
      }),
      POST: appEndpoint(async ({ request }) => {
        const { saveTutorialProgress } = await import("@/lib/tutorials.functions");
        return saveTutorialProgress({ data: await body(request) });
      }),
    },
  },
});
