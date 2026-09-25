/** Emoji flag for an ISO 3166-1 alpha-2 country code ("NG" → 🇳🇬). */
export function flag(code: string | null | undefined) {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}
