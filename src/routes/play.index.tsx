import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bot,
  CalendarClock,
  Globe2,
  Loader2,
  Microscope,
  Shuffle,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { signInAsGuest, useAuth } from "@/lib/auth";
import { createChallenge } from "@/lib/challenges.functions";
import { CATEGORY_LABEL, TIME_CONTROLS, type TimeControlId } from "@/lib/time-controls";

export const Route = createFileRoute("/play/")({
  head: () => ({
    meta: [
      { title: "Play chess — Hamduk Chess" },
      {
        name: "description",
        content:
          "Play online, against Nigerian bots, with a friend, by correspondence or Chess960.",
      },
    ],
  }),
  component: PlayPage,
});

const MODES: {
  to: string;
  search?: Record<string, string>;
  title: string;
  blurb: string;
  Icon: LucideIcon;
  accent?: boolean;
}[] = [
  {
    to: "/lobby",
    title: "Play online",
    blurb: "Get matched with a player near your rating — bullet to classical.",
    Icon: Globe2,
    accent: true,
  },
  {
    to: "/play/bot",
    title: "Play the bots",
    blurb: "13 Nigerian personalities, Army Legend (500) to Naija Legend (3000).",
    Icon: Bot,
  },
  {
    to: "/correspondence",
    title: "Correspondence",
    blurb: "One move a day. Take your time — 1, 3 or 7 days per move.",
    Icon: CalendarClock,
  },
  {
    to: "/lobby",
    title: "Chess960",
    blurb: "Random starting position. No opening theory, pure chess.",
    Icon: Shuffle,
  },
  {
    to: "/tournaments",
    title: "Tournaments",
    blurb: "Swiss, arena, round-robin and knockout events.",
    Icon: Trophy,
  },
  {
    to: "/analysis",
    title: "Analysis board",
    blurb: "Set up any position or import a PGN and study with the engine.",
    Icon: Microscope,
  },
];

function PlayPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="font-serif text-4xl font-bold tracking-tight">Play</h1>
        <p className="mt-1 text-muted-foreground">How do you want to play today?</p>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-3 sm:grid-cols-2">
            {MODES.map((m) => (
              <Link
                key={m.title}
                to={m.to}
                className={`group rounded-xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none ${
                  m.accent
                    ? "border-primary/50 bg-gradient-to-br from-primary/15 to-card"
                    : "border-border bg-card"
                }`}
              >
                <m.Icon className={`h-7 w-7 ${m.accent ? "text-primary" : "text-gold"}`} />
                <p className="mt-3 font-serif text-xl font-bold">{m.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{m.blurb}</p>
              </Link>
            ))}
          </div>
          <FriendChallenge />
        </div>
      </main>
    </div>
  );
}

function FriendChallenge() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const create = useServerFn(createChallenge);
  const [tc, setTc] = useState<TimeControlId>("5+0");
  const [variant, setVariant] = useState<"standard" | "chess960">("standard");
  const [color, setColor] = useState<"random" | "white" | "black">("random");
  const [rated, setRated] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      if (!user) await signInAsGuest();
      const { id } = await create({ data: { timeControl: tc, variant, color, rated } });
      navigate({ to: "/challenge/$id", params: { id } });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  const chip = (active: boolean) =>
    `rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
      active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"
    }`;

  return (
    <section className="rounded-xl border border-gold/40 bg-gradient-to-br from-gold/10 to-card p-5">
      <Users className="h-7 w-7 text-gold" />
      <p className="mt-3 font-serif text-xl font-bold">Play a friend</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Get a link, send it on WhatsApp, play straight away.
      </p>

      <p className="mb-1.5 mt-4 text-xs font-medium text-muted-foreground">Time control</p>
      <div className="grid grid-cols-4 gap-1.5">
        {TIME_CONTROLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTc(t.id)}
            className={chip(tc === t.id)}
            title={CATEGORY_LABEL[t.category]}
          >
            {t.id}
          </button>
        ))}
      </div>

      <p className="mb-1.5 mt-4 text-xs font-medium text-muted-foreground">Variant</p>
      <div className="flex gap-1.5">
        <button onClick={() => setVariant("standard")} className={chip(variant === "standard")}>
          Standard
        </button>
        <button onClick={() => setVariant("chess960")} className={chip(variant === "chess960")}>
          Chess960
        </button>
      </div>

      <p className="mb-1.5 mt-4 text-xs font-medium text-muted-foreground">I play</p>
      <div className="flex gap-1.5">
        {(["random", "white", "black"] as const).map((c) => (
          <button key={c} onClick={() => setColor(c)} className={`${chip(color === c)} capitalize`}>
            {c}
          </button>
        ))}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={rated} onChange={(e) => setRated(e.target.checked)} />
        Rated game
      </label>

      <button
        onClick={() => void submit()}
        disabled={busy}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create challenge link
      </button>
    </section>
  );
}
