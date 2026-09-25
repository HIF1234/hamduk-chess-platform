import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Puzzle } from "lucide-react";
import { PuzzleBoard } from "@/components/puzzles/PuzzleBoard";
import { getPuzzleById, submitPuzzleAttempt } from "@/lib/puzzles.functions";
import { useAuth } from "@/lib/auth";
import { ShareLinks } from "@/components/ShareLinks";

export const Route = createFileRoute("/puzzles/$id")({
  head: () => ({ meta: [{ title: "Chess puzzle — Hamduk Chess" }] }),
  component: SinglePuzzle,
});

function SinglePuzzle() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const fetchPuzzle = useServerFn(getPuzzleById);
  const submit = useServerFn(submitPuzzleAttempt);
  const [msg, setMsg] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["puzzle", id],
    queryFn: () => fetchPuzzle({ data: { puzzleId: id } }),
  });

  if (q.isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  const p = q.data;
  if (!p) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-muted-foreground">This puzzle doesn't exist or isn't approved yet.</p>
        <Link to="/puzzles" className="mt-4 inline-block text-primary underline">
          More puzzles
        </Link>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="flex items-center gap-2 font-serif text-3xl font-bold">
          <Puzzle className="h-7 w-7 text-primary" /> Puzzle · rated {p.rating}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {p.creator ? (
            <>
              Created by{" "}
              <Link
                to="/profile/$username"
                params={{ username: p.creator }}
                className="font-semibold text-foreground hover:underline"
              >
                {p.creator}
              </Link>
            </>
          ) : p.source?.startsWith("lichess:") ? (
            "From the Lichess open puzzle database (CC0)"
          ) : null}
          {p.themes.length ? ` · ${p.themes.slice(0, 3).join(", ")}` : ""}
        </p>
        <div className="mt-6">
          <PuzzleBoard
            puzzle={p}
            onComplete={async (success) => {
              if (!user)
                return setMsg(
                  success
                    ? "Solved! Sign in to track your puzzle rating."
                    : "Not quite — try again.",
                );
              try {
                const r = await submit({ data: { puzzleId: p.id, success } });
                setMsg(
                  `${success ? "Solved!" : "Not quite."} Rating ${r.rating} (${r.delta >= 0 ? "+" : ""}${r.delta})`,
                );
              } catch (e) {
                setMsg((e as Error).message);
              }
            }}
          />
        </div>
        {msg && <p className="mt-4 text-center font-medium">{msg}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <ShareLinks text="Can you solve this chess puzzle?" path={`/puzzles/${p.id}`} />
          <Link to="/puzzles/create" className="text-sm text-primary hover:underline">
            Create your own puzzle
          </Link>
        </div>
      </main>
    </div>
  );
}
