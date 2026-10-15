import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";

// Deliberately does nothing but answer: lets the app measure round-trip time for the
// in-game connection-quality indicator (signal bars + ms) without the weight of a real
// endpoint. No auth needed -- there's nothing here to protect.
export const Route = createFileRoute("/api/app/v1/ping")({
  server: {
    handlers: {
      GET: appEndpoint(async () => ({ serverTime: Date.now() })),
    },
  },
});
