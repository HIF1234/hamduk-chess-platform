import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** Endgame tablebase: exact result and best moves at 7 pieces or fewer. Gold. { fen } ->
 *  { result } | { error }. Calls the web's own lookupTablebase directly, same auth
 *  pattern as /puzzles/{id}/attempt. */
export const Route = createFileRoute("/api/app/v1/tablebase")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { lookupTablebase } = await import("@/lib/tablebase.functions");
        return lookupTablebase({ data: await body(request) });
      }),
    },
  },
});
