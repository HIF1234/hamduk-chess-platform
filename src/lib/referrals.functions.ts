import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomInt } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const CLAIM_WINDOW_DAYS = 7;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function newCode() {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

/** The player's invite code (created on first use) and their referral stats. */
export const getMyReferral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data: me } = await db
      .from("profiles")
      .select("referral_code, is_guest")
      .eq("id", context.userId)
      .maybeSingle();
    if (!me) throw new Error("Profile not found");
    if (me.is_guest) return { code: null, invited: 0, converted: 0, daysEarned: 0 };

    let code = me.referral_code;
    for (let i = 0; !code && i < 5; i++) {
      const candidate = newCode();
      const { error } = await db
        .from("profiles")
        .update({ referral_code: candidate })
        .eq("id", context.userId)
        .is("referral_code", null);
      if (!error) code = candidate;
    }

    const [{ count: invited }, { data: rewards }] = await Promise.all([
      db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("referred_by", context.userId),
      db.from("referral_events").select("reward_days").eq("referrer_id", context.userId),
    ]);
    return {
      code,
      invited: invited ?? 0,
      converted: rewards?.length ?? 0,
      daysEarned: (rewards ?? []).reduce((a, r) => a + r.reward_days, 0),
    };
  });

/** Links a new account to the friend who invited it. Only for accounts created
 *  in the last week, never for yourself, and never changes an existing referrer. */
export const claimReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z2-9]{8}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const [{ data: me }, { data: referrer }] = await Promise.all([
      db
        .from("profiles")
        .select("referred_by, created_at, is_guest")
        .eq("id", context.userId)
        .maybeSingle(),
      db.from("profiles").select("id").eq("referral_code", data.code).maybeSingle(),
    ]);
    if (!me || !referrer || me.is_guest || me.referred_by) return { claimed: false };
    if (referrer.id === context.userId) return { claimed: false };
    if (Date.now() - new Date(me.created_at).getTime() > CLAIM_WINDOW_DAYS * 86_400_000) {
      return { claimed: false };
    }
    const { error } = await db
      .from("profiles")
      .update({ referred_by: referrer.id })
      .eq("id", context.userId)
      .is("referred_by", null);
    return { claimed: !error };
  });
