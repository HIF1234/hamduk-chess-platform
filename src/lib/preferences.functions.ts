import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BOARD_THEMES, normalizePreferences, type BoardThemeId } from "@/lib/preferences";

const PreferencesSchema = z.object({
  boardTheme: z.enum(Object.keys(BOARD_THEMES) as [BoardThemeId, ...BoardThemeId[]]),
  sound: z.boolean(),
  showCoordinates: z.boolean(),
  emailDigest: z.boolean(),
  weeklySummary: z.boolean(),
});

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Everything the settings page shows about the signed-in account. */
export const getMySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data: profile, error } = await db
      .from("profiles")
      .select(
        "username, country, is_guest, subscription_tier, subscription_status, subscription_renews_at, preferences, email_notify_moves, vacation_until",
      )
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Profile not found");
    return {
      username: profile.username,
      country: profile.country,
      isGuest: profile.is_guest,
      tier: profile.subscription_tier,
      subscriptionStatus: profile.subscription_status,
      renewsAt: profile.subscription_renews_at,
      emailOnMoves: profile.email_notify_moves,
      vacationUntil: profile.vacation_until,
      preferences: normalizePreferences(profile.preferences),
    };
  });

export const updateMyPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PreferencesSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    if (BOARD_THEMES[data.boardTheme].gold) {
      const { data: profile } = await db
        .from("profiles")
        .select("subscription_tier")
        .eq("id", context.userId)
        .maybeSingle();
      if (profile?.subscription_tier !== "gold") {
        throw new Error(`${BOARD_THEMES[data.boardTheme].label} is a Hamduk Gold board.`);
      }
    }
    const { error } = await db
      .from("profiles")
      .update({ preferences: data })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { preferences: data };
  });

export const updateMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        country: z.string().length(2).toUpperCase().optional(),
        emailOnMoves: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const patch: { country?: string; email_notify_moves?: boolean } = {};
    if (data.country) patch.country = data.country;
    if (data.emailOnMoves !== undefined) patch.email_notify_moves = data.emailOnMoves;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await db.from("profiles").update(patch).eq("id", context.userId);
    if (error) throw new Error(error.message);
    if (patch.country) {
      const { checkAchievements } = await import("@/lib/achievements.server");
      await checkAchievements(context.userId, ["profile"]);
    }
    return { ok: true };
  });
