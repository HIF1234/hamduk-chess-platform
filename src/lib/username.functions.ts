import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isReservedUsername } from "./reserved-usernames";

const USERNAME_RULE = /^[a-z0-9_]{3,20}$/;

/** Public: lets the sign-up form check a username as the player types, the same rule the
 *  server applies at sign-up (format, reserved words, already taken), with a suggestion. */
export const checkUsernameAvailable = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ username: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const username = data.username.trim().toLowerCase();
    if (!USERNAME_RULE.test(username)) {
      return { available: false, reason: "invalid" as const };
    }
    if (isReservedUsername(username)) {
      return { available: false, reason: "blocked" as const, suggestion: await suggest(username) };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (!row) return { available: true };
    return { available: false, reason: "taken" as const, suggestion: await suggest(username) };
  });

/** "akin_chess" -> "akin_chess23": the first free `base + 2..99` that's neither taken nor
 *  itself a reserved word (it never will be -- reserved words are fixed strings). */
async function suggest(base: string): Promise<string | undefined> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const trimmed = base.slice(0, 17); // leaves room for a 1-2 digit suffix under the 20-char max
  for (let n = 2; n <= 99; n++) {
    const candidate = `${trimmed}${n}`;
    if (isReservedUsername(candidate)) continue; // e.g. "admin" -> "admin2" is still reserved
    const { data } = await supabaseAdmin.from("profiles").select("id").eq("username", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return undefined;
}
