import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, Loader2, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { SavedAnalysis } from "./AnalysisApp";

/** Save the board to a shareable /analysis/<id> link, or update/delete your own. */
export function SaveAnalysisPanel({
  saved,
  startFen,
  headers,
  moves,
  ply,
  orientation,
}: {
  saved?: SavedAnalysis;
  startFen: string;
  headers: Record<string, string>;
  moves: string[];
  ply: number;
  orientation: "white" | "black";
}) {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mine = !!saved && saved.owner_id === user?.id;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(saved?.title ?? "");
  const [notes, setNotes] = useState(saved?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const link = saved
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/analysis/${saved.id}`
    : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  async function save(asNew: boolean) {
    if (!title.trim()) return toast.error("Give it a title.");
    setBusy(true);
    const row = {
      title: title.trim(),
      notes: notes.trim() || null,
      start_fen: startFen,
      headers,
      moves,
      ply,
      orientation,
    };
    const res =
      !asNew && saved
        ? await supabase
            .from("saved_analyses")
            .update({ ...row, updated_at: new Date().toISOString() })
            .eq("id", saved.id)
            .select("id")
            .single()
        : await supabase.from("saved_analyses").insert(row).select("id").single();
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    setOpen(false);
    toast.success(asNew ? "Saved. Share the link with anyone." : "Changes saved.");
    void qc.invalidateQueries({ queryKey: ["saved-analysis", res.data.id] });
    if (asNew) void navigate({ to: "/analysis/$id", params: { id: res.data.id } });
  }

  async function remove() {
    if (!saved || !confirm("Delete this saved analysis? The link will stop working.")) return;
    const { error } = await supabase.from("saved_analyses").delete().eq("id", saved.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted.");
    void navigate({ to: "/analysis" });
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40";

  if (!user || isGuest) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        {saved && (
          <button onClick={() => void copy()} className={`${btn} mb-2`}>
            <Link2 className="h-4 w-4" /> Copy link
          </button>
        )}
        <p className="text-muted-foreground">
          <Link to="/login" className="text-primary underline">
            Create a free account
          </Link>{" "}
          to save analyses and share them by link.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap gap-2">
        {saved && (
          <button onClick={() => void copy()} className={btn}>
            <Link2 className="h-4 w-4" /> Copy link
          </button>
        )}
        {mine ? (
          <>
            <button onClick={() => setOpen((o) => !o)} className={btn}>
              <Save className="h-4 w-4" /> Save changes
            </button>
            <button
              onClick={() => void remove()}
              className={`${btn} text-destructive`}
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            onClick={() => setOpen((o) => !o)}
            className={btn}
            disabled={moves.length === 0 && !saved}
          >
            <Save className="h-4 w-4" /> {saved ? "Save a copy" : "Save & share"}
          </button>
        )}
      </div>
      {open && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save(!mine);
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="Title, e.g. My Sicilian loss, move 18 mistake"
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Notes (optional): what you want others to look at"
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
          <p className="text-xs text-muted-foreground">
            Anyone with the link can view it. It opens at the move you're on now.
          </p>
          <button
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {mine ? "Save changes" : "Save"}
          </button>
        </form>
      )}
    </div>
  );
}
