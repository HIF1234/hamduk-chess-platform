// Push notifications to the Android app through Firebase Cloud Messaging (HTTP v1 API).
// Off unless FIREBASE_SERVICE_ACCOUNT (the service account's JSON key) is set.
import { createSign } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PROJECT = "hamduk-chess-509517";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

let cached: { token: string; expires: number } | null = null;

function account(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    console.error("[push] FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    return null;
  }
}

/** A Google OAuth access token for FCM, from a self-signed JWT (cached ~50 minutes). */
async function accessToken(sa: ServiceAccount) {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: SCOPE,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(sa.private_key)
    .toString("base64url");
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`FCM auth failed: ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, expires: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

/** Sends a notification to every phone the player has signed in on. Never throws. */
export async function sendPush(userId: string, n: { title: string; body?: string; link?: string }) {
  const sa = account();
  if (!sa) return { skipped: "not configured" };
  try {
    const { data: devices } = await supabaseAdmin
      .from("device_tokens")
      .select("token")
      .eq("user_id", userId);
    if (!devices?.length) return { sent: 0 };
    const auth = await accessToken(sa);
    let sent = 0;
    for (const { token } of devices) {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: n.title, body: n.body ?? "" },
            data: n.link ? { link: n.link } : {},
            android: { priority: "high", notification: { channel_id: "games" } },
          },
        }),
      });
      if (res.ok) {
        sent++;
      } else if (res.status === 404 || res.status === 400) {
        // The app was uninstalled or the token expired: forget it.
        const body = await res.text();
        if (/UNREGISTERED|INVALID_ARGUMENT|registration-token-not-registered/.test(body)) {
          await supabaseAdmin.from("device_tokens").delete().eq("token", token);
        }
      } else {
        console.error("[push] send failed", res.status);
      }
    }
    return { sent };
  } catch (e) {
    console.error("[push] failed", e);
    return { error: true };
  }
}
