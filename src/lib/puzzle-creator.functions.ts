import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Chess } from "chess.js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminRole } from "@/lib/admin-middleware";

const DAILY_LIMIT = 10;
const Uci = z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/);

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Replays the line; throws if the FEN or any move is illegal. */
function validateLine(fen: string, solution: string[]) {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    throw new Error("That position isn't legal.");
  }
  if (chess.isGameOver()) throw new Error("The position is already over.");
  for (const [i, m] of solution.entries()) {
    try {
      chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
    } catch {
      throw new Error(`Move ${i + 1} of the solution isn't legal.`);
    }
  }
}

/** Plus/Gold players submit a puzzle for review (10 per day). */
export const submitPuzzle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        fen: z.string().min(15).max(100),
        // Solver move, reply, solver move, …; must end on the solver's move.
        solution: z
          .array(Uci)
          .min(1)
          .max(15)
          .refine((s) => s.length % 2 === 1, "The solution must end with your move."),
        themes: z
          .array(z.string().regex(/^[a-zA-Z0-9]{2,30}$/))
          .max(5)
          .default([]),
        difficulty: z.number().int().min(400).max(3000).default(1500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await db();
    const { data: me } = await s
      .from("profiles")
      .select("subscription_tier, is_guest, banned_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (!me || me.is_guest || me.banned_at) throw new Error("You can't submit puzzles right now.");
    if (me.subscription_tier === "free")
      throw new Error("The puzzle creator is part of Hamduk Plus and Gold.");

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await s
      .from("puzzles")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", context.userId)
      .gte("created_at", dayStart.toISOString());
    if ((count ?? 0) >= DAILY_LIMIT)
      throw new Error(`You can submit ${DAILY_LIMIT} puzzles a day.`);

    validateLine(data.fen, data.solution);
    const { data: row, error } = await s
      .from("puzzles")
      .insert({
        fen: data.fen,
        solution: data.solution,
        themes: data.themes,
        rating: data.difficulty,
        source: "community",
        creator_id: context.userId,
        approved: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listMyPuzzles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await db();
    const { data } = await s
      .from("puzzles")
      .select("id, fen, rating, approved, review_note, reviewed_at, created_at")
      .eq("creator_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const listPendingPuzzles = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("moderator")])
  .handler(async () => {
    const s = await db();
    const { data } = await s
      .from("puzzles")
      .select("id, fen, solution, themes, rating, created_at, creator_id, review_note")
      .eq("approved", false)
      .is("reviewed_at", null)
      .order("created_at")
      .limit(50);
    const ids = [...new Set((data ?? []).map((p) => p.creator_id).filter((x): x is string => !!x))];
    const { data: names } = ids.length
      ? await s.from("profiles").select("id, username").in("id", ids)
      : { data: [] };
    const nameOf = new Map((names ?? []).map((n) => [n.id, n.username]));
    return (data ?? []).map((p) => ({
      ...p,
      creator: p.creator_id ? (nameOf.get(p.creator_id) ?? "—") : "—",
    }));
  });

export const reviewPuzzle = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("moderator")])
  .inputValidator((d) =>
    z
      .object({
        puzzleId: z.string().uuid(),
        approve: z.boolean(),
        rating: z.number().int().min(400).max(3000).optional(),
        themes: z
          .array(z.string().regex(/^[a-zA-Z0-9]{2,30}$/))
          .max(5)
          .optional(),
        note: z.string().trim().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await db();
    const { data: p } = await s
      .from("puzzles")
      .select("creator_id")
      .eq("id", data.puzzleId)
      .maybeSingle();
    if (!p) throw new Error("Puzzle not found");
    await s
      .from("puzzles")
      .update({
        approved: data.approve,
        reviewed_at: new Date().toISOString(),
        review_note: data.note || null,
        ...(data.rating ? { rating: data.rating } : {}),
        ...(data.themes ? { themes: data.themes } : {}),
      })
      .eq("id", data.puzzleId);
    const { logAdminAction } = await import("@/lib/admin.server");
    await logAdminAction({
      adminId: context.userId,
      action: data.approve ? "puzzle.approved" : "puzzle.rejected",
      targetTable: "puzzles",
      targetId: data.puzzleId,
      reason: data.note ?? null,
    });
    if (p.creator_id) {
      const { notify } = await import("@/lib/notifications.server");
      await notify(p.creator_id, {
        type: "puzzle_review",
        title: data.approve ? "Your puzzle was approved! 🎉" : "Your puzzle wasn't approved",
        body: data.approve
          ? "It's now live for players to solve, with your name on it."
          : (data.note ?? "It didn't meet the puzzle guidelines."),
        link: data.approve ? `/puzzles/${data.puzzleId}` : "/puzzles/create",
      });
    }
    return { ok: true };
  });
