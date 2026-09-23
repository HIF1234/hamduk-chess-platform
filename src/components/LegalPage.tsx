import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export const LEGAL = {
  name: "Hamduk Chess Club",
  site: "play.chess.hamduk.com.ng",
  email: "support@hamduk.com.ng",
  phone: "+234 706 227 3586",
  location: "Lagos, Nigeria",
  updated: "23 September 2026",
} as const;

export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: ReactNode;
  sections: { id: string; heading: string; body: ReactNode }[];
}) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{LEGAL.name}</p>
        <h1 className="mt-1 font-serif text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {LEGAL.updated}</p>
        <div className="mt-6 space-y-3 leading-relaxed text-foreground/90">{intro}</div>

        <nav
          aria-label="Contents"
          className="mt-8 rounded-xl border border-border bg-card p-4 text-sm"
        >
          <p className="mb-2 font-semibold">Contents</p>
          <ol className="grid list-decimal gap-1 pl-5 sm:grid-cols-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-primary hover:underline">
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="mt-10 scroll-mt-20">
            <h2 className="font-serif text-2xl font-semibold">
              {i + 1}. {s.heading}
            </h2>
            <div className="mt-3 space-y-3 leading-relaxed text-foreground/90 [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-6">
              {s.body}
            </div>
          </section>
        ))}

        <footer className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <a href={`mailto:${LEGAL.email}`} className="hover:text-foreground">
            {LEGAL.email}
          </a>
        </footer>
      </main>
    </div>
  );
}

export function Mail() {
  return (
    <a href={`mailto:${LEGAL.email}`} className="text-primary hover:underline">
      {LEGAL.email}
    </a>
  );
}
