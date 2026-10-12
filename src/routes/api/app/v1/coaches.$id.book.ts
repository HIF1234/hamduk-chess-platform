import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

const SITE = "https://play.chess.hamduk.com.ng";

/** Book a session (Gold only) and get a Paystack checkout URL. callback_url is fixed to
 *  the website's own /coaches/$id page, which already verifies the transaction on return --
 *  the app's next GET /coaching/sessions reflects the confirmed status, since both share
 *  one database. No in-app payment SDK. */
export const Route = createFileRoute("/api/app/v1/coaches/$id/book")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request, params }) => {
        const { bookCoachSession } = await import("@/lib/coaching.functions");
        const { scheduled_at, duration_min } = (await body(request)) as {
          scheduled_at: string;
          duration_min: number;
        };
        return bookCoachSession({
          data: {
            coach_id: params.id,
            scheduled_at,
            duration_min,
            callback_url: `${SITE}/coaches/${params.id}`,
          },
        });
      }),
    },
  },
});
