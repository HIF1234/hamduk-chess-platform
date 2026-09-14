import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { toast } from "sonner";
import { ArrowLeft, Eye, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLiveEval, formatEval } from "@/hooks/useLiveEval";

export const Route = createFileRoute("/spectate/$gameId")({
  head: () => ({
    meta: [
      { title: "Live Game — Hamduk Chess" },
      { name: "description", content: "Watch this game live with engine evaluation and spectator chat." },
      { property: "og:title", content: "Live Game — Hamduk Chess" },
      { property: "og:description", content: "Watch this game live with engine evaluation and spectator chat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SpectatePage,
});

type GameRow = {
  id: string;
  white_id: string;
  black_id: string;
  fen: string;
  pgn: string;
  ply: number;
  status: string;
  result: string | null;
  end_reason: string | null;
  time_control: string;
  variant: string;
  chess960_start_fen: string | null;
  is_public: boolean;
};

type ChatMsg = { id: string; name: string; text: string };

function SpectatePage() {
  const { gameId } = Route.useParams();
  const { user } = useAuth();
  const [game, setGame] = useState<GameRow | null>(null);
  const [names, setNames] = useState<Record<string, { username: string; rating: number }>>({});
  const [viewers, setViewers] = useState(1);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [notFound, setNotFound] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase.from("games").select("*").eq("id", gameId).single();
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        return;
      }
      setGame(data as GameRow);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, rating")
        .in("id", [data.white_id, data.black_id]);
      const map: Record<string, { username: string; rating: number }> = {};
      for (const p of profs ?? []) map[p.id] = { username: p.username, rating: p.rating };
      setNames(map);
    }
    void load();

    const channel = supabase
      .channel(`spectate:${gameId}`, { config: { presence: { key: user?.id ?? `guest-${Math.random()}` } } })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (p) => {
        setGame(p.new as GameRow);
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        const msg = payload as ChatMsg;
        setChat((prev) => [...prev.slice(-99), msg]);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setViewers(Math.max(1, Object.keys(state).length));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ at: Date.now() });
      });
    channelRef.current = channel;

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [gameId, user?.id]);

  const chess = useMemo(() => {
    if (!game) return null;
    const c = new Chess(game.chess960_start_fen ?? undefined);
    try {
      if (game.pgn) c.loadPgn(game.pgn);
      else c.load(game.fen);
    } catch {
      c.load(game.fen);
    }
    return c;
  }, [game]);

  const { cp, mate, thinking } = useLiveEval(game?.fen ?? "", 10, !!game && game.status === "active");

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">This game isn't available to watch.</p>
        <Link to="/spectate" className="text-primary underline">Back to live games</Link>
      </div>
    );
  }
  if (!game || !chess) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const isParticipant = !!user && (user.id === game.white_id || user.id === game.black_id);
  const white = names[game.white_id];
  const black = names[game.black_id];

  // Eval bar: clamp to ±5 pawns for the fill height.
  const pawns = mate !== null ? (mate > 0 ? 5 : -5) : (cp ?? 0) / 100;
  const whiteShare = Math.min(95, Math.max(5, 50 + (pawns / 5) * 45));

  async function sendChat() {
    const text = draft.trim().slice(0, 240);
    if (!text || !channelRef.current) return;
    if (isParticipant) {
      toast.error("Players can't post in spectator chat during the game.");
      return;
    }
    const msg: ChatMsg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: user ? (names[user.id]?.username ?? "You") : "Guest",
      text,
    };
    await channelRef.current.send({ type: "broadcast", event: "chat", payload: msg });
    setChat((prev) => [...prev.slice(-99), msg]);
    setDraft("");
  }

  const statusText =
    game.status === "completed"
      ? game.result === "draw"
        ? `Draw by ${game.end_reason ?? "agreement"}`
        : `${game.result === "white" ? white?.username ?? "White" : black?.username ?? "Black"} won by ${game.end_reason ?? "resignation"}`
      : `${chess.turn() === "w" ? white?.username ?? "White" : black?.username ?? "Black"} to move`;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_320px]">
        <div>
          <Link to="/spectate" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Live games
          </Link>
          <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2 text-sm">
            <span className="font-semibold">
              {black?.username ?? "—"} ({black?.rating ?? "—"}) vs {white?.username ?? "—"} ({white?.rating ?? "—"})
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Eye className="h-4 w-4" /> {viewers}
            </span>
          </div>

          <div className="flex gap-3">
            <div className="flex w-6 flex-col overflow-hidden rounded-md border border-border">
              <div className="bg-muted" style={{ height: `${100 - whiteShare}%` }} />
              <div className="bg-foreground" style={{ height: `${whiteShare}%` }} />
            </div>
            <div className="aspect-square w-full max-w-[600px]">
              <Chessboard
                options={{
                  position: chess.fen(),
                  boardOrientation: "white",
                  allowDragging: false,
                  animationDurationInMs: 200,
                  id: `spectate-${gameId}`,
                }}
              />
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {game.time_control} · {game.variant}
            </p>
            <p className="mt-1 font-serif text-lg font-bold">{statusText}</p>
            <p className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Engine (depth 10)</span>
              <span className="font-mono font-bold">
                {thinking && cp === null && mate === null ? "…" : formatEval(cp, mate)}
              </span>
            </p>
          </div>

          <div className="flex h-[360px] flex-col rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spectator chat</p>
            <div className="flex-1 space-y-1.5 overflow-y-auto text-sm">
              {chat.length === 0 && <p className="text-muted-foreground">No messages yet.</p>}
              {chat.map((m) => (
                <p key={m.id}>
                  <span className="font-semibold text-primary">{m.name}</span>{" "}
                  <span className="text-foreground">{m.text}</span>
                </p>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void sendChat(); }}
                placeholder={isParticipant ? "Players can't chat here" : "Say something…"}
                disabled={isParticipant}
                maxLength={240}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              />
              <button
                onClick={() => void sendChat()}
                disabled={isParticipant || !draft.trim()}
                className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Moves</p>
            <div className="max-h-[240px] overflow-y-auto font-mono text-sm">
              {chess.history().length === 0 && <p className="text-muted-foreground">No moves yet.</p>}
              {Array.from({ length: Math.ceil(chess.history().length / 2) }, (_, i) => (
                <div key={i} className="flex gap-2 py-0.5">
                  <span className="w-6 text-right text-muted-foreground">{i + 1}.</span>
                  <span className="w-16">{chess.history()[i * 2]}</span>
                  <span className="w-16">{chess.history()[i * 2 + 1] ?? ""}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
