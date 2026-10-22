import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** GET: the six course-path units (Pawn to King) -- public, static curriculum data. */
export const Route = createFileRoute("/api/app/v1/course")({
  server: {
    handlers: {
      GET: appEndpoint(async () => {
        const { COURSE_UNITS } = await import("@/lib/course-data");
        return { units: COURSE_UNITS };
      }),
    },
  },
});
