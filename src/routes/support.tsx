import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { LEGAL } from "@/components/LegalPage";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Help & Support — Hamduk Chess" },
      {
        name: "description",
        content: "Answers to common questions and how to contact Hamduk Chess.",
      },
    ],
  }),
  component: Support,
});

const WHATSAPP = LEGAL.phone.replace(/[^0-9]/g, "");

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "I played as a guest. How do I keep my games and rating?",
    a: (
      <>
        Create a free account from the{" "}
        <Link to="/login" className="text-primary hover:underline">
          sign-in page
        </Link>{" "}
        while you're still signed in as a guest — your games, ratings and puzzles move to the new
        account.
      </>
    ),
  },
  {
    q: "How do memberships and payments work?",
    a: (
      <>
        Plus and Gold are paid in Naira through Paystack. Each payment gives 30 days of access and
        does not renew automatically. See{" "}
        <Link to="/billing" className="text-primary hover:underline">
          Billing
        </Link>
        .
      </>
    ),
  },
  {
    q: "Can I get a refund?",
    a: (
      <>
        Yes, in the cases listed in our{" "}
        <Link to="/refund-policy" className="text-primary hover:underline">
          refund policy
        </Link>{" "}
        — for example if you were charged twice. Email us with your payment reference.
      </>
    ),
  },
  {
    q: "I paid but my membership didn't activate.",
    a: (
      <>
        Payments are checked automatically when Paystack sends you back to{" "}
        <Link to="/billing" className="text-primary hover:underline">
          Billing
        </Link>
        , and again by Paystack's own confirmation. If your membership still doesn't show after a
        few minutes, email us your username and the Paystack reference — we'll sort it out.
      </>
    ),
  },
  {
    q: "I forgot my password.",
    a: (
      <>
        Use "Forgot password" on the{" "}
        <Link to="/login" className="text-primary hover:underline">
          sign-in page
        </Link>
        . The email comes from no-reply@hamduk.com.ng — check your spam folder.
      </>
    ),
  },
  {
    q: "How do I report a cheater or abusive player?",
    a: (
      <>
        Use the report option on their profile or game. Read how we handle it on the{" "}
        <Link to="/fair-play" className="text-primary hover:underline">
          Fair Play
        </Link>{" "}
        page.
      </>
    ),
  },
  {
    q: "How do I delete my account or get a copy of my data?",
    a: (
      <>
        Go to{" "}
        <Link to="/settings" className="text-primary hover:underline">
          Settings
        </Link>{" "}
        → Account, or email us. See our{" "}
        <Link to="/privacy" className="text-primary hover:underline">
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
];

function Support() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-serif text-4xl font-bold tracking-tight">Help & Support</h1>
        <p className="mt-2 text-muted-foreground">We usually reply within one working day.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <a
            href={`mailto:${LEGAL.email}`}
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/60"
          >
            <Mail className="h-5 w-5 text-primary" />
            <p className="mt-2 text-sm font-semibold">Email</p>
            <p className="text-xs text-muted-foreground">{LEGAL.email}</p>
          </a>
          <a
            href={`https://wa.me/${WHATSAPP}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/60"
          >
            <MessageCircle className="h-5 w-5 text-[#25D366]" />
            <p className="mt-2 text-sm font-semibold">WhatsApp</p>
            <p className="text-xs text-muted-foreground">{LEGAL.phone}</p>
          </a>
          <a
            href={`tel:${WHATSAPP}`}
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/60"
          >
            <Phone className="h-5 w-5 text-gold" />
            <p className="mt-2 text-sm font-semibold">Call</p>
            <p className="text-xs text-muted-foreground">{LEGAL.phone}</p>
          </a>
        </div>

        <h2 className="mt-10 font-serif text-2xl font-semibold">Common questions</h2>
        <div className="mt-4 space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl border border-border bg-card p-4">
              <summary className="cursor-pointer list-none font-medium marker:hidden">
                <span className="mr-2 inline-block text-primary transition-transform group-open:rotate-90 motion-reduce:transition-none">
                  ›
                </span>
                {f.q}
              </summary>
              <p className="mt-2 pl-4 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </main>
    </div>
  );
}
