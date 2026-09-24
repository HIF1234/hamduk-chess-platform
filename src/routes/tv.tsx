import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Chessboard } from "react-chessboard";
import { toast } from "sonner";
import { Eye, Loader2, Mic, Radio, Trophy, Tv } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useBoardSquares } from "@/lib/preferences";
import {
  getTvGames,
  getTvRole,
  postCommentary,
  setCommentator,
  type TvGame,
} from "@/lib/tv.functions";

export const Route = createFileRoute("/tv")({
  head: () => ({
    meta: [
      { title: "HamdukChess TV — live chess" },
      { name: "description", content: "Watch the top live games on Hamduk Chess with commentary." },
    ],
  }),
  component: TvPage,
});

function TvPage() {
  const fetchGames = useServerFn(getTvGames);
  const [pinned, setPinned] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["tv", "games"],
    queryFn: () => fetchGames(),
    refetchInterval: 30_000,
  });
  const live = q.data?.live ?? [];
  const featured = live.find((g) => g.id === pinned) ?? live[0] ?? null;
  // When the featured game ends, move on to the next best game shortly after.
  const onEnded = useCallback(() => {
    setTimeout(() => setPinned(null), 12_000);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 font-serif text-4xl font-bold tracking-tight">
            <Tv className="h-8 w-8 text-primary" /> HamdukChess{" "}
            <span className="text-gold">TV</span>
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive">
            <Radio className="h-4 w-4 animate-pulse motion-reduce:animate-none" /> {live.length}{" "}
            live
          </span>
        </header>

        {q.isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : !featured ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No live games right now.{" "}
            <Link to="/play" className="text-primary underline">
              Start one
            </Link>{" "}
            — the best games appear here automatically.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <FeaturedBoard key={featured.id} game={featured} onEnded={onEnded} />
            <Commentary gameId={featured.id} />
          </div>
        )}

        {live.length > 1 && (
          <section className="mt-10">
            <h2 className="mb-3 font-serif text-xl font-semibold">More live games</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {live
                .filter((g) => g.id !== featured?.id)
                .map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setPinned(g.id)}
                    className="rounded-xl border border-border bg-card p-2 text-left hover:border-primary/60"
                  >
                    <MiniBoard fen={g.fen} />
                    <GameLabel g={g} />
                  </button>
                ))}
            </div>
          </section>
        )}

        {!!q.data?.finished.length && (
          <section className="mt-10">
            <h2 className="mb-3 font-serif text-xl font-semibold">Top games · last 48 hours</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {q.data.finished.map((g) => (
                <Link
                  key={g.id}
                  to="/spectate/$gameId"
                  params={{ gameId: g.id }}
                  className="rounded-xl border border-border bg-card p-2 hover:border-primary/60"
                >
                  <MiniBoard fen={g.fen} />
                  <GameLabel g={g} />
                  <p className="px-1 text-[11px] text-muted-foreground">
                    {g.result === "draw"
                      ? "Draw"
                      : `${g.result === "white" ? "White" : "Black"} won`}{" "}
                    · {g.end_reason}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function FeaturedBoard({ game, onEnded }: { game: TvGame; onEnded: () => void }) {
  const squares = useBoardSquares();
  const [fen, setFen] = useState(game.fen);
  const [status, setStatus] = useState(game.status);
  const ended = useRef(false);

  useEffect(() => {
    const channel = supabase
      .channel(`tv:game:${game.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${game.id}` },
        (p) => {
          const row = p.new as { fen: string; status: string };
          setFen(row.fen);
          setStatus(row.status);
          if (row.status !== "active" && !ended.current) {
            ended.current = true;
            onEnded();
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [game.id, onEnded]);

  return (
    <section>
      {game.tournament && (
        <Link
          to="/tournaments/$id"
          params={{ id: game.tournament.id }}
          className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold"
        >
          <Trophy className="h-3.5 w-3.5" /> {game.tournament.name}
        </Link>
      )}
      <Player name={game.black.username} rating={game.black.rating} />
      <div className="my-2 aspect-square w-full max-w-[640px]">
        <Chessboard options={{ ...squares, position: fen, allowDragging: false, id: "tv-board" }} />
      </div>
      <Player name={game.white.username} rating={game.white.rating} />
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>
          {game.time_control} · {game.variant}
        </span>
        {status !== "active" && <span className="font-semibold text-foreground">Game over</span>}
        <Link
          to="/spectate/$gameId"
          params={{ gameId: game.id }}
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <Eye className="h-4 w-4" /> Watch with engine & chat
        </Link>
      </div>
    </section>
  );
}

function Commentary({ gameId }: { gameId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchRole = useServerFn(getTvRole);
  const post = useServerFn(postCommentary);
  const appoint = useServerFn(setCommentator);
  const [text, setText] = useState("");
  const [who, setWho] = useState("");

  const role = useQuery({
    queryKey: ["tv", "role", user?.id],
    enabled: !!user,
    queryFn: () => fetchRole(),
  });
  const feed = useQuery({
    queryKey: ["tv", "commentary", gameId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tv_commentary")
        .select("id, content, created_at, ply, profiles!tv_commentary_author_id_fkey(username)")
        .or(`game_id.eq.${gameId},game_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as unknown as {
        id: string;
        content: string;
        created_at: string;
        ply: number | null;
        profiles: { username: string } | null;
      }[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`tv:commentary:${gameId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tv_commentary" }, () => {
        void qc.invalidateQueries({ queryKey: ["tv", "commentary", gameId] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gameId, qc]);

  return (
    <aside className="flex max-h-[720px] flex-col rounded-xl border border-border bg-card">
      <p className="flex items-center gap-2 border-b border-border px-4 py-3 font-semibold">
        <Mic className="h-4 w-4 text-gold" /> Commentary
      </p>
      <ol className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {!feed.data?.length && (
          <li className="text-muted-foreground">No commentary yet for this game.</li>
        )}
        {feed.data?.map((c) => (
          <li key={c.id}>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {c.profiles?.username ?? "Commentator"}
              </span>
              {c.ply ? ` · move ${Math.ceil(c.ply / 2)}` : ""}
            </p>
            <p className="whitespace-pre-wrap">{c.content}</p>
          </li>
        ))}
      </ol>
      {role.data?.isCommentator && (
        <form
          className="border-t border-border p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await post({ data: { gameId, content: text.trim() } });
              setText("");
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Comment on the game…"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <button
            disabled={!text.trim()}
            className="mt-1.5 w-full rounded-md bg-primary py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Post commentary
          </button>
        </form>
      )}
      {role.data?.isAdmin && (
        <form
          className="flex gap-2 border-t border-border p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await appoint({ data: { username: who.trim(), enabled: true } });
              toast.success(`${who} can now commentate`);
              setWho("");
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        >
          <input
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="Add commentator (username)"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
          <button
            disabled={!who.trim()}
            className="rounded-md border border-border px-2 text-xs hover:bg-accent"
          >
            Add
          </button>
        </form>
      )}
    </aside>
  );
}

function Player({ name, rating }: { name: string; rating: number | null }) {
  return (
    <p className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-sm">
      <Link
        to="/profile/$username"
        params={{ username: name }}
        className="font-semibold hover:underline"
      >
        {name}
      </Link>
      <span className="font-mono text-muted-foreground">{rating ?? "—"}</span>
    </p>
  );
}

function MiniBoard({ fen }: { fen: string }) {
  const squares = useBoardSquares();
  return (
    <div className="pointer-events-none aspect-square w-full">
      <Chessboard
        options={{ ...squares, position: fen, allowDragging: false, showNotation: false }}
      />
    </div>
  );
}

function GameLabel({ g }: { g: TvGame }) {
  return (
    <p className="mt-1.5 truncate px-1 text-xs">
      <span className="font-semibold">{g.white.username}</span>
      <span className="text-muted-foreground"> vs </span>
      <span className="font-semibold">{g.black.username}</span>
      <span className="text-muted-foreground"> · {g.combined}</span>
    </p>
  );
}
