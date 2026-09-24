import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const REPORT_REASONS = [
  { id: "cheating", label: "Cheating / engine use" },
  { id: "abuse", label: "Abuse or harassment" },
  { id: "username", label: "Offensive username" },
  { id: "sandbagging", label: "Sandbagging (losing on purpose)" },
  { id: "spam", label: "Spam or scams" },
  { id: "other", label: "Something else" },
] as const;

const DAILY_LIMIT = 5;

/** Files a report into the moderation queue (max 5 per player per day). */
export const fileReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        targetType: z.enum(["user", "game", "club_post", "message", "forum_post"]),
        targetId: z.string().uuid(),
        reason: z.enum(REPORT_REASONS.map((r) => r.id) as [string, ...string[]]),
        details: z.string().trim().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    if (data.targetType === "user" && data.targetId === context.userId) {
      throw new Error("You can't report yourself.");
    }
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await db
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", context.userId)
      .gte("created_at", since);
    if ((count ?? 0) >= DAILY_LIMIT) {
      throw new Error("You've sent 5 reports today. Our team is reviewing them — thank you.");
    }
    const { error } = await db.from("reports").insert({
      reporter_id: context.userId,
      target_type: data.targetType,
      target_id: data.targetId,
      reason: data.reason,
      details: data.details || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
