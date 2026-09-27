import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** A challenge: time control, who sent it, and its game once accepted. */
export const Route = createFileRoute("/api/app/v1/challenges/$id")({
  server: {
    handlers: {
      GET: appEndpoint(async ({ request, params }) => {
        const ctx = await authenticateRequest(request);
        const { getChallengeForApp } = await import("@/lib/app.server");
        return getChallengeForApp(ctx, { id: params.id });
      }),
    },
  },
});
