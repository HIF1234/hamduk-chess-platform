import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Thrown by online-play entry points (matchmaking, challenges) for an unapproved under-13
 *  account. app-api.server.ts's errorResponse maps unmatched messages to a generic 400, so
 *  this is deliberately phrased for the player to read as-is. */
export async function assertOnlinePlayAllowed(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("age_bracket, guardian_approved_at")
    .eq("id", userId)
    .maybeSingle();
  if (data?.age_bracket === "under13" && !data.guardian_approved_at) {
    throw new Error(
      "Online play opens once a parent approves this account. Bots, puzzles and lessons are free to play now.",
    );
  }
}

/** Called once right after an under-13 sign-up to email the guardian their approval link.
 *  Best-effort and idempotent: a second call is a no-op once the first email went out. */
export const sendGuardianConsentEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("username, age_bracket, guardian_email, guardian_token, guardian_email_sent_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile || profile.age_bracket !== "under13" || !profile.guardian_email || !profile.guardian_token) {
      return { sent: false };
    }
    if (profile.guardian_email_sent_at) return { sent: true };
    const { sendEmail } = await import("@/lib/email.server");
    const ok = await sendEmail(
      profile.guardian_email,
      `Approve ${profile.username}'s Hamduk Chess account`,
      `${profile.username} signed up for Hamduk Chess and asked for your email as their parent or guardian. ` +
        "Until you approve, they can play against bots, solve puzzles and take lessons -- but not play against other people online. " +
        "Review and approve at the link below.",
      { label: "Review and approve", path: `/guardian-approve/${profile.guardian_token}` },
    );
    if (ok) {
      await supabaseAdmin.from("profiles").update({ guardian_email_sent_at: new Date().toISOString() }).eq("id", context.userId);
    }
    return { sent: ok };
  });

/** Public: resolves a guardian-approval token into what the confirm page needs to render. */
export const getGuardianApproval = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(16).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("username, guardian_approved_at")
      .eq("guardian_token", data.token)
      .maybeSingle();
    if (!profile) return { status: "not_found" as const };
    if (profile.guardian_approved_at) return { status: "approved" as const, username: profile.username };
    return { status: "pending" as const, username: profile.username };
  });

/** Public: the parent's one tap. No login required -- the token itself is the credential,
 *  emailed only to the address the player supplied as their guardian's. */
export const approveGuardianAccount = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(16).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, username, guardian_approved_at")
      .eq("guardian_token", data.token)
      .maybeSingle();
    if (!profile) return { status: "not_found" as const };
    if (!profile.guardian_approved_at) {
      await supabaseAdmin
        .from("profiles")
        .update({ guardian_approved_at: new Date().toISOString() })
        .eq("id", profile.id);
    }
    return { status: "approved" as const, username: profile.username };
  });
