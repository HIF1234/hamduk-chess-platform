import type { LanguageModel } from "ai";

// Server-only AI access. Chess analysis itself (evals, best moves, game review) runs
// in the player's browser with Stockfish and costs nothing; AI only writes the
// plain-language explanations.
//
// Cost order: a Google AI Studio key (GOOGLE_GENERATIVE_AI_API_KEY) calls Gemini
// directly on Google's free tier. Without it, requests go through Vercel AI Gateway.
export async function aiModel(): Promise<LanguageModel> {
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (googleKey) {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    const google = createGoogleGenerativeAI({ apiKey: googleKey });
    return google(process.env.GOOGLE_AI_MODEL || "gemini-3.6-flash");
  }
  return process.env.AI_GATEWAY_MODEL || "google/gemini-3.6-flash";
}

/** Maps provider failures to a message the player can act on. */
export function aiErrorMessage(error: unknown): string {
  const status = (error as { statusCode?: number })?.statusCode;
  if (status === 429) return "The coach is busy right now — please try again in a minute.";
  if (status === 402) return "AI credits exhausted. Please try again later.";
  if (status === 401 || status === 403) return "AI is not configured on this server.";
  return "AI request failed. Please try again.";
}
