import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, EmptyState, PageHeader, Pill } from "@/components/admin/AdminUi";
import {
  adminListTournaments,
  closeTournament,
  overrideTournamentResult,
} from "@/lib/tournaments.functions";
import { typeLabel } from "@/lib/tournament-config";

export const Route = createFileRoute("/admin/tournaments")({
  head: () => ({
    meta: [
      { title: "Tournaments | Hamduk Chess staff" },
      { name: "description", content: "Force-close tournaments and override recorded results." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminTournaments,
  errorComponent: ({ error }) => <div className="p-4 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-4 text-sm text-muted-foreground">Not found</div>,
});

function AdminTournaments() {
  const list = useQuery({ queryKey: ["admin-tournaments"], queryFn: () => adminListTournaments() });
  const override = useServerFn(overrideTournamentResult);
  const close = useServerFn(closeTournament);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      await list.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Tournaments" subtitle="Force-close events and override recorded results." />
      {list.isLoading ? (
        <EmptyState>Loading tournaments…</EmptyState>
      ) : !list.data?.tournaments.length ? (
        <Card>
          <EmptyState>No tournaments yet.</EmptyState>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.data.tournaments.map((t) => {
            const pairings = list.data.pairings.filter((p) => p.tournament_id === t.id);
            return (
              <Card key={t.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {typeLabel(t.type)} · round {t.current_round}/{t.rounds} ·{" "}
                      {new Date(t.starts_at).toLocaleString()}
                      {t.entry_fee_kobo > 0 && ` · ₦${(t.entry_fee_kobo / 100).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={t.status === "live" ? "good" : "muted"}>{t.status}</Pill>
                    {t.status !== "completed" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(() => close({ data: { tournamentId: t.id } }), "Tournament closed")
                        }
                        className="rounded-md border border-border px-2.5 py-1 text-xs disabled:opacity-40"
                      >
                        Force close
                      </button>
                    )}
                  </div>
                </div>

                {pairings.length > 0 && (
                  <div className="mt-3 space-y-1.5 text-sm">
                    {pairings.slice(0, 12).map((p) => (
                      <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="truncate">
                          R{p.round}: {list.data.names[p.white_id ?? ""] ?? "—"} vs{" "}
                          {list.data.names[p.black_id ?? ""] ?? "—"}{" "}
                          <span className="text-muted-foreground">({p.result ?? "pending"})</span>
                        </span>
                        <span className="flex gap-1">
                          {(["white", "draw", "black"] as const).map((r) => (
                            <button
                              key={r}
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  () =>
                                    override({
                                      data: {
                                        tournamentGameId: p.id,
                                        result: r,
                                        reason: "staff override",
                                      },
                                    }),
                                  "Result overridden",
                                )
                              }
                              className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-40"
                            >
                              {r === "white" ? "1–0" : r === "draw" ? "½–½" : "0–1"}
                            </button>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
