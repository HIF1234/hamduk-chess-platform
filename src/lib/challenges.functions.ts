import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TIME_CONTROL_IDS } from "@/lib/time-controls";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// 1 to 60 minutes, 0 to 30 seconds a move -- a custom time control alongside the fixed ones.
const CUSTOM_TIME_CONTROL = /^([1-9]|[1-5][0-9]|60)\+([0-9]|[12][0-9]|30)$/;
const TimeControlInput = z.union([
  z.enum(TIME_CONTROL_IDS),
  z.string().regex(CUSTOM_TIME_CONTROL, "Time control must be 1-60 minutes and 0-30 seconds a move."),
]);

/** Creates a shareable "play me" link, or -- with targetUserId -- an in-app challenge to a
 *  specific friend: expires in 10 minutes (instead of the usual 24 hours for a link anyone
 *  might open later) and pushes them a notification with Accept/Decline. */
export const createChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        timeControl: TimeControlInput,
        variant: z.enum(["standard", "chess960"]).default("standard"),
        color: z.enum(["white", "black", "random"]).default("random"),
        rated: z.boolean().default(false),
        targetUserId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertOnlinePlayAllowed } = await import("./guardian.functions");
    await assertOnlinePlayAllowed(context.userId);
    if (data.targetUserId === context.userId) throw new Error("You can't challenge yourself.");
    const db = await admin();
    const { data: row, error } = await db
      .from("game_challenges")
      .insert({
        creator_id: context.userId,
        time_control: data.timeControl,
        variant: data.variant,
        creator_color: data.color,
        rated: data.rated,
        target_user_id: data.targetUserId ?? null,
        ...(data.targetUserId ? { expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() } : {}),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data.targetUserId) {
      const { data: me } = await db.from("profiles").select("username").eq("id", context.userId).maybeSingle();
      const { notify } = await import("@/lib/notifications.server");
      await notify(data.targetUserId, {
        type: "challenge_received",
        title: `${me?.username ?? "Someone"} challenges you to ${data.timeControl}`,
        body: "Accept within 10 minutes, or it expires.",
        link: `/challenge/${row.id}`,
      });
    }
    return { id: row.id };
  });

/** The friend who got a targeted challenge declines it, so the sender's waiting screen
 *  can show that instead of silence until it expires. */
export const declineChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("game_challenges")
      .update({ declined: true })
      .eq("id", data.id)
      .eq("target_user_id", context.userId)
      .is("game_id", null)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("This challenge isn't yours to decline.");
    return { ok: true };
  });

/** Public challenges anyone can accept: no target, not yet taken, not expired. */
export const listOpenChallenges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const db = await admin();
    const { data, error } = await db
      .from("game_challenges")
      .select("id, creator_id, time_control, variant, creator_color, rated, created_at")
      .is("target_user_id", null)
      .is("game_id", null)
      .eq("declined", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const creatorIds = [...new Set(rows.map((r) => r.creator_id))];
    let names: Record<string, { username: string; rating: number }> = {};
    if (creatorIds.length) {
      const { data: profiles } = await db
        .from("profiles")
        .select("id, username, rating")
        .in("id", creatorIds);
      for (const p of profiles ?? []) names[p.id] = { username: p.username, rating: p.rating };
    }
    return {
      challenges: rows.map((r) => ({ ...r, creator: names[r.creator_id] ?? null })),
    };
  });

/** The person who opened the link accepts: creates the game for both players. */
export const acceptChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertOnlinePlayAllowed } = await import("./guardian.functions");
    await assertOnlinePlayAllowed(context.userId);
    const { acceptChallengeFor } = await import("@/lib/challenges.server");
    return acceptChallengeFor(data.id, context.userId);
  });
