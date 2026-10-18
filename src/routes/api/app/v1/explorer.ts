import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** Opening explorer: moves played from this position, Hamduk games free, masters Gold.
 *  { fen, source: "hamduk" | "masters" } -> ExplorerResult. Calls the web's own getExplorer
 *  directly, same auth pattern as /puzzles/{id}/attempt. */
export const Route = createFileRoute("/api/app/v1/explorer")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { getExplorer } = await import("@/lib/explorer.functions");
        return getExplorer({ data: await body(request) });
      }),
    },
  },
});
