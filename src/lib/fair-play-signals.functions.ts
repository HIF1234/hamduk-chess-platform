import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Batch = z.object({
  gameId: z.string().uuid(),
  window: z
    .array(
      z.object({
        type: z.literal("blur"),
        at: z.number(),
        ply: z.number().int(),
        duration_ms: z.number().nonnegative().optional(),
      }),
    )
    .max(100),
  page: z
    .array(
      z.object({ type: z.enum(["copy", "paste", "cut"]), at: z.number(), ply: z.number().int() }),
    )
    .max(100),
  moves: z
    .array(
      z.object({
        ply: z.number().int().min(1),
        drag_duration_ms: z.number().nonnegative().max(600_000).optional(),
        reaction_time_ms: z.number().nonnegative().max(3_600_000).optional(),
      }),
    )
    .max(100),
});

/** Stores a batch of fair-play signals from the player's own browser during a live game. */
export const recordClientSignals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Batch.parse(d))
  .handler(async ({ data, context }) => {
    if (!data.window.length && !data.page.length && !data.moves.length) return { ok: true };
    const { supabaseAdmin: s } = await import("@/integrations/supabase/client.server");
    const { data: g } = await s
      .from("games")
      .select("white_id, black_id, status")
      .eq("id", data.gameId)
      .maybeSingle();
    // Only the players, and only around the live game (a final flush may land just after it ends).
    if (!g || (g.white_id !== context.userId && g.black_id !== context.userId))
      return { ok: false };
    if (g.status !== "active" && g.status !== "completed") return { ok: false };
    const { error } = await s.rpc("append_client_signals", {
      p_game: data.gameId,
      p_user: context.userId,
      p_window: data.window,
      p_page: data.page,
      p_moves: data.moves,
    });
    if (error) throw error;
    return { ok: true };
  });
