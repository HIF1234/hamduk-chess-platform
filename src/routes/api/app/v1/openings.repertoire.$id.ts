import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** DELETE: remove one repertoire entry by id. */
export const Route = createFileRoute("/api/app/v1/openings/repertoire/$id")({
  server: {
    handlers: {
      DELETE: appEndpoint(async ({ params }) => {
        const { removeFromRepertoire } = await import("@/lib/openings.functions");
        return removeFromRepertoire({ data: { id: params.id } });
      }),
    },
  },
});
