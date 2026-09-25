import { createFileRoute } from "@tanstack/react-router";

/** Sentinel posts finished analyses here, signed with our partner secret. */
export const Route = createFileRoute("/api/sentinel/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { applyResult, verifySignature } = await import("@/lib/sentinel.server");
        const raw = await request.text();
        if (!verifySignature(raw, request.headers.get("x-sentinel-signature"))) {
          return new Response("Invalid signature", { status: 401 });
        }
        let body: Parameters<typeof applyResult>[1];
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        if (!body?.job_id) return new Response("Missing job_id", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Unknown jobs are acknowledged too, so Sentinel doesn't keep retrying them.
        const result = await applyResult(supabaseAdmin, body);
        return Response.json(result);
      },
    },
  },
});
