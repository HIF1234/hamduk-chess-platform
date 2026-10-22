import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** Personal opening repertoire -- Gold-gated server-side. GET: list. POST: add -- { eco,
 *  color, notes? }. Calls the web's own openings.functions directly. */
export const Route = createFileRoute("/api/app/v1/openings/repertoire")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { getMyRepertoire } = await import("@/lib/openings.functions");
        return getMyRepertoire();
      }),
      POST: appEndpoint(async ({ request }) => {
        const { addToRepertoire } = await import("@/lib/openings.functions");
        return addToRepertoire({ data: await body(request) });
      }),
    },
  },
});
