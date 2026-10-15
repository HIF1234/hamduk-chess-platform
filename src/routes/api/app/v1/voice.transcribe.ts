import { createFileRoute } from "@tanstack/react-router";
import { appEndpoint, body } from "@/lib/app-api.server";
import { authenticateRequest } from "@/integrations/supabase/auth-middleware";

/** POST { audio: base64 }: transcribe a short voice clip for "say move aloud". */
export const Route = createFileRoute("/api/app/v1/voice/transcribe")({
  server: {
    handlers: {
      POST: appEndpoint(async ({ request }) => {
        const ctx = await authenticateRequest(request);
        const { transcribeVoiceMove } = await import("@/lib/voice.server");
        return transcribeVoiceMove(ctx, await body(request));
      }),
    },
  },
});
