import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { ChevronLeft, Crosshair, Crown, Loader2, Search, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useBoardSquares } from "@/lib/preferences";
import { getOpeningPrep, type PrepOpening, type PrepSide } from "@/lib/prep.functions";

export const Route = createFileRoute("/prep/$username")({
  head: ({ params }) => ({
    meta: [{ title: `Prepare against ${params.username} — Hamduk Chess` }],
  }),
  component: PrepPage,
});

const pct = (x: number) => `${Math.round(x * 100)}%`;
const key = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

function PrepPage() {
  const { username } = Route.useParams();
  const { user, isGuest, loading } = useAuth();
  const navigate = useNavigate();
  const fetchPrep = useServerFn(getOpeningPrep);
  const [lookup, setLookup] = useState("");
  const q = useQuery({
    queryKey: ["prep", username.toLowerCase()],
    enabled: !!user && !isGuest,
    staleTime: 10 * 60_000,
    queryFn: () => fetchPrep({ data: { username } }),
  });

  const search = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (lookup.trim())
          void navigate({ to: "/prep/$username", params: { username: lookup.trim() } });
      }}
      className="flex gap-2"
    >
      <input
        value={lookup}
        onChange={(e) => setLookup(e.target.value)}
        placeholder="Another opponent's username"
        className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <button className="rounded-md border border-border px-3 hover:bg-accent" aria-label="Look up">
        <Search className="h-4 w-4" />
      </button>
    </form>
  );

  if (!loading && (!user || isGuest)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-muted-foreground">Create a free account to prepare for opponents.</p>
        <Link to="/login" className="mt-4 inline-block text-primary underline">
          Sign in
        </Link>
      </div>
    );
  }

  const p = q.data;
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link
          to="/profile/$username"
          params={{ username }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> {username}'s profile
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="flex items-center gap-2 font-serif text-3xl font-bold">
            <Crosshair className="h-7 w-7 text-primary" /> Prepare against {p?.username ?? username}
          </h1>
          <div className="w-full sm:w-72">{search}</div>
        </div>

        {q.isLoading && <Loader2 className="mt-8 h-6 w-6 animate-spin" />}
        {q.error && <p className="mt-8 text-destructive">{(q.error as Error).message}</p>}
        {p && p.white.games + p.black.games === 0 && (
          <p className="mt-8 rounded-xl border border-border bg-card p-6 text-muted-foreground">
            {p.username} hasn't finished any games yet, so there's nothing to prepare from.
          </p>
        )}
        {p && p.white.games + p.black.games > 0 && (
          <>
            <p className="mt-2 text-muted-foreground">
              Rated {p.rating} · last 20 games: {p.recent.wins} won, {p.recent.losses} lost,{" "}
              {p.recent.draws} drawn · from {p.white.games + p.black.games} recent games
            </p>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <SideCard title={`When ${p.username} has White`} side={p.white} gold={p.gold} />
              <SideCard title={`When ${p.username} has Black`} side={p.black} gold={p.gold} />
            </div>
            {p.gold ? (
              <TreeExplorer white={p.white} black={p.black} username={p.username} />
            ) : (
              <p className="mt-6 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                <Crown className="mr-1 inline h-4 w-4 text-gold" />
                Their weak spots, every opening they play and a move-by-move explorer of their
                repertoire come with{" "}
                <Link to="/billing" className="text-primary underline">
                  Hamduk Gold
                </Link>
                .
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SideCard({ title, side, gold }: { title: string; side: PrepSide; gold: boolean }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">
        {side.games} games · they score {pct(side.score)}
      </p>
      {side.weak.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Crosshair className="h-3.5 w-3.5" /> Steer toward
          </p>
          <OpeningList items={side.weak} />
        </div>
      )}
      {side.strong.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-destructive">
            <ShieldAlert className="h-3.5 w-3.5" /> Their comfort zone
          </p>
          <OpeningList items={side.strong} />
        </div>
      )}
      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {gold ? "Openings they reach" : "Most played"}
        </p>
        {side.openings.length ? (
          <OpeningList items={side.openings} />
        ) : (
          <p className="text-sm text-muted-foreground">No named openings yet.</p>
        )}
      </div>
    </section>
  );
}

function OpeningList({ items }: { items: PrepOpening[] }) {
  return (
    <ul className="mt-1 divide-y divide-border text-sm">
      {items.map((o) => (
        <li key={o.name} className="flex items-baseline justify-between gap-3 py-1.5">
          <span className="min-w-0">
            <span className="font-medium">{o.name}</span>
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {o.games} ·{" "}
            <span
              className={
                o.score <= 0.45 ? "text-primary" : o.score >= 0.6 ? "text-destructive" : ""
              }
            >
              {pct(o.score)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Walk through the opponent's moves from the start position. */
function TreeExplorer({
  white,
  black,
  username,
}: {
  white: PrepSide;
  black: PrepSide;
  username: string;
}) {
  const [theyAre, setTheyAre] = useState<"white" | "black">("white");
  const [line, setLine] = useState<string[]>([]);
  const boardSquares = useBoardSquares();
  const side = theyAre === "white" ? white : black;

  const fen = useMemo(() => {
    const c = new Chess();
    for (const uci of line)
      c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return c.fen();
  }, [line]);
  const moves = side.tree[key(fen)] ?? [];
  const total = moves.reduce((t, m) => t + m.games, 0);
  const theirTurn = (fen.split(" ")[1] === "w") === (theyAre === "white");
  const sans = useMemo(() => {
    const c = new Chess();
    return line.map(
      (uci) => c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san,
    );
  }, [line]);

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Their repertoire, move by move</h2>
        <div className="flex gap-0.5 rounded-lg border border-border p-0.5 text-sm">
          {(["white", "black"] as const).map((c) => (
            <button
              key={c}
              onClick={() => {
                setTheyAre(c);
                setLine([]);
              }}
              className={`rounded-md px-3 py-1 ${theyAre === c ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              They have {c === "white" ? "White" : "Black"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]">
        <div className="aspect-square w-full max-w-[320px]">
          <Chessboard
            options={{
              id: "prep-board",
              position: fen,
              allowDragging: false,
              boardOrientation: theyAre === "white" ? "black" : "white",
              ...boardSquares,
            }}
          />
        </div>
        <div className="min-w-0 text-sm">
          <p className="min-h-5 font-mono text-xs text-muted-foreground">
            {sans.length
              ? sans.map((s, i) => `${i % 2 === 0 ? `${i / 2 + 1}. ` : ""}${s}`).join(" ")
              : "Start position"}
          </p>
          <p className="mt-2 font-medium">
            {theirTurn ? `What ${username} plays here` : `What ${username}'s opponents played here`}
          </p>
          {moves.length ? (
            <ul className="mt-1 divide-y divide-border">
              {moves.map((m) => (
                <li key={m.uci}>
                  <button
                    onClick={() => setLine((l) => [...l, m.uci])}
                    className="flex w-full items-center justify-between gap-3 py-1.5 text-left hover:bg-accent/50"
                  >
                    <span className="font-mono font-semibold">{m.san}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {m.games} ({pct(m.games / total)}) · they score {pct(m.score)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-muted-foreground">Their games haven't reached this position.</p>
          )}
          {line.length > 0 && (
            <div className="mt-3 flex gap-3 text-sm">
              <button
                onClick={() => setLine((l) => l.slice(0, -1))}
                className="text-primary hover:underline"
              >
                ← Back
              </button>
              <button onClick={() => setLine([])} className="text-muted-foreground hover:underline">
                Start over
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
