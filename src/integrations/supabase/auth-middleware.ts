import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const MFA_CACHE_MS = 60_000;
const mfaCache = new Map<string, { ok: boolean; at: number }>();

async function mfaSatisfied(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
): Promise<boolean> {
  const hit = mfaCache.get(userId);
  if (hit && Date.now() - hit.at < MFA_CACHE_MS) return hit.ok;
  const { data, error } = await supabase.rpc("mfa_ok");
  // Fail open on a lookup error: RLS still enforces the same rule on every table.
  const ok = error ? true : data !== false;
  if (mfaCache.size > 5000) mfaCache.clear();
  mfaCache.set(userId, { ok, at: Date.now() });
  return ok;
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
        ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
      ];
      const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Set them in the environment (see .env.example).`;
      console.error(`[Supabase] ${message}`);
      throw new Error(message);
    }

    const request = getRequest();

    if (!request?.headers) {
      throw new Error("Unauthorized: No request headers available");
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      throw new Error("Unauthorized: No authorization header provided");
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Only Bearer tokens are supported");
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      throw new Error("Unauthorized: No token provided");
    }

    const supabase = createClient<Database>(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) {
      throw new Error("Unauthorized: Invalid token");
    }

    if (!data.claims.sub) {
      throw new Error("Unauthorized: No user ID found in token");
    }

    // Two-factor sign-in: a session that skipped the code step can't use the API when the
    // account has an authenticator. Only aal1 sessions need the lookup; results are cached
    // briefly per user so ordinary players don't pay for it on every call.
    if (data.claims.aal !== "aal2" && !(await mfaSatisfied(supabase, data.claims.sub))) {
      throw new Error("Unauthorized: Enter your two-factor code to continue");
    }

    return next({
      context: {
        supabase,
        userId: data.claims.sub,
        claims: data.claims,
      },
    });
  },
);
