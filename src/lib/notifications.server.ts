// Server-only: creates in-app notifications (delivered live over Supabase Realtime)
// and optionally mirrors them to email.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/lib/email.server";

export type NotificationType =
  | "achievement"
  | "correspondence_move"
  | "new_follower"
  | "friend_request"
  | "friend_accepted"
  | "message"
  | "club_approved"
  | "tournament_starting"
  | "referral_reward"
  | "membership_expired";

export async function notify(
  userId: string,
  n: {
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
    payload?: Record<string, unknown>;
    /** Also send an email (only if the user has an email address). */
    email?: boolean;
  },
) {
  try {
    const { error } = await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
      payload: (n.payload ?? {}) as never,
    });
    if (error) console.error("[notify] insert failed", error.message);
    if (n.email) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
      const address = data.user?.email;
      if (address) {
        await sendEmail(
          address,
          n.title,
          n.body ?? n.title,
          n.link ? { label: "Open Hamduk Chess", path: n.link } : undefined,
        );
      }
    }
  } catch (e) {
    console.error("[notify] failed", e);
  }
}
