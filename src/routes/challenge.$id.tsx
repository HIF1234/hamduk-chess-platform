import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Loader2, MessageCircle, Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signInAsGuest, useAuth } from "@/lib/auth";
import { acceptChallenge } from "@/lib/challenges.functions";
import { CATEGORY_LABEL, categoryOf } from "@/lib/time-controls";
import { SITE_URL, copyText, whatsappUrl } from "@/lib/share";

export const Route = createFileRoute("/challenge/$id")({
  head: () => ({
    meta: [
      { title: "You've been challenged — Hamduk Chess" },
      { property: "og:title", content: "You've been challenged to a game of chess" },
      { property: "og:description", content: "Tap to accept and play now on Hamduk Chess." },
    ],
  }),
  component: ChallengePage,
});

function ChallengePage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const accept = useServerFn(acceptChallenge);
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["challenge", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_challenges")
        .select("id, creator_id, time_control, variant, creator_color, rated, game_id, expires_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: creator } = await supabase
        .from("profiles")
        .select("username, rating")
        .eq("id", data.creator_id)
        .maybeSingle();
      return { ...data, creator };
    },
  });
  const ch = q.data;
  const isCreator = !!user && ch?.creator_id === user.id;

  // The creator waits here; jump into the game as soon as the friend accepts.
  useEffect(() => {
    if (!ch || ch.game_id) return;
    const channel = supabase
      .channel(`challenge:${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_challenges", filter: `id=eq.${id}` },
        (p) => {
          const gameId = (p.new as { game_id: string | null }).game_id;
          if (gameId) navigate({ to: "/play/$gameId", params: { gameId } });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ch, id, navigate]);

  useEffect(() => {
    if (ch?.game_id && isCreator) navigate({ to: "/play/$gameId", params: { gameId: ch.game_id } });
  }, [ch?.game_id, isCreator, navigate]);

  async function doAccept() {
    setBusy(true);
    try {
      if (!user) await signInAsGuest();
      const { gameId } = await accept({ data: { id } });
      navigate({ to: "/play/$gameId", params: { gameId } });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  if (q.isLoading || loading)
    return (
      <Centered>
        <Loader2 className="h-6 w-6 animate-spin" />
      </Centered>
    );
  if (!ch) {
    return (
      <Centered>
        <p className="text-muted-foreground">This challenge doesn't exist.</p>
        <Link to="/play" className="mt-4 text-primary underline">
          Start a new game
        </Link>
      </Centered>
    );
  }

  const expired = new Date(ch.expires_at) < new Date();
  const cat = categoryOf(ch.time_control);
  const link = `${SITE_URL}/challenge/${id}`;
  const summary = `${ch.time_control} ${cat ? CATEGORY_LABEL[cat] : ""} · ${ch.variant === "chess960" ? "Chess960" : "Standard"} · ${ch.rated ? "Rated" : "Casual"}`;

  return (
    <Centered>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <Swords className="mx-auto h-10 w-10 text-primary" />
        {isCreator ? (
          <>
            <h1 className="mt-3 font-serif text-3xl font-bold">Challenge ready</h1>
            <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
            <p className="mt-4 text-sm">
              Send this link to your friend. The game starts as soon as they open it.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background p-2">
              <code className="min-w-0 flex-1 truncate px-1 text-left font-mono text-xs">
                {link}
              </code>
              <button
                onClick={async () =>
                  toast[(await copyText(link)) ? "success" : "error"]("Link copied")
                }
                className="rounded-md p-1.5 hover:bg-accent"
                aria-label="Copy link"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <a
              href={whatsappUrl(`Let's play chess! ${summary}. Tap to accept: ${link}`)}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white"
            >
              <MessageCircle className="h-4 w-4" /> Send on WhatsApp
            </a>
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for your friend…
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-3 font-serif text-3xl font-bold">
              {ch.creator?.username ?? "A player"} challenged you
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {ch.creator?.rating ? `Rated ${ch.creator.rating} · ` : ""}
              {summary}
            </p>
            {ch.game_id ? (
              <p className="mt-6 text-sm text-muted-foreground">
                This challenge has already been accepted.
              </p>
            ) : expired ? (
              <p className="mt-6 text-sm text-muted-foreground">This challenge has expired.</p>
            ) : (
              <button
                onClick={() => void doAccept()}
                disabled={busy}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-base font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {user ? "Accept and play" : "Play now as a guest"}
              </button>
            )}
            {!user && !expired && !ch.game_id && (
              <p className="mt-2 text-xs text-muted-foreground">
                Or{" "}
                <Link to="/login" className="underline">
                  sign in
                </Link>{" "}
                to keep the game on your account.
              </p>
            )}
          </>
        )}
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">{children}</div>
  );
}
