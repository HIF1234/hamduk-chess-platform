import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Crown, Gift, GraduationCap, Swords, Trophy } from "lucide-react";
import { useTier } from "@/lib/use-tier";
import {
  ADSENSE_CLIENT,
  ADSENSE_SLOT,
  THIRD_PARTY_ADS,
  loadAdSense,
  readAdConsent,
  type AdConsent,
} from "@/lib/ads";

const HOUSE = [
  {
    icon: Crown,
    title: "Go ad-free with Hamduk Plus",
    text: "Unlimited puzzles, all 13 Naija bots and full game reviews, priced for Nigeria.",
    cta: "See plans",
    to: "/billing",
  },
  {
    icon: Swords,
    title: "Puzzle Battle",
    text: "Race another player through the same puzzles. First to five wins.",
    cta: "Find an opponent",
    to: "/puzzles/battle",
  },
  {
    icon: Trophy,
    title: "Play a tournament",
    text: "Arenas and Swiss events run all week. Join one in a click.",
    cta: "See tournaments",
    to: "/tournaments",
  },
  {
    icon: Gift,
    title: "Invite a friend",
    text: "Bring a friend to Hamduk Chess and you both get rewards.",
    cta: "Get your link",
    to: "/invite",
  },
  {
    icon: GraduationCap,
    title: "Middlegame lessons",
    text: "Forks, pins, skewers and attacks, practised on real positions.",
    cta: "Start learning",
    to: "/learn",
  },
] as const;

/** An ad for free players. Renders nothing for Plus and Gold members. */
export function AdSlot({ className = "" }: { className?: string }) {
  const tier = useTier();
  const [consent, setConsent] = useState<AdConsent>(null);
  // Picked once per mount on the client so server and client markup agree.
  const [house, setHouse] = useState<number | null>(null);

  useEffect(() => {
    setHouse(Math.floor(Math.random() * HOUSE.length));
    const sync = () => setConsent(readAdConsent());
    sync();
    window.addEventListener("hamduk:ads-consent", sync);
    return () => window.removeEventListener("hamduk:ads-consent", sync);
  }, []);

  if (tier !== "free" || house === null) return null;
  if (THIRD_PARTY_ADS && consent === "granted") return <AdSenseUnit className={className} />;

  const h = HOUSE[house];
  const Icon = h.icon;
  return (
    <aside
      className={`rounded-xl border border-border bg-card p-4 ${className}`}
      aria-label="Promotion"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        From Hamduk Chess
      </p>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="font-semibold">{h.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{h.text}</p>
          <Link
            to={h.to}
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            {h.cta} →
          </Link>
        </div>
      </div>
    </aside>
  );
}

function AdSenseUnit({ className }: { className: string }) {
  const ref = useRef<HTMLModElement>(null);
  useEffect(() => {
    loadAdSense();
    try {
      ((window as unknown as { adsbygoogle: unknown[] }).adsbygoogle ||= []).push({});
    } catch {
      /* blocked by an ad blocker; nothing to do */
    }
  }, []);
  return (
    <aside className={className} aria-label="Advertisement">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Advertisement
      </p>
      <ins
        ref={ref}
        className="adsbygoogle block"
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
