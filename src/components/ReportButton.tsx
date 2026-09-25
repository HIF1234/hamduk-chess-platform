import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Flag, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fileReport, REPORT_REASONS } from "@/lib/reports.functions";

/** Small "Report" control that expands into a reason picker. */
export function ReportButton({
  targetType,
  targetId,
  label = "Report",
}: {
  targetType: "user" | "game" | "club_post" | "message" | "forum_post" | "game_comment";
  targetId: string;
  label?: string;
}) {
  const { user } = useAuth();
  const submit = useServerFn(fileReport);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("cheating");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
      >
        <Flag className="h-3.5 w-3.5" /> {label}
      </button>
    );
  }
  return (
    <div className="w-full max-w-sm rounded-lg border border-border bg-card p-3 text-sm">
      <p className="mb-2 font-medium">What's wrong?</p>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5"
      >
        {REPORT_REASONS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Anything that helps us review it (optional)"
        className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 hover:bg-accent">
          Cancel
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await submit({
                data: { targetType, targetId, reason, details: details || undefined },
              });
              toast.success("Report sent. Our moderators will review it.");
              setOpen(false);
              setDetails("");
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 font-semibold text-white disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Send report
        </button>
      </div>
    </div>
  );
}
