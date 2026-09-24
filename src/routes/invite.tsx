import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Gift, Loader2, MessageCircle, Share2, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getMyReferral } from "@/lib/referrals.functions";
import { SITE_URL, copyText, nativeShare, whatsappUrl, xUrl } from "@/lib/share";

const REWARD_DAYS = 30; // keep in sync with REFERRAL_REWARD_DAYS on the server

export const Route = createFileRoute("/invite")({
  head: () => ({
    meta: [
      { title: "Invite friends — Hamduk Chess" },
      {
        name: "description",
        content: "Invite friends to Hamduk Chess and earn free membership days.",
      },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { user, isGuest, loading } = useAuth();
  const fetchReferral = useServerFn(getMyReferral);
  const q = useQuery({
    queryKey: ["referral", user?.id],
    enabled: !!user && !isGuest,
    queryFn: () => fetchReferral(),
  });

  if (loading)
    return (
      <Centered>
        <Loader2 className="h-6 w-6 animate-spin" />
      </Centered>
    );
  if (!user || isGuest) {
    return (
      <Centered>
        <Gift className="mb-3 h-8 w-8 text-gold" />
        <p className="max-w-sm text-center text-muted-foreground">
          Create a free account to get your invite link and earn free membership days.
        </p>
        <Link
          to="/login"
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Create account
        </Link>
      </Centered>
    );
  }

  const data = q.data;
  const link = data?.code ? `${SITE_URL}/?ref=${data.code}` : "";
  const message = `Come and play chess with me on Hamduk Chess — Nigerian bots, puzzles, tournaments and free games. Join here: ${link}`;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 via-card to-primary/10 p-6">
          <Gift className="h-8 w-8 text-gold" />
          <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight">
            Invite friends, play free
          </h1>
          <p className="mt-2 text-muted-foreground">
            Share your link. When a friend you invite buys Hamduk Plus or Gold for the first time,
            you get <strong className="text-foreground">{REWARD_DAYS} free days</strong> — added to
            your membership, or 30 days of Plus if you're on the free plan.
          </p>

          {q.isLoading || !data ? (
            <Loader2 className="mt-6 h-5 w-5 animate-spin" />
          ) : (
            <>
              <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-background p-2">
                <code className="min-w-0 flex-1 truncate px-2 font-mono text-sm">{link}</code>
                <button
                  onClick={async () =>
                    toast[(await copyText(link)) ? "success" : "error"]("Invite link copied")
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
                >
                  <Copy className="h-4 w-4" /> Copy
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={whatsappUrl(message)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#25D366] px-4 py-2 text-sm font-semibold text-white"
                >
                  <MessageCircle className="h-4 w-4" /> Invite on WhatsApp
                </a>
                <button
                  onClick={() =>
                    void nativeShare({ title: "Hamduk Chess", text: message, url: link })
                  }
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  <Share2 className="h-4 w-4" /> More options
                </button>
                <a
                  href={xUrl("Come play chess with me on Hamduk Chess ♟️", link)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  𝕏
                </a>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Your code:{" "}
                <span className="font-mono font-semibold text-foreground">{data.code}</span>
              </p>
            </>
          )}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat icon={<Users className="h-4 w-4" />} label="Friends joined" value={data?.invited} />
          <Stat
            icon={<Gift className="h-4 w-4" />}
            label="Became members"
            value={data?.converted}
          />
          <Stat
            icon={<Gift className="h-4 w-4" />}
            label="Free days earned"
            value={data?.daysEarned}
          />
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Rewards are given once per invited friend, on their first paid membership. Invites count
          for new accounts only (created in the last 7 days). See our{" "}
          <Link to="/terms" className="underline">
            Terms
          </Link>
          .
        </p>
      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-serif text-3xl font-bold">{value ?? "—"}</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">{children}</div>
  );
}
