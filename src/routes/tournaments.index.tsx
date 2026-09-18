import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Loader2, Plus, Trophy, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { createTournament } from "@/lib/tournaments.functions";
import {
  TOURNAMENT_TYPES,
  TOURNAMENT_TIME_CONTROLS,
  statusLabel,
  typeLabel,
  type TournamentType,
} from "@/lib/tournament-config";

export const Route = createFileRoute("/tournaments/")({
  head: () => ({
    meta: [
      { title: "Chess Tournaments — Hamduk Chess" },
      {
        name: "description",
        content:
          "Join Swiss, Arena, Round-Robin and Knockout chess tournaments with live standings and broadcast boards.",
      },
      { property: "og:title", content: "Chess Tournaments — Hamduk Chess" },
      {
        property: "og:description",
        content: "Join Swiss, Arena, Round-Robin and Knockout chess tournaments with live standings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TournamentsIndex,
});

type Row = {
  id: string;
  name: string;
  type: string;
  time_control: string;
  variant: string;
  rated: boolean;
  rounds: number;
  starts_at: string;
  max_players: number;
  min_tier: string;
  entry_fee_kobo: number;
  status: string;
};

function TournamentsIndex() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const create = useServerFn(createTournament);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: "",
    type: "swiss" as TournamentType,
    timeControl: "5+0" as (typeof TOURNAMENT_TIME_CONTROLS)[number],
    variant: "standard" as "standard" | "chess960",
    rated: true,
    rounds: 5,
    startsAt: new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 16),
    durationMin: 60,
    maxPlayers: 32,
    minTier: "free" as "free" | "plus" | "gold",
    entryFeeNgn: 0,
  });

  const listQuery = useQuery({
    queryKey: ["tournaments", "list"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select(
          "id, name, type, time_control, variant, rated, rounds, starts_at, max_players, min_tier, entry_fee_kobo, status",
        )
        .is("club_id", null)
        .order("starts_at", { ascending: true })
        .limit(60);
      if (error) throw error;
      const rows = (data ?? []) as Row[];
      const counts: Record<string, number> = {};
      if (rows.length) {
        const { data: players } = await supabase
          .from("tournament_players")
          .select("tournament_id")
          .in("tournament_id", rows.map((r) => r.id));
        for (const p of players ?? []) counts[p.tournament_id] = (counts[p.tournament_id] ?? 0) + 1;
      }
      return { rows, counts };
    },
  });

  const rows = listQuery.data?.rows ?? [];
  const groups = {
    live: rows.filter((r) => r.status === "live"),
    scheduled: rows.filter((r) => r.status === "scheduled"),
    completed: rows.filter((r) => r.status === "completed"),
  };

  async function submit() {
    setBusy(true);
    try {
      const res = await create({
        data: {
          name: form.name.trim(),
          type: form.type,
          timeControl: form.timeControl,
          variant: form.variant,
          rated: form.rated,
          rounds: form.rounds,
          startsAt: new Date(form.startsAt).toISOString(),
          durationMin: form.durationMin,
          maxPlayers: form.maxPlayers,
          minTier: form.minTier,
          entryFeeKobo: Math.round(form.entryFeeNgn * 100),
        },
      });
      toast.success("Tournament created");
      navigate({ to: "/tournaments/$id", params: { id: res.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl font-bold tracking-tight">Tournaments</h1>
            <p className="mt-1 text-muted-foreground">
              Swiss, Arena, Round-Robin and Knockout events with live standings and broadcast boards.
            </p>
          </div>
          {user && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Create
            </button>
          )}
        </header>

        {showCreate && (
          <section className="mb-10 rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-serif text-xl font-bold">New tournament</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  maxLength={80}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Format</span>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as TournamentType })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  {TOURNAMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label} — {t.blurb}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Time control</span>
                <select
                  value={form.timeControl}
                  onChange={(e) =>
                    setForm({ ...form, timeControl: e.target.value as typeof form.timeControl })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  {TOURNAMENT_TIME_CONTROLS.map((tc) => (
                    <option key={tc} value={tc}>{tc}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Variant</span>
                <select
                  value={form.variant}
                  onChange={(e) => setForm({ ...form, variant: e.target.value as "standard" })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="standard">Standard</option>
                  <option value="chess960">Chess960</option>
                </select>
              </label>
              {form.type === "arena" ? (
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Duration (minutes)</span>
                  <input
                    type="number"
                    min={15}
                    max={360}
                    value={form.durationMin}
                    onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                  />
                </label>
              ) : (
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Rounds</span>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={form.rounds}
                    onChange={(e) => setForm({ ...form, rounds: Number(e.target.value) })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                  />
                </label>
              )}
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Start time</span>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Max players</span>
                <input
                  type="number"
                  min={2}
                  max={256}
                  value={form.maxPlayers}
                  onChange={(e) => setForm({ ...form, maxPlayers: Number(e.target.value) })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Minimum membership</span>
                <select
                  value={form.minTier}
                  onChange={(e) => setForm({ ...form, minTier: e.target.value as "free" })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="free">Anyone</option>
                  <option value="plus">Plus and above</option>
                  <option value="gold">Gold only</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Entry fee (₦, 0 = free)</span>
                <input
                  type="number"
                  min={0}
                  value={form.entryFeeNgn}
                  onChange={(e) => setForm({ ...form, entryFeeNgn: Number(e.target.value) })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.rated}
                  onChange={(e) => setForm({ ...form, rated: e.target.checked })}
                />
                Rated
              </label>
            </div>
            <button
              onClick={() => void submit()}
              disabled={busy || form.name.trim().length < 3}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create tournament
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              Creating tournaments needs Plus (up to 64 players) or Gold (up to 256 players).
            </p>
          </section>
        )}

        {listQuery.isLoading && <Loader2 className="h-6 w-6 animate-spin" />}

        {(["live", "scheduled", "completed"] as const).map((key) => (
          <section key={key} className="mb-8">
            <h2 className="mb-3 font-serif text-xl font-bold">{statusLabel(key)}</h2>
            {groups[key].length === 0 ? (
              <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Nothing here yet.
              </p>
            ) : (
              <div className="grid gap-3">
                {groups[key].map((t) => (
                  <Link
                    key={t.id}
                    to="/tournaments/$id"
                    params={{ id: t.id }}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 transition hover:border-primary/60"
                  >
                    <div>
                      <p className="flex items-center gap-2 font-semibold">
                        <Trophy className="h-4 w-4 text-primary" /> {t.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {typeLabel(t.type)} · {t.time_control} · {t.variant}
                        {!t.rated && " · casual"}
                        {t.entry_fee_kobo > 0 && ` · ₦${(t.entry_fee_kobo / 100).toLocaleString()}`}
                        {t.min_tier !== "free" && ` · ${t.min_tier}+`}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p className="flex items-center justify-end gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {listQuery.data?.counts[t.id] ?? 0}/{t.max_players}
                      </p>
                      <p className="mt-0.5 flex items-center justify-end gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {new Date(t.starts_at).toLocaleString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
