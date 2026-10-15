import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";

/** POST { days: 0-14 }: holiday mode -- pauses correspondence move deadlines. */
export const Route = createFileRoute("/api/app/v1/correspondence/vacation")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const { setVacationMode } = await import("@/lib/correspondence.functions");
        return setVacationMode({ data: (await body(request)) as never });
      }),
    },
  },
});
