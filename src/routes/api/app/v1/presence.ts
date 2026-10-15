import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

/** Marks this player online for ~30s, for the "friends online now" row. Call every ~20s
 *  while the app is in the foreground. */
export const Route = createFileRoute("/api/app/v1/presence")({
  server: {
    handlers: {
      POST: appEndpoint(async () => {
        const { heartbeat } = await import("@/lib/presence.functions");
        return heartbeat();
      }),
    },
  },
});
