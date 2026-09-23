import { createFileRoute } from "@tanstack/react-router";
import { hasInternalSecret } from "@/lib/internal-auth.server";

/** Internal check that the AI provider answers. Same secret as the scheduler. */
export const Route = createFileRoute("/api/health/ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!hasInternalSecret(request)) return new Response("Unauthorized", { status: 401 });
        const { generateText } = await import("ai");
        const { aiModel } = await import("@/lib/ai.server");
        const provider = process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "google" : "gateway";
        const started = Date.now();
        try {
          const { text, response } = await generateText({
            model: await aiModel(),
            prompt: "Reply with exactly: ok",
          });
          return Response.json({
            ok: true,
            provider,
            model: response.modelId,
            text,
            ms: Date.now() - started,
          });
        } catch (e) {
          const err = e as { statusCode?: number; message?: string };
          return Response.json(
            { ok: false, provider, status: err.statusCode, error: err.message?.slice(0, 300) },
            { status: 502 },
          );
        }
      },
    },
  },
});
