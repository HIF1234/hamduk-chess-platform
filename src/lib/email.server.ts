// Transactional email through Resend. Best-effort: failures are logged, never thrown,
// so a mail outage can't break gameplay.
const SITE = "https://play.chess.hamduk.com.ng";

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  cta?: { label: string; path: string },
  /** Trusted HTML for the body, used instead of `text` in the HTML part. */
  bodyHtml?: string,
) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.EMAIL_FROM || "Hamduk Chess <no-reply@hamduk.com.ng>";
  const link = cta ? `${SITE}${cta.path}` : SITE;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1a1a1a">
  <h2 style="color:#1a6b3a;margin:0 0 12px">Hamduk Chess</h2>
  ${bodyHtml ?? `<p style="font-size:15px;line-height:1.5">${escapeHtml(text).replace(/\n/g, "<br>")}</p>`}
  ${cta ? `<p><a href="${link}" style="display:inline-block;background:#1a6b3a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(cta.label)}</a></p>` : ""}
  <p style="font-size:12px;color:#777;margin-top:24px">You can change email settings at ${SITE}/settings</p>
</div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, text: cta ? `${text}\n\n${link}` : text }),
    });
    if (!res.ok) console.error("[email] send failed", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("[email] send error", e);
    return false;
  }
}

export function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
