import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FenSchema = z.object({
  fen: z.string().min(10).max(100),
});

// Tightened from 50k → 8k chars (~ a full 200-move PGN with annotations is well under this).
const PgnSchema = z.object({
  pgn: z.string().min(1).max(8_000),
});

type AiResult = { markdown: string; error?: undefined } | { markdown?: undefined; error: string };

async function callGateway(systemPrompt: string, userContent: string): Promise<AiResult> {
  const { generateText } = await import("ai");
  const { AI_MODEL, aiErrorMessage } = await import("@/lib/ai.server");
  try {
    const { text } = await generateText({
      model: AI_MODEL,
      system: systemPrompt,
      prompt: userContent,
    });
    if (!text) return { error: "AI returned an empty response." };
    return { markdown: text };
  } catch (e) {
    console.error("AI gateway error", e);
    return { error: aiErrorMessage(e) };
  }
}

export const explainPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FenSchema.parse(input))
  .handler(async ({ data }) => {
    return callGateway(
      "You are a sharp, encouraging chess coach. Given a FEN, return a concise plain-language assessment of the position. Cover: material balance, immediate threats for both sides, strategic plans, and 2–3 candidate moves with one-line justifications. Use Markdown with short sections. Stay under 220 words. Do not invent moves that are not legal — when uncertain, hedge.",
      `Analyze this position (FEN): ${data.fen}`,
    );
  });

export const recapGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PgnSchema.parse(input))
  .handler(async ({ data }) => {
    return callGateway(
      "You are a chess commentator. Given a PGN, produce a 4–6 sentence narrative recap of the game. Mention the opening by name if recognizable, call out the key turning point(s) with move numbers, and explain why the game ended as it did. Use Markdown. Be vivid but accurate.",
      `Recap this game (PGN):\n\n${data.pgn}`,
    );
  });

// ---------- COACH VERBAL REVIEW ----------
// The player explains what they were thinking on a move; the coach critiques the
// reasoning itself, grounded in Stockfish numbers computed on the client.

/** Reflections per UTC day. Free gets a taste; Gold is effectively unlimited. */
const REFLECTION_DAILY_LIMIT = { free: 3, plus: 30, gold: 500 } as const;

const CandidateSchema = z.object({
  san: z.string().min(2).max(10),
  // Eval after the move, centipawns from the mover's point of view.
  evalCp: z.number().int().min(-100_000).max(100_000),
});

const ReflectionSchema = z.object({
  gameId: z.string().uuid().optional(),
  ply: z.number().int().min(1).max(1000),
  fenBefore: z.string().min(10).max(100),
  moveSan: z.string().min(2).max(10),
  classification: z.string().max(20),
  cpLoss: z.number().int().min(0).max(200_000),
  // All evals below are centipawns from the mover's point of view.
  evalBefore: z.number().int().min(-100_000).max(100_000),
  evalAfter: z.number().int().min(-100_000).max(100_000),
  bestMoveSan: z.string().max(10).nullable(),
  thought: z.string().trim().min(3).max(1500),
  candidates: z.array(CandidateSchema).max(4).default([]),
  language: z.enum(["en", "pcm"]).default("en"),
});

function describeEval(cp: number): string {
  if (Math.abs(cp) >= 90_000)
    return cp > 0 ? "forced mate for the player" : "forced mate against the player";
  const pawns = (cp / 100).toFixed(1);
  return `${cp >= 0 ? "+" : ""}${pawns} (from the player's side)`;
}

const VERBAL_REVIEW_PROMPT = `You are Hamduk Coach, a warm but honest chess coach at Hamduk Chess Club.
A player has told you what they were THINKING when they played a move. Coach their thought process, not just the move.

Rules:
- The engine data you are given is the truth. Never contradict it, never invent variations you cannot justify, and never claim a move is legal or illegal beyond what is given.
- Quote the player's own reasoning back briefly, then respond to it.
- If they considered alternatives, compare each one using the engine numbers, explained in plain language (e.g. "that would have kept you about a pawn up").
- If their move was fine, say so clearly and reinforce the good reasoning.

Reply in Markdown with exactly these short sections:
**What you saw right**
**What you missed**
**Your alternatives** (omit this section if they mentioned none)
**Habit to build** — one concrete thinking habit (e.g. checks-captures-threats, "what does my opponent want?", blunder-check before moving).

Stay under 200 words.`;

export const coachMyThinking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReflectionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("subscription_tier")
      .eq("id", context.userId)
      .maybeSingle();
    const tier = (profile?.subscription_tier ?? "free") as keyof typeof REFLECTION_DAILY_LIMIT;
    const limit = REFLECTION_DAILY_LIMIT[tier];

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("move_reflections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", dayStart.toISOString());
    const used = count ?? 0;
    if (used >= limit) {
      return {
        error:
          tier === "free"
            ? `You've used your ${limit} free coach reviews today. Upgrade to Hamduk Plus for ${REFLECTION_DAILY_LIMIT.plus} a day.`
            : `Daily limit of ${limit} coach reviews reached. Try again tomorrow.`,
        remaining: 0,
      };
    }

    const moveNo = Math.ceil(data.ply / 2);
    const side = data.ply % 2 === 1 ? "White" : "Black";
    const lines = [
      `Position before the move (FEN): ${data.fenBefore}`,
      `The player (${side}) played: ${moveNo}${side === "White" ? "." : "..."} ${data.moveSan}`,
      `Engine verdict: ${data.classification}, lost ${(data.cpLoss / 100).toFixed(1)} pawns of evaluation.`,
      `Evaluation before the move: ${describeEval(data.evalBefore)}`,
      `Evaluation after the move: ${describeEval(data.evalAfter)}`,
      data.bestMoveSan
        ? `Engine's best move was: ${data.bestMoveSan}`
        : "Engine had no alternative best move.",
      data.candidates.length
        ? `Alternatives the player mentioned, with engine evaluation after each:\n${data.candidates
            .map((c) => `- ${c.san}: ${describeEval(c.evalCp)}`)
            .join("\n")}`
        : "The player did not name any alternative moves.",
      "",
      `What the player says they were thinking:\n"""${data.thought}"""`,
    ];
    const languageRule =
      data.language === "pcm"
        ? "\n\nReply in friendly Nigerian Pidgin English. Keep chess terms (e.g. fork, pin, checkmate) in standard English."
        : "";

    const result = await callGateway(VERBAL_REVIEW_PROMPT + languageRule, lines.join("\n"));
    if (result.error !== undefined) return { error: result.error, remaining: limit - used };

    await supabaseAdmin.from("move_reflections").insert({
      user_id: context.userId,
      game_id: data.gameId ?? null,
      ply: data.ply,
      fen_before: data.fenBefore,
      move_san: data.moveSan,
      classification: data.classification,
      cp_loss: data.cpLoss,
      thought: data.thought,
      candidates: data.candidates,
      coach_reply: result.markdown,
      language: data.language,
    });

    return { markdown: result.markdown, remaining: limit - used - 1 };
  });
