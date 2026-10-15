// The languages offered at onboarding (spec: English, Pidgin, Yoruba, Hausa, Igbo). Every
// one of them currently renders in English -- there's no translated copy yet -- so this is
// just the stored preference, ready for when real translations exist.
export const LANGUAGES = ["en", "pcm", "yo", "ha", "ig"] as const;
export type LanguageCode = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  en: "English",
  pcm: "Pidgin",
  yo: "Yoruba",
  ha: "Hausa",
  ig: "Igbo",
};
