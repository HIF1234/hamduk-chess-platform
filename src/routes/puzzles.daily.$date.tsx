import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PuzzleBoard } from "@/components/puzzles/PuzzleBoard";
import { getDailyPuzzle, submitPuzzleAttempt } from "@/lib/puzzles.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/puzzles/daily/$date")({
  head: ({ params }) => ({
    meta: [
      { title: `Daily Puzzle ${params.date} — Hamduk Chess` },
      {
        name: "description",
        content: `Solve today's daily chess puzzle (${params.date}). Same puzzle for every player worldwide.`,
      },
      { property: "og:title", content: `Daily Puzzle ${params.date} — Hamduk Chess` },
      {
        property: "og:description",
        content: `Same puzzle for every player. Solve it to keep your streak alive.`,
      },
    ],
  }),
  errorComponent: DailyError,
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      No daily puzzle for this date.
    </div>
  ),
  component: DailyPuzzlePage,
});

function DailyPuzzlePage() {
  const { date } = Route.useParams();
  const fetchDaily = useServerFn(getDailyPuzzle);
  const submit = useServerFn(submitPuzzleAttempt);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const { data: puzzle, isLoading } = useQuery({
    queryKey: ["daily-puzzle", date],
    queryFn: () => fetchDaily({ data: { date } }),
  });

  const handleComplete = async (success: boolean) => {
    if (!puzzle) return;
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      setResultMsg(success ? "Solved! Sign in to track your rating." : "Sign in to save attempts.");
      return;
    }
    try {
      const res = await submit({ data: { puzzleId: puzzle.id, success } });
      setResultMsg(
        success
          ? `Solved! Rating ${res.rating} (${res.delta >= 0 ? "+" : ""}${res.delta})`
          : `Not quite. Rating ${res.rating} (${res.delta})`,
      );
    } catch (e) {
      setResultMsg(e instanceof Error ? e.message : "Failed to record attempt.");
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="px-4 pt-4 sm:px-6">
        <Link to="/puzzles" className="text-sm text-muted-foreground hover:text-foreground">
          ← All puzzles
        </Link>
      </div>

      <main className="max-w-[860px] mx-auto px-6 py-10">
        <header className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Daily puzzle
          </p>
          <h1
            className="text-3xl md:text-4xl font-serif font-bold tracking-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {date}
          </h1>
        </header>

        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading puzzle…</div>
        ) : puzzle ? (
          <>
            <PuzzleBoard puzzle={puzzle} onComplete={handleComplete} />
            {resultMsg && (
              <div className="mt-6 text-center text-sm font-medium text-foreground">
                {resultMsg}
              </div>
            )}
          </>
        ) : (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No puzzle available yet.
          </div>
        )}
      </main>
    </div>
  );
}

function DailyError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Couldn't load this puzzle: {error.message}
      <button
        onClick={() => {
          reset();
          void router.invalidate();
        }}
        className="ml-2 underline"
      >
        Retry
      </button>
    </div>
  );
}
