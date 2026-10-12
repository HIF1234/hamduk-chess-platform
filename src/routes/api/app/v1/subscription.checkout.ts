import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

const SITE = "https://play.chess.hamduk.com.ng";

/** Start a Plus/Gold checkout: { tier: "plus" | "gold" }. Returns { authorization_url,
 *  reference } -- open authorization_url in the device's browser (there's no in-app Paystack
 *  SDK), with callback_url pointed at the website's own /billing page, which already verifies
 *  the transaction and applies the upgrade on return. The app and the website share one
 *  database, so the app's next GET /me simply reflects the new tier -- no separate verify
 *  endpoint needed here. */
export const Route = createFileRoute("/api/app/v1/subscription/checkout")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { initializePaystackCheckout } = await import("@/lib/paystack.functions");
        const { tier } = (await body(request)) as { tier: "plus" | "gold" };
        return initializePaystackCheckout({ data: { tier, callback_url: `${SITE}/billing` } });
      }),
    },
  },
});
