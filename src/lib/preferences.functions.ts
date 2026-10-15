import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { NIGERIA_STATES } from "@/lib/nigeria-states";
import { LANGUAGES } from "@/lib/languages";
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
        "username, country, state, language, terms_accepted_at, is_guest, subscription_tier, subscription_status, subscription_renews_at, preferences, email_notify_moves, vacation_until, fide_title, fide_id, fide_title_verified",
      )
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Profile not found");
    return {
      username: profile.username,
      country: profile.country,
      state: profile.state,
      language: profile.language,
      termsAcceptedAt: profile.terms_accepted_at,
      isGuest: profile.is_guest,
      tier: profile.subscription_tier,
      subscriptionStatus: profile.subscription_status,
      renewsAt: profile.subscription_renews_at,
      emailOnMoves: profile.email_notify_moves,
      vacationUntil: profile.vacation_until,
      preferences: normalizePreferences(profile.preferences),
      // This is the player's own account, so their pending (unverified) claim is shown to
      // them -- player bars elsewhere only ever get a title once it's verified.
      fideTitle: profile.fide_title,
      fideId: profile.fide_id,
      fideTitleVerified: profile.fide_title_verified,
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
        // Only meaningful for Nigeria today; cleared if the player's country isn't 'NG'.
        state: z.enum(NIGERIA_STATES).nullable().optional(),
        language: z.enum(LANGUAGES).optional(),
        emailOnMoves: z.boolean().optional(),
        // Self-reported, like country/state, restricted to the real FIDE/national-title
        // abbreviations (not free text) -- but unlike country/state this doesn't show on a
        // player bar until a staff member verifies it against the FIDE id against FIDE's own
        // public ratings list (see the fide_title_verified migration). null clears the claim.
        fideTitle: z
          .enum(["GM", "WGM", "IM", "WIM", "FM", "WFM", "CM", "WCM", "NM", "WNM"])
          .nullable()
          .optional(),
        // The player's FIDE id (ratings.fide.com/profile/<id>), for staff to check the claim
        // against. Optional, but a claim with no id to check is unlikely to get verified.
        fideId: z.string().trim().max(20).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const patch: {
      country?: string;
      state?: string | null;
      language?: string;
      email_notify_moves?: boolean;
      fide_title?: string | null;
      fide_id?: string | null;
      fide_title_verified?: boolean;
    } = {};
    if (data.country) patch.country = data.country;
    if (data.state !== undefined) patch.state = data.state;
    if (data.language) patch.language = data.language;
    if (data.emailOnMoves !== undefined) patch.email_notify_moves = data.emailOnMoves;
    if (data.fideTitle !== undefined) {
      patch.fide_title = data.fideTitle;
      // A new or changed claim always needs a fresh look from staff, even if some earlier
      // title on this account was verified.
      patch.fide_title_verified = false;
    }
    if (data.fideId !== undefined) patch.fide_id = data.fideId;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await db.from("profiles").update(patch).eq("id", context.userId);
    if (error) throw new Error(error.message);
    if (patch.country) {
      const { checkAchievements } = await import("@/lib/achievements.server");
      await checkAchievements(context.userId, ["profile"]);
    }
    return { ok: true };
  });
