import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TIME_CONTROL_IDS } from "@/lib/time-controls";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Creates a shareable "play me" link. */
export const createChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        timeControl: z.enum(TIME_CONTROL_IDS),
        variant: z.enum(["standard", "chess960"]).default("standard"),
        color: z.enum(["white", "black", "random"]).default("random"),
        rated: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("game_challenges")
      .insert({
        creator_id: context.userId,
        time_control: data.timeControl,
        variant: data.variant,
        creator_color: data.color,
        rated: data.rated,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

/** The person who opened the link accepts: creates the game for both players. */
export const acceptChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { acceptChallengeFor } = await import("@/lib/challenges.server");
    return acceptChallengeFor(data.id, context.userId);
  });
