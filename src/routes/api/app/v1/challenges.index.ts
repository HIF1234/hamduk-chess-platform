import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

const SITE = "https://play.chess.hamduk.com.ng";

/** Create a challenge link to send a friend: { timeControl, color?, rated?, variant? }.
 *  Returns { id, url }; the url opens the app when installed, the website otherwise. */
export const Route = createFileRoute("/api/app/v1/challenges/")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { createChallenge } = await import("@/lib/challenges.functions");
        const { id } = await createChallenge({ data: (await body(request)) as never });
        return { id, url: `${SITE}/challenge/${id}` };
      }),
    },
  },
});
