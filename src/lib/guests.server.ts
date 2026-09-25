import { randomBytes } from "node:crypto";

// Guests idle this long are removed. Their finished games move to the placeholder account.
const PLACEHOLDER_USERNAME = "former_guest";
const PLACEHOLDER_EMAIL = "former-guests@hamduk.com.ng";
const BATCH = 50;

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** The account that keeps deleted guests' games. Created on first use; it can't sign in. */
async function placeholderId(s: Db): Promise<string> {
  const { data: existing } = await s
    .from("profiles")
    .select("id")
    .eq("username", PLACEHOLDER_USERNAME)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await s.auth.admin.createUser({
    email: PLACEHOLDER_EMAIL,
    password: randomBytes(32).toString("base64url"),
    email_confirm: false,
    ban_duration: "876000h",
    user_metadata: { username: PLACEHOLDER_USERNAME },
    app_metadata: { system: "former_guest" },
  });
  if (error) throw error;
  // Marked as a guest so it stays off leaderboards and search.
  await s
    .from("profiles")
    .update({ username: PLACEHOLDER_USERNAME, is_guest: true })
    .eq("id", data.user.id);
  return data.user.id;
}

/** Deletes guests idle for 30 days. Runs from the cron tick once an hour. */
export async function cleanupGuests(now = new Date()) {
  if (now.getUTCMinutes() !== 17) return { skipped: "not this minute" };
  const { supabaseAdmin: s } = await import("@/integrations/supabase/client.server");
  const keeper = await placeholderId(s);
  const { data: ids, error } = await s.rpc("guest_cleanup_prepare", {
    p_placeholder: keeper,
    p_limit: BATCH,
  });
  if (error) throw error;
  let deleted = 0;
  for (const id of ids ?? []) {
    // Deleting the auth user cascades to the profile and everything that belongs to it.
    const { error: delErr } = await s.auth.admin.deleteUser(id);
    if (delErr) console.error("[guests] delete failed", id, delErr.message);
    else deleted++;
  }
  return { deleted };
}
