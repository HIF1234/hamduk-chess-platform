// Server-only AI access through Vercel AI Gateway. Plain "provider/model" strings
// route through the gateway. Auth comes from AI_GATEWAY_API_KEY (or Vercel OIDC).
export const AI_MODEL = process.env.AI_GATEWAY_MODEL || "google/gemini-3.6-flash";

/** Maps gateway failures to a message the player can act on. */
export function aiErrorMessage(error: unknown): string {
  const status = (error as { statusCode?: number })?.statusCode;
  if (status === 429) return "Rate limited — please try again in a moment.";
  if (status === 402) return "AI credits exhausted. Please try again later.";
  if (status === 401 || status === 403) return "AI is not configured on this server.";
  return "AI request failed. Please try again.";
}
