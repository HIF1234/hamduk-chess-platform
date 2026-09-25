// Ads for free players. House promotions by default; Google AdSense once
// VITE_ADSENSE_CLIENT (ca-pub-…) and VITE_ADSENSE_SLOT are set AND the visitor accepts
// advertising cookies. Plus and Gold members never see ads.

export const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
export const ADSENSE_SLOT = import.meta.env.VITE_ADSENSE_SLOT as string | undefined;
export const THIRD_PARTY_ADS = !!ADSENSE_CLIENT && !!ADSENSE_SLOT;

const CONSENT_KEY = "hamduk:ads-consent";
export type AdConsent = "granted" | "denied" | null;

export function readAdConsent(): AdConsent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function writeAdConsent(v: "granted" | "denied") {
  try {
    localStorage.setItem(CONSENT_KEY, v);
  } catch {
    /* private mode: the banner will ask again next visit */
  }
  window.dispatchEvent(new Event("hamduk:ads-consent"));
}

let scriptAdded = false;
/** Loads the AdSense script once, only after consent. */
export function loadAdSense() {
  if (scriptAdded || !THIRD_PARTY_ADS) return;
  scriptAdded = true;
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(s);
}
