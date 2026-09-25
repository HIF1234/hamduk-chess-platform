import { createFileRoute } from "@tanstack/react-router";
import { APP_API_VERSION, appEndpoint } from "@/lib/app-api.server";

const SITE = "https://play.chess.hamduk.com.ng";

/** Everything the app needs before sign-in: backend details, minimum supported app version,
 *  time controls and the bot personalities (so bots play on-device exactly as on the site).
 *  Public; safe to cache for an hour. */
export const Route = createFileRoute("/api/app/v1/config")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const [{ BOT_PERSONAS }, { TIME_CONTROLS }] = await Promise.all([
          import("@/lib/bot-personas"),
          import("@/lib/time-controls"),
        ]);
        return {
          apiVersion: APP_API_VERSION,
          // Raise to force old apps to update after a breaking change.
          minAppVersion: process.env.APP_MIN_VERSION ?? "1.0.0",
          supabase: {
            url: process.env.SUPABASE_URL,
            // The publishable (anon) key; it's already public in the website's bundle.
            anonKey: process.env.SUPABASE_PUBLISHABLE_KEY,
          },
          timeControls: TIME_CONTROLS,
          bots: BOT_PERSONAS.map((b) => ({
            id: b.id,
            name: b.name,
            hometown: b.hometown,
            rating: b.rating,
            tier: b.tier,
            catchphrase: b.catchphrase,
            bio: b.bio,
            avatar: b.avatar,
            portraitUrl: b.portrait.startsWith("http") ? b.portrait : `${SITE}${b.portrait}`,
            engine: {
              depthMin: b.depthMin,
              depthMax: b.depthMax,
              blunderRate: b.blunderRate,
              randomness: b.randomness,
              movetimeMs: b.movetimeMs,
              openingRepertoire: b.openingRepertoire,
            },
          })),
          limits: { freeDailyPuzzles: 20, freePuzzlePack: 30, paidPuzzlePack: 500 },
          links: {
            privacy: `${SITE}/privacy`,
            terms: `${SITE}/terms`,
            fairPlay: `${SITE}/fair-play`,
            billing: `${SITE}/billing`,
          },
        };
      }),
    },
  },
});
