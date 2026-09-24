import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Runs the account-level checks (early adopter, country, …) — called on sign-in. */
export const checkMyAchievements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { checkAchievements } = await import("@/lib/achievements.server");
    return { unlocked: await checkAchievements(context.userId, ["profile", "social"]) };
  });

/** Stores a finished Game Review so it's available later (history, weakness reports,
 *  Comeback King). Evaluations come from Stockfish in the player's browser; only the
 *  game's players can save, and only once per game. */
export const saveGameAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        gameId: z.string().uuid(),
        depth: z.number().int().min(8).max(30),
        evalPerPly: z.array(z.number().int().min(-100_000).max(100_000)).max(1000),
        classifications: z
          .array(z.object({ ply: z.number().int().min(1), classification: z.string().max(20) }))
          .max(1000),
        accuracyWhite: z.number().min(0).max(100),
        accuracyBlack: z.number().min(0).max(100),
        openingEco: z.string().max(10).nullable(),
        openingName: z.string().max(120).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: game } = await db
      .from("games")
      .select("white_id, black_id, status, ply")
      .eq("id", data.gameId)
      .maybeSingle();
    if (!game || game.status !== "completed") return { saved: false };
    if (game.white_id !== context.userId && game.black_id !== context.userId)
      return { saved: false };
    if (data.evalPerPly.length > game.ply + 1) return { saved: false };

    const { error } = await db.from("game_analysis").upsert(
      {
        game_id: data.gameId,
        depth: data.depth,
        eval_per_ply: data.evalPerPly,
        classifications: data.classifications,
        accuracy_white: data.accuracyWhite,
        accuracy_black: data.accuracyBlack,
        opening_eco: data.openingEco,
        opening_name: data.openingName,
        created_by: context.userId,
      },
      { onConflict: "game_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    const { checkAchievements } = await import("@/lib/achievements.server");
    await checkAchievements(context.userId, ["analysis"]);
    return { saved: true };
  });
