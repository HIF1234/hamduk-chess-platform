import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, Gift, GraduationCap, Sparkles, Trophy, Users } from "lucide-react";
import { LEGAL } from "@/components/LegalPage";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Hamduk Chess" },
      {
        name: "description",
        content:
          "Hamduk Chess is an Africa-first chess platform from Hamduk Chess Club, built in Nigeria.",
      },
    ],
  }),
  component: About,
});

const PILLARS = [
  {
    Icon: Bot,
    title: "Nigerian bots",
    body: "13 personalities from Army Legend to Naija Legend — play someone who feels like home.",
  },
  {
    Icon: Sparkles,
    title: "Coaching that listens",
    body: "Tell the coach what you were thinking and get feedback on your reasoning, in English or Pidgin.",
  },
  {
    Icon: GraduationCap,
    title: "Learn properly",
    body: "Tens of thousands of puzzles, openings, endgames, tutorials and video lessons.",
  },
  {
    Icon: Trophy,
    title: "Compete",
    body: "Rated games from bullet to classical, correspondence, Chess960 and tournaments.",
  },
  {
    Icon: Users,
    title: "Clubs & schools",
    body: "Clubs with forums and events, class sessions for coaches and schools.",
  },
  {
    Icon: Gift,
    title: "Priced for Africa",
    body: "Free to play, with memberships in Naira that cost a fraction of the big platforms.",
  },
];

function About() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{LEGAL.name}</p>
        <h1 className="mt-1 font-serif text-5xl font-bold tracking-tight">
          Chess, <span className="text-primary">Africa first.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Hamduk Chess is built by Hamduk Chess Club in {LEGAL.location.split(",")[0]} for players
          across Africa: fast on mobile data, affordable in Naira, and full of the culture that
          makes our chess ours.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map(({ Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5">
              <Icon className="h-6 w-6 text-gold" />
              <p className="mt-3 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/play"
            className="rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
          >
            Start playing
          </Link>
          <Link
            to="/clubs/$slug"
            params={{ slug: "hamdukchessclub" }}
            className="rounded-md border border-border px-5 py-2.5 font-medium hover:bg-accent"
          >
            Join Hamduk Chess Club
          </Link>
          <Link
            to="/support"
            className="rounded-md border border-border px-5 py-2.5 font-medium hover:bg-accent"
          >
            Contact us
          </Link>
        </div>
      </main>
    </div>
  );
}
