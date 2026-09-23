import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Internal scheduler entry point, called every minute by Supabase pg_cron. Runs every
 *  sweep independently so one failure doesn't stop the others. */
export const Route = createFileRoute("/api/cron/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        const jobs: Record<string, () => Promise<unknown>> = {
          tournaments: async () => (await import("@/lib/tournaments.server")).sweepTournaments(),
          correspondence: async () =>
            (await import("@/lib/correspondence.server")).sweepCorrespondenceDeadlines(),
          webhooks: async () => (await import("@/lib/webhooks.server")).retryDueDeliveries(),
        };
        const results: Record<string, unknown> = {};
        for (const [name, run] of Object.entries(jobs)) {
          try {
            results[name] = await run();
          } catch (e) {
            console.error(`[cron] ${name} failed`, e);
            results[name] = { error: (e as Error).message };
          }
        }
        return Response.json(results);
      },
    },
  },
});
