import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { toast } from "sonner";
import { Card, EmptyState, PageHeader, when } from "@/components/admin/AdminUi";
import { listPendingPuzzles, reviewPuzzle } from "@/lib/puzzle-creator.functions";

export const Route = createFileRoute("/admin/puzzles")({
  head: () => ({
    meta: [
      { title: "Puzzle review | Hamduk Chess staff" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PuzzleReview,
  errorComponent: ({ error }) => (
    <div className="p-4 text-sm text-destructive">{error.message}</div>
  ),
});

type Pending = Awaited<ReturnType<typeof listPendingPuzzles>>[number];

function PuzzleReview() {
  const q = useQuery({ queryKey: ["admin", "puzzles"], queryFn: () => listPendingPuzzles() });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Puzzle review"
        subtitle="Community puzzles waiting for a moderator. Play through the line, set the rating, approve or decline."
      />
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!q.isLoading && !q.data?.length && <EmptyState>No puzzles waiting.</EmptyState>}
      <div className="grid gap-4 xl:grid-cols-2">
        {q.data?.map((p) => (
          <PendingCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}

function PendingCard({ p }: { p: Pending }) {
  const qc = useQueryClient();
  const [ply, setPly] = useState(0);
  const [rating, setRating] = useState(p.rating);
  const [note, setNote] = useState("");

  const c = new Chess(p.fen);
  const sans: string[] = [];
  let fen = p.fen;
  p.solution.forEach((uci, i) => {
    sans.push(c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san);
    if (i < ply) fen = c.fen();
  });

  const review = useMutation({
    mutationFn: (approve: boolean) =>
      reviewPuzzle({ data: { puzzleId: p.id, approve, rating, note: note.trim() || undefined } }),
    onSuccess: (_, approve) => {
      toast.success(approve ? "Approved" : "Declined");
      void qc.invalidateQueries({ queryKey: ["admin", "puzzles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <div className="aspect-square w-full max-w-[220px]">
          <Chessboard
            options={{
              id: `review-${p.id}`,
              position: fen,
              allowDragging: false,
              boardOrientation: p.fen.split(" ")[1] === "w" ? "white" : "black",
            }}
          />
        </div>
        <div className="min-w-0 space-y-2 text-sm">
          <p className="text-muted-foreground">
            by <span className="font-semibold text-foreground">{p.creator}</span> ·{" "}
            {when(p.created_at)}
          </p>
          <p className="font-mono">
            {sans.map((s, i) => (
              <button
                key={i}
                onClick={() => setPly(i + 1)}
                className={`mr-1 rounded px-1 ${ply === i + 1 ? "bg-primary text-primary-foreground" : i % 2 === 0 ? "font-bold" : ""}`}
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => setPly(0)}
              className="ml-1 text-xs text-muted-foreground underline"
            >
              start
            </button>
          </p>
          {p.themes.length > 0 && (
            <p className="text-xs text-muted-foreground">{p.themes.join(", ")}</p>
          )}
          <label className="block">
            <span className="text-muted-foreground">Rating: {rating}</span>
            <input
              type="range"
              min={400}
              max={3000}
              step={50}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="w-full"
            />
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Note to the creator (optional)"
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5"
          />
          <div className="flex gap-2">
            <button
              disabled={review.isPending}
              onClick={() => review.mutate(true)}
              className="rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground disabled:opacity-40"
            >
              Approve
            </button>
            <button
              disabled={review.isPending}
              onClick={() => review.mutate(false)}
              className="rounded-md border border-border px-3 py-1.5 hover:bg-accent disabled:opacity-40"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
