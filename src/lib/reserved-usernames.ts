// Names a player can't register as -- platform words that would look official, and a short
// list of well-known titled players, so nobody can sign up pretending to be them. Not
// exhaustive; it's an impersonation guard, not a trademark registry.
const RESERVED = [
  // Platform / staff
  "admin", "administrator", "hamduk", "hamdukchess", "moderator", "mod", "staff", "support",
  "official", "root", "system", "owner", "superadmin", "webmaster", "help", "security",
  // A short list of well-known titled players (world champions and top-rated GMs)
  "magnuscarlsen", "hikarunakamura", "fabianocaruana", "dingliren", "garrykasparov",
  "bobbyfischer", "viswanathananand", "judithpolgar", "wesleyso", "alirezafirouzja",
  "anishgiri", "maxime vachier lagrave", "maximevachierlagrave", "levonaronian",
];

/** Normalizes the way the app's own username rule already does (lowercase, letters/numbers/
 *  underscores only) before comparing, so "Hamduk_Chess" and "hamdukchess99" both match. */
function normalize(username: string) {
  return username.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isReservedUsername(username: string): boolean {
  const n = normalize(username);
  return RESERVED.some((word) => n === word || (word.length >= 5 && n.startsWith(word)));
}
