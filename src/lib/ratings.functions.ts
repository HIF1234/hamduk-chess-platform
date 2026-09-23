import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TimeControl = z.enum(["3+0", "5+0", "10+0", "15+10"]);
const Variant = z.enum(["standard", "chess960"]);

export const getMyRatings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("ratings")
      .select(
        "time_control, variant, rating, games_played, wins, losses, draws, bot_games, updated_at",
      )
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ratings: data ?? [] };
  });

export const getUserRatings = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("ratings")
      .select("time_control, variant, rating, games_played, wins, losses, draws, bot_games")
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ratings: rows ?? [] };
  });

export const recordBotGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        timeControl: TimeControl,
        variant: Variant.default("standard"),
        botId: z.string().min(1).max(40),
        result: z.enum(["win", "loss", "draw"]),
        playerColor: z.enum(["white", "black"]).default("white"),
        endReason: z.string().max(40).optional(),
        ply: z.number().int().min(0).max(2000).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Written with the service role for the authenticated user. (The record_bot_game
    // RPC keys off auth.uid(), which is empty under the service role, so it never counted.)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getPersona } = await import("@/lib/bot-personas");

    // Bots run in the browser, so the server can't stop play — but only games the
    // player's tier allows count towards stats, streaks and achievements.
    const persona = getPersona(data.botId);
    if (!persona || persona.id !== data.botId) throw new Error("Unknown bot");
    if (persona.tier === "plus") {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("subscription_tier")
        .eq("id", context.userId)
        .maybeSingle();
      if ((profile?.subscription_tier ?? "free") === "free") {
        return { ok: false as const, reason: "plus_bot" as const, userId: context.userId };
      }
    }

    const { error: gameError } = await supabaseAdmin.from("bot_games").insert({
      user_id: context.userId,
      bot_id: persona.id,
      bot_rating: persona.rating,
      player_color: data.playerColor,
      result: data.result,
      end_reason: data.endReason ?? null,
      ply: data.ply,
      time_control: data.timeControl,
      variant: data.variant,
    });
    if (gameError) throw new Error(gameError.message);

    const key = { user_id: context.userId, time_control: data.timeControl, variant: data.variant };
    const { data: row } = await supabaseAdmin
      .from("ratings")
      .select("bot_games")
      .match(key)
      .maybeSingle();
    const { error } = row
      ? await supabaseAdmin
          .from("ratings")
          .update({ bot_games: row.bot_games + 1, updated_at: new Date().toISOString() })
          .match(key)
      : await supabaseAdmin.from("ratings").insert({ ...key, bot_games: 1 });
    if (error) throw new Error(error.message);
    return { ok: true as const, userId: context.userId };
  });

export const getMyBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("subscription_tier, subscription_status, subscription_renews_at")
      .eq("id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    return {
      tier: (data?.subscription_tier ?? "free") as "free" | "plus" | "gold",
      status: data?.subscription_status ?? "inactive",
      renewsAt: data?.subscription_renews_at ?? null,
    };
  });
