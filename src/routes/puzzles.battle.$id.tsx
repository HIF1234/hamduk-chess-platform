import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Loader2, Swords, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PuzzleBoard } from "@/components/puzzles/PuzzleBoard";
import {
  answerBattle,
  cancelBattle,
  createPrivateBattle,
  findBattle,
  getBattle,
  joinBattle,
} from "@/lib/puzzle-battle.functions";

export const Route = createFileRoute("/puzzles/battle/$id")({
  head: () => ({ meta: [{ title: "Puzzle Battle — Hamduk Chess" }] }),
  component: BattleRoom,
});

type State = Awaited<ReturnType<typeof getBattle>>;
type Battle = State["battle"];

const TARGET = 5;

function BattleRoom() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchBattle = useServerFn(getBattle);
  const answer = useServerFn(answerBattle);
  const join = useServerFn(joinBattle);
  const cancel = useServerFn(cancelBattle);
  const find = useServerFn(findBattle);
  const rematchPrivate = useServerFn(createPrivateBattle);
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState<"right" | "wrong" | null>(null);
  const offset = useRef(0);

  const key = ["puzzle-battle", id];
  const q = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const r = await fetchBattle({ data: { battleId: id } });
      offset.current = r.serverNow - Date.now();
      return r;
    },
  });
  const state = q.data;
  const b = state?.battle;

  // Live updates: merge the row; refetch when the battle starts so the puzzles arrive.
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`puzzle-battle-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "puzzle_battles", filter: `id=eq.${id}` },
        (payload) => {
          const row = payload.new as Battle;
          const prev = qc.getQueryData<State>(key);
          if (!prev || prev.battle.status !== row.status || !prev.names.b) {
            void qc.invalidateQueries({ queryKey: key });
          } else {
            qc.setQueryData<State>(key, { ...prev, battle: { ...prev.battle, ...row } });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset.current), 250);
    return () => clearInterval(t);
  }, []);

  // Two players who opened public battles at the same moment would each wait forever;
  // re-running matchmaking lets one of them join the other.
  const waitingPublic = b?.status === "waiting" && !b.is_private && state?.seated;
  useEffect(() => {
    if (!waitingPublic) return;
    const t = setInterval(async () => {
      try {
        const r = await find();
        if (r.battleId !== id)
          void navigate({ to: "/puzzles/battle/$id", params: { id: r.battleId } });
      } catch {
        /* keep waiting */
      }
    }, 5000);
    return () => clearInterval(t);
  }, [waitingPublic, id, find, navigate]);

  // When the clock runs out, ask the server to settle the result.
  const expired = b?.status === "active" && b.ends_at && now >= new Date(b.ends_at).getTime();
  useEffect(() => {
    if (expired) void qc.invalidateQueries({ queryKey: key });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  if (loading || (user && q.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!user) {
    return (
      <Centered>
        <p className="text-muted-foreground">Sign in to join this Puzzle Battle.</p>
        <Link to="/login" className="mt-4 inline-block text-primary underline">
          Sign in
        </Link>
      </Centered>
    );
  }
  if (q.error || !state || !b) {
    return (
      <Centered>
        <p className="text-muted-foreground">
          {(q.error as Error | null)?.message ?? "Battle not found."}
        </p>
        <Link to="/puzzles/battle" className="mt-4 inline-block text-primary underline">
          Back to Puzzle Battle
        </Link>
      </Centered>
    );
  }

  const me = state.you;
  const myIndex = me === "a" ? b.a_index : b.b_index;
  const myScore = me === "a" ? b.a_score : b.b_score;
  const theirScore = me === "a" ? b.b_score : b.a_score;
  const myName = me === "a" ? state.names.a : state.names.b;
  const theirName = me === "a" ? state.names.b : state.names.a;

  // Someone opening a friend's invite link.
  if (b.status === "waiting" && !state.seated) {
    return (
      <Centered>
        <Swords className="mx-auto h-10 w-10 text-primary" />
        <p className="mt-3 text-lg">
          <span className="font-semibold">{state.names.a}</span> challenges you to a Puzzle Battle.
        </p>
        <button
          onClick={async () => {
            try {
              await join({ data: { battleId: id } });
              void qc.invalidateQueries({ queryKey: key });
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
          className="mt-5 rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
        >
          Accept
        </button>
      </Centered>
    );
  }

  if (b.status === "waiting" || b.status === "cancelled") {
    const link = typeof window !== "undefined" ? window.location.href : "";
    return (
      <Centered>
        {b.status === "cancelled" ? (
          <p className="text-muted-foreground">This battle was cancelled.</p>
        ) : b.is_private ? (
          <>
            <p className="font-semibold">Send this link to a friend</p>
            <div className="mt-3 flex gap-2">
              <input
                readOnly
                value={link}
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs"
              />
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  toast.success("Link copied");
                }}
                className="rounded-md border border-border px-3 hover:bg-accent"
                aria-label="Copy link"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Waiting for them to accept…
            </p>
          </>
        ) : (
          <p className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Looking for an opponent near your puzzle
            rating…
          </p>
        )}
        <button
          onClick={async () => {
            if (b.status === "waiting") await cancel({ data: { battleId: id } });
            void navigate({ to: "/puzzles/battle" });
          }}
          className="mt-6 text-sm text-muted-foreground underline"
        >
          {b.status === "waiting" ? "Cancel" : "Back"}
        </button>
      </Centered>
    );
  }

  const startsIn = Math.ceil((new Date(b.started_at!).getTime() - now) / 1000);
  const left = Math.max(0, Math.ceil((new Date(b.ends_at!).getTime() - now) / 1000));
  const puzzle = state.puzzles[myIndex];
  const finished = b.status === "finished";

  async function onComplete(success: boolean, moves: string[]) {
    if (sending) return;
    setSending(true);
    setFlash(success ? "right" : "wrong");
    try {
      const r = await answer({ data: { battleId: id, index: myIndex, moves } });
      const prev = qc.getQueryData<State>(key);
      // Short pause so the player sees the result before the next puzzle appears.
      setTimeout(() => {
        if (prev && r.battle)
          qc.setQueryData<State>(key, { ...prev, battle: { ...prev.battle, ...r.battle } });
        setFlash(null);
        setSending(false);
      }, 600);
    } catch (e) {
      toast.error((e as Error).message);
      setFlash(null);
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <ScoreCard name={myName ?? "you"} score={myScore} you />
          <div
            className={`text-center font-mono text-2xl font-bold ${left <= 30 && !finished ? "text-destructive" : ""}`}
          >
            {finished ? "—" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
          </div>
          <ScoreCard name={theirName ?? "opponent"} score={theirScore} />
        </div>

        {finished ? (
          <Result
            won={b.winner === user.id}
            drew={!b.winner}
            mine={myScore}
            theirs={theirScore}
            onRematch={async () => {
              try {
                const r = b.is_private ? await rematchPrivate() : await find();
                void navigate({ to: "/puzzles/battle/$id", params: { id: r.battleId } });
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          />
        ) : startsIn > 0 ? (
          <Centered>
            <p className="text-muted-foreground">Get ready…</p>
            <p className="mt-2 font-mono text-7xl font-bold text-primary">{startsIn}</p>
          </Centered>
        ) : puzzle ? (
          <div className="relative">
            <PuzzleBoard
              key={`${id}-${myIndex}`}
              puzzle={puzzle}
              onComplete={(ok, moves) => queueMicrotask(() => void onComplete(ok, moves))}
              hideHint
            />
            {flash && (
              <p
                className={`mt-2 text-center font-semibold ${flash === "right" ? "text-primary" : "text-destructive"}`}
              >
                {flash === "right" ? "Solved!" : "Missed it — next puzzle"}
              </p>
            )}
          </div>
        ) : (
          <Centered>
            <p className="text-muted-foreground">
              You've been through every puzzle. Waiting for the clock…
            </p>
          </Centered>
        )}
      </main>
    </div>
  );
}

function ScoreCard({ name, score, you }: { name: string; score: number; you?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${you ? "border-primary/50 bg-primary/10" : "border-border bg-card"}`}
    >
      <p className="truncate text-sm font-medium">
        {name}
        {you && <span className="ml-1 text-xs text-primary">(you)</span>}
      </p>
      <div className="mt-1.5 flex gap-1" aria-label={`${score} of ${TARGET} solved`}>
        {Array.from({ length: TARGET }, (_, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-full ${i < score ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>
    </div>
  );
}

function Result({
  won,
  drew,
  mine,
  theirs,
  onRematch,
}: {
  won: boolean;
  drew: boolean;
  mine: number;
  theirs: number;
  onRematch: () => void;
}) {
  return (
    <Centered>
      <Trophy className={`mx-auto h-12 w-12 ${won ? "text-gold" : "text-muted-foreground"}`} />
      <p className="mt-3 font-serif text-4xl font-bold">
        {won ? "You win!" : drew ? "It's a draw" : "You lost"}
      </p>
      <p className="mt-1 font-mono text-xl">
        {mine}–{theirs}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={onRematch}
          className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground"
        >
          Play again
        </button>
        <Link
          to="/puzzles/battle"
          className="rounded-md border border-border px-4 py-2 hover:bg-accent"
        >
          Lobby
        </Link>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md px-4 py-16 text-center">{children}</div>;
}
