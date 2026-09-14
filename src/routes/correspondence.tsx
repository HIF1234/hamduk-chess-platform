import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Loader2, Palmtree, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  createCorrespondenceGame,
  listCorrespondenceGames,
  setVacationMode,
} from "@/lib/correspondence.functions";

export const Route = createFileRoute("/correspondence")({
  head: () => ({
    meta: [
      { title: "Correspondence Chess — Hamduk Chess" },
      { name: "description", content: "Play slow chess with 1, 3 or 7 days per move, conditional moves and vacation days." },
      { property: "og:title", content: "Correspondence Chess — Hamduk Chess" },
      { property: "og:description", content: "Play slow chess with 1, 3 or 7 days per move, conditional moves and vacation days." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CorrespondencePage,
});

function deadlineLabel(deadline: string | null) {
  if (!deadline) return "—";
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "overdue";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

function CorrespondencePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const create = useServerFn(createCorrespondenceGame);
  const list = useServerFn(listCorrespondenceGames);
  const vacation = useServerFn(setVacationMode);

  const [opponent, setOpponent] = useState("");
  const [days, setDays] = useState<1 | 3 | 7>(3);
  const [variant, setVariant] = useState<"standard" | "chess960">("standard");
  const [busy, setBusy] = useState(false);
  const [vacDays, setVacDays] = useState(7);

  const q = useQuery({
    queryKey: ["correspondence", user?.id],
    enabled: !!user,
    queryFn: () => list({}),
  });

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Sign in to play correspondence chess.</p>
        <Link to="/login" className="text-primary underline">Sign in</Link>
      </div>
    );
  }

  async function handleCreate() {
    setBusy(true);
    try {
      const { gameId, opponent: name } = await create({
        data: { opponentUsername: opponent.trim(), daysPerMove: days, variant, color: "random", notifyByEmail: true },
      });
      toast.success(`Challenge started against ${name}.`);
      navigate({ to: "/play/$gameId", params: { gameId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the game");
    } finally {
      setBusy(false);
    }
  }

  const active = (q.data?.games ?? []).filter((g) => g.status === "active");
  const finished = (q.data?.games ?? []).filter((g) => g.status !== "active");
  const vac = q.data?.vacation;
  const onVacation = !!vac?.until && new Date(vac.until).getTime() > Date.now();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <h1 className="font-serif text-4xl font-bold tracking-tight">Correspondence</h1>
          <p className="mt-1 text-muted-foreground">
            Slow games with days per move. Save a conditional reply so an expected move answers itself.
          </p>
        </header>

        <section className="mb-8 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-serif text-xl font-semibold">
            <Plus className="h-5 w-5 text-primary" /> New challenge
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              placeholder="Opponent username"
              className="min-w-[200px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="inline-flex rounded-lg border border-border p-1">
              {([1, 3, 7] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {d}d/move
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border border-border p-1">
              {(["standard", "chess960"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVariant(v)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${variant === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {v === "standard" ? "Standard" : "Chess960"}
                </button>
              ))}
            </div>
            <button
              onClick={handleCreate}
              disabled={busy || opponent.trim().length < 2}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {busy ? "Starting…" : "Challenge"}
            </button>
          </div>
          {q.data?.tier === "free" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Free accounts can run 3 correspondence games at once.{" "}
              <Link to="/billing" className="text-primary underline">Upgrade</Link> for unlimited.
            </p>
          )}
        </section>

        <section className="mb-8 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-2 flex items-center gap-2 font-serif text-xl font-semibold">
            <Palmtree className="h-5 w-5 text-accent" /> Vacation
          </h2>
          <p className="text-sm text-muted-foreground">
            {onVacation
              ? `On vacation until ${new Date(vac!.until!).toLocaleDateString()} — your clocks are paused.`
              : `Pause your correspondence deadlines. ${(vac?.maxDays ?? 14) - (vac?.daysUsed ?? 0)} of ${vac?.maxDays ?? 14} days left this year.`}
          </p>
          <div className="mt-3 flex items-center gap-2">
            {!onVacation && (
              <>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={vacDays}
                  onChange={(e) => setVacDays(Math.max(1, Math.min(14, Number(e.target.value) || 1)))}
                  className="w-20 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  onClick={async () => {
                    try {
                      await vacation({ data: { days: vacDays } });
                      toast.success("Vacation started.");
                      void q.refetch();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not start vacation");
                    }
                  }}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
                >
                  Start vacation
                </button>
              </>
            )}
            {onVacation && (
              <button
                onClick={async () => {
                  await vacation({ data: { days: 0 } }).catch(() => undefined);
                  toast.success("Vacation ended.");
                  void q.refetch();
                }}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
              >
                End vacation now
              </button>
            )}
          </div>
        </section>

        <h2 className="mb-3 flex items-center gap-2 font-serif text-xl font-semibold">
          <CalendarClock className="h-5 w-5 text-primary" /> Your games
        </h2>
        {q.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {!q.isLoading && active.length === 0 && (
          <p className="rounded-xl border border-border bg-card p-5 text-muted-foreground">No active correspondence games yet.</p>
        )}
        <div className="grid gap-2">
          {active.map((g) => (
            <Link
              key={g.id}
              to="/play/$gameId"
              params={{ gameId: g.id }}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 transition hover:border-primary/60 ${g.myTurn ? "border-primary bg-primary/5" : "border-border bg-card"}`}
            >
              <div>
                <p className="font-semibold">vs {g.opponent}</p>
                <p className="text-xs text-muted-foreground">
                  {g.color} · {g.variant} · {g.daysPerMove}d/move · move {Math.floor(g.ply / 2) + 1}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${g.myTurn ? "text-primary" : "text-muted-foreground"}`}>
                  {g.myTurn ? "Your move" : "Waiting"}
                </p>
                <p className="font-mono text-xs text-muted-foreground">{deadlineLabel(g.moveDeadline)}</p>
              </div>
            </Link>
          ))}
        </div>

        {finished.length > 0 && (
          <>
            <h3 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Finished</h3>
            <div className="grid gap-2">
              {finished.map((g) => (
                <Link
                  key={g.id}
                  to="/play/$gameId"
                  params={{ gameId: g.id }}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-primary/60"
                >
                  <span>vs {g.opponent}</span>
                  <span className="text-muted-foreground">
                    {g.result === "draw" ? "Draw" : g.result === g.color ? "Won" : "Lost"} · {g.endReason ?? "—"}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
