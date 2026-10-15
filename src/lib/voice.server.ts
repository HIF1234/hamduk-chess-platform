import { z } from "zod";
import type { AppContext } from "@/lib/app.server";

const TranscribeInput = z.object({ audio: z.string().min(1) });

// A short vocabulary hint for the model: improves accuracy on chess terms it would
// otherwise mis-hear (e.g. "knight" as "night", "takes" as "tax").
const CHESS_PROMPT =
  "Chess move dictation: pawn, knight, bishop, rook, queen, king, takes, check, checkmate, " +
  "castles kingside, castles queenside, promotes to queen, a1 to h8.";

/** "Say move aloud": transcribes a short audio clip (base64) for the client to parse into
 * a move. Rate-limited -- each call costs real provider quota/money. */
export async function transcribeVoiceMove(ctx: AppContext, input: unknown) {
  const data = TranscribeInput.parse(input);
  const { assertRate } = await import("@/lib/rate-limit.server");
  await assertRate(ctx.userId, "voice-move", 30, 60 * 60);
  const { transcribe } = await import("ai");
  const { transcriptionModel, aiErrorMessage } = await import("@/lib/ai.server");
  try {
    const { text } = await transcribe({
      model: await transcriptionModel(),
      audio: data.audio,
      // Verified against @ai-sdk/groq's bundled docs; the openai/whisper-1 Gateway fallback
      // has no confirmed providerOptions key here, so it isn't guessed at.
      providerOptions: {
        groq: { language: "en", prompt: CHESS_PROMPT },
      },
    });
    return { text };
  } catch (e) {
    console.error("[voice] transcription error", e);
    throw new Error(aiErrorMessage(e));
  }
}
