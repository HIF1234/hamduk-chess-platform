import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { THIRD_PARTY_ADS, readAdConsent, writeAdConsent } from "@/lib/ads";
import { useTier } from "@/lib/use-tier";

/** Asks free players about advertising cookies. Only exists once third-party ads are on. */
export function AdConsentBanner() {
  const tier = useTier();
  const [ask, setAsk] = useState(false);
  useEffect(() => setAsk(readAdConsent() === null), []);
  if (!THIRD_PARTY_ADS || tier !== "free" || !ask) return null;
  const choose = (v: "granted" | "denied") => {
    writeAdConsent(v);
    setAsk(false);
  };
  return (
    <div className="fixed inset-x-0 bottom-16 z-50 px-4 md:bottom-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-lg sm:flex-row sm:items-center">
        <p className="text-sm">
          Free Hamduk Chess is supported by ads. May our ad partner use cookies to show and measure
          ads? You can change this any time in{" "}
          <Link to="/settings" className="text-primary underline">
            Settings
          </Link>
          . See our{" "}
          <Link to="/privacy" className="text-primary underline">
            privacy policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => choose("denied")}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Essential only
          </button>
          <button
            onClick={() => choose("granted")}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
