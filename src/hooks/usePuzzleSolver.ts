import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import type { Puzzle } from "@/lib/puzzles-data";

export type SolverStatus = "loading" | "playing" | "solved" | "failed";

export function usePuzzleSolver(puzzle: Puzzle) {
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(puzzle.fen);
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState<SolverStatus>("loading");
  // 0 = no hint shown for the current move, 1 = source square highlighted,
  // 2 = the full move shown as an arrow. Resets to 0 for each new move; the highest level
  // reached anywhere in the puzzle (maxHintLevel) is what dampens the rating gain on solve.
  const [hintLevel, setHintLevel] = useState(0);
  const [maxHintLevel, setMaxHintLevel] = useState(0);

  // Reset when puzzle changes
  useEffect(() => {
    chess.load(puzzle.fen);
    setFen(puzzle.fen);
    setStepIndex(0);
    setStatus("playing");
    setHintLevel(0);
    setMaxHintLevel(0);
  }, [puzzle, chess]);

  const playerColor = useMemo(() => puzzle.fen.split(" ")[1] as "w" | "b", [puzzle.fen]);

  const tryMove = useCallback(
    (from: Square, to: Square, promotion?: string): boolean => {
      if (status !== "playing") return false;
      const expected = puzzle.solution[stepIndex];
      if (!expected) return false;
      const expFrom = expected.slice(0, 2);
      const expTo = expected.slice(2, 4);
      const expPromo = expected[4];

      // The board auto-queens and passes no promotion, so an unspecified promotion takes the expected piece.
      const matches =
        from === expFrom && to === expTo && (!expPromo || !promotion || promotion === expPromo);
      if (!matches) {
        // Still try to make the move to show feedback
        try {
          const m = chess.move({ from, to, promotion: promotion ?? "q" });
          if (m) {
            setFen(chess.fen());
            setStatus("failed");
            return true;
          }
        } catch {
          /* illegal */
        }
        setStatus("failed");
        return false;
      }

      const m = chess.move({ from, to, promotion: promotion ?? expPromo ?? "q" });
      if (!m) return false;
      setFen(chess.fen());
      setHintLevel(0); // fresh move, fresh hint state (maxHintLevel is untouched)
      const nextIdx = stepIndex + 1;

      // If solution complete
      if (nextIdx >= puzzle.solution.length) {
        setStatus("solved");
        setStepIndex(nextIdx);
        return true;
      }

      // Play opponent's reply after a short delay
      setTimeout(() => {
        const reply = puzzle.solution[nextIdx];
        const rFrom = reply.slice(0, 2) as Square;
        const rTo = reply.slice(2, 4) as Square;
        const rPromo = reply[4];
        chess.move({ from: rFrom, to: rTo, promotion: rPromo ?? "q" });
        setFen(chess.fen());
        const after = nextIdx + 1;
        setStepIndex(after);
        if (after >= puzzle.solution.length) setStatus("solved");
      }, 350);

      setStepIndex(nextIdx);
      return true;
    },
    [chess, puzzle, stepIndex, status],
  );

  /** First press highlights the source square; second press adds the destination as an
   *  arrow. Caps at 2 for the current move. */
  const showHint = useCallback(() => {
    setHintLevel((lvl) => {
      const next = Math.min(2, lvl + 1);
      setMaxHintLevel((m) => Math.max(m, next));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    chess.load(puzzle.fen);
    setFen(puzzle.fen);
    setStepIndex(0);
    setStatus("playing");
    setHintLevel(0);
    setMaxHintLevel(0);
  }, [chess, puzzle]);

  const expectedMove = puzzle.solution[stepIndex];
  const hintFrom = hintLevel >= 1 && expectedMove ? expectedMove.slice(0, 2) : null;
  const hintTo = hintLevel >= 2 && expectedMove ? expectedMove.slice(2, 4) : null;

  return {
    fen,
    status,
    tryMove,
    hintFrom,
    hintTo,
    hintLevel,
    /** Highest hint level reached anywhere in this puzzle attempt (0-2); feeds the rating
     *  dampening on the server. */
    hintsUsed: maxHintLevel,
    showHint,
    reset,
    playerColor,
  };
}
