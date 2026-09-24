// Server-only Paystack helpers. NEVER import this from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PaidTier } from "@/lib/paystack-pricing";

export const PAYSTACK_BASE = "https://api.paystack.co";

export function getPaystackSecret() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TIER_RANK = { free: 0, plus: 1, gold: 2 } as const;

/** Days a referrer earns when someone they invited makes their first payment. */
export const REFERRAL_REWARD_DAYS = 30;

/** New end date: `days` added on top of any time still left, never cut short. */
function extendFrom(current: string | null, days: number) {
  const base =
    current && new Date(current).getTime() > Date.now() ? new Date(current).getTime() : Date.now();
  return new Date(base + days * DAY_MS).toISOString();
}

/**
 * Apply a paid membership (webhook + manual verify). Idempotent per Paystack
 * reference; adds 30 days to any remaining time; rewards the referrer on the
 * player's first payment.
 */
export async function applySubscriptionUpgrade(args: {
  userId: string;
  tier: PaidTier;
  customerCode: string | null;
  reference: string;
  amount: number;
  currency: string;
}) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("subscription_tier, subscription_renews_at, referred_by")
    .eq("id", args.userId)
    .maybeSingle();
  const renews = extendFrom(profile?.subscription_renews_at ?? null, 30);

  // Claim the reference first: the unique index makes a replay a no-op.
  const { error: claimErr } = await supabaseAdmin.from("payment_events").insert({
    user_id: args.userId,
    event: "subscription.activated",
    reference: args.reference,
    amount: args.amount,
    currency: args.currency,
    plan_code: args.tier,
    raw: { tier: args.tier, renews_at: renews },
  });
  if (claimErr) {
    if (claimErr.code === "23505") return; // already applied
    throw new Error(claimErr.message);
  }

  // Never downgrade someone who still has a higher tier running.
  const current = (profile?.subscription_tier ?? "free") as keyof typeof TIER_RANK;
  const keepHigher =
    TIER_RANK[current] > TIER_RANK[args.tier] &&
    !!profile?.subscription_renews_at &&
    new Date(profile.subscription_renews_at).getTime() > Date.now();

  await supabaseAdmin
    .from("profiles")
    .update({
      subscription_tier: keepHigher ? current : args.tier,
      subscription_status: "active",
      subscription_renews_at: renews,
      paystack_customer_code: args.customerCode ?? undefined,
    })
    .eq("id", args.userId);

  if (profile?.referred_by)
    await rewardReferrer(profile.referred_by, args.userId, args.tier, args.reference);
}

async function rewardReferrer(
  referrerId: string,
  referredId: string,
  tier: PaidTier,
  reference: string,
) {
  const { error } = await supabaseAdmin.from("referral_events").insert({
    referrer_id: referrerId,
    referred_id: referredId,
    converted_tier: tier,
    reward_days: REFERRAL_REWARD_DAYS,
    payment_reference: reference,
  });
  if (error) return; // already rewarded for this player (unique referred_id)

  const { data: ref } = await supabaseAdmin
    .from("profiles")
    .select("subscription_tier, subscription_renews_at")
    .eq("id", referrerId)
    .maybeSingle();
  const paid = ref?.subscription_tier && ref.subscription_tier !== "free";
  await supabaseAdmin
    .from("profiles")
    .update({
      subscription_tier: paid ? ref!.subscription_tier : "plus",
      subscription_status: "active",
      subscription_renews_at: extendFrom(
        paid ? (ref?.subscription_renews_at ?? null) : null,
        REFERRAL_REWARD_DAYS,
      ),
    })
    .eq("id", referrerId);

  const { data: friend } = await supabaseAdmin
    .from("profiles")
    .select("username")
    .eq("id", referredId)
    .maybeSingle();
  const { notify } = await import("@/lib/notifications.server");
  await notify(referrerId, {
    type: "referral_reward",
    title: `You earned ${REFERRAL_REWARD_DAYS} free days!`,
    body: `${friend?.username ?? "A friend you invited"} joined Hamduk ${tier === "gold" ? "Gold" : "Plus"}. Thanks for spreading the word.`,
    link: "/invite",
    email: true,
  });
}

/** Scheduler job: memberships whose paid time has run out go back to Free. */
export async function expireSubscriptions() {
  const { data: expired } = await supabaseAdmin
    .from("profiles")
    .update({ subscription_tier: "free", subscription_status: "expired" })
    .neq("subscription_tier", "free")
    .not("subscription_renews_at", "is", null)
    .lt("subscription_renews_at", new Date().toISOString())
    .select("id");
  const { notify } = await import("@/lib/notifications.server");
  for (const p of expired ?? []) {
    await notify(p.id, {
      type: "membership_expired",
      title: "Your membership has ended",
      body: "Renew any time to get your Plus or Gold features back.",
      link: "/billing",
      email: true,
    });
  }
  return { expired: expired?.length ?? 0 };
}
