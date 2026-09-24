import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, EmptyState, Pager, PageHeader, Pill, when } from "@/components/admin/AdminUi";
import { listReports, resolveReport } from "@/lib/admin.functions";
import { getReportTargets, removeReportedContent } from "@/lib/admin-extra.functions";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Moderation queue | Hamduk Chess staff" },
      { name: "description", content: "User reports awaiting moderation." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminReports,
  errorComponent: ({ error }) => (
    <div className="p-4 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-4 text-sm text-muted-foreground">Not found</div>,
});

function AdminReports() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"all" | "open" | "resolved" | "dismissed">("open");
  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const reports = useQuery({
    queryKey: ["admin-reports", status, page],
    queryFn: () => listReports({ data: { status, page } }),
  });

  const items = (reports.data?.reports ?? []).map((r) => ({
    type: r.target_type,
    id: r.target_id,
  }));
  const targets = useQuery({
    queryKey: ["admin-report-targets", items.map((i) => `${i.type}:${i.id}`).join(",")],
    enabled: items.length > 0,
    queryFn: () => getReportTargets({ data: { items } }),
  });
  const remove = useMutation({
    mutationFn: (reportId: string) => removeReportedContent({ data: { reportId } }),
    onSuccess: () => {
      toast.success("Content removed and report resolved");
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      qc.invalidateQueries({ queryKey: ["admin-report-targets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolve = useMutation({
    mutationFn: (v: { reportId: string; status: "resolved" | "dismissed"; note: string }) =>
      resolveReport({ data: v }),
    onSuccess: () => {
      toast.success("Report updated");
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const act = (id: string, next: "resolved" | "dismissed") => {
    const note = notes[id] ?? "";
    if (note.trim().length < 3) {
      toast.error("Add a resolution note — it goes into the audit log.");
      return;
    }
    resolve.mutate({ reportId: id, status: next, note });
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Abuse, cheating and profile reports filed by players."
        action={
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">All</option>
          </select>
        }
      />
      {reports.isLoading ? (
        <EmptyState>Loading reports…</EmptyState>
      ) : !reports.data?.reports.length ? (
        <Card>
          <EmptyState>Nothing in this queue.</EmptyState>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.data.reports.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {r.reason} <span className="text-muted-foreground">on {r.target_type}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    by {r.reporterName} · {when(r.created_at)}
                  </p>
                  {(() => {
                    const t = targets.data?.[`${r.target_type}:${r.target_id}`];
                    if (!t) return null;
                    return (
                      <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                        {t.href ? (
                          <Link to={t.href} className="font-medium text-primary hover:underline">
                            {t.label}
                          </Link>
                        ) : (
                          <span className="font-medium">{t.label}</span>
                        )}
                        {t.content ? (
                          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                            {t.content}
                          </p>
                        ) : null}
                        {t.removable && r.status === "open" ? (
                          <button
                            type="button"
                            onClick={() => remove.mutate(r.id)}
                            className="mt-2 rounded-lg border border-destructive/50 px-3 py-1 text-xs text-destructive"
                          >
                            Remove post & resolve
                          </button>
                        ) : null}
                      </div>
                    );
                  })()}
                  {r.details ? <p className="mt-2 text-sm">{r.details}</p> : null}
                  {r.resolution_note ? (
                    <p className="mt-2 text-xs text-muted-foreground">Note: {r.resolution_note}</p>
                  ) : null}
                </div>
                <Pill tone={r.status === "open" ? "warn" : "muted"}>{r.status}</Pill>
              </div>
              {r.status === "open" ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    placeholder="Resolution note"
                    className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => act(r.id, "resolved")}
                    className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  >
                    Resolve
                  </button>
                  <button
                    type="button"
                    onClick={() => act(r.id, "dismissed")}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
      <Pager page={page} pageSize={25} total={reports.data?.total ?? 0} onPage={setPage} />
    </div>
  );
}
