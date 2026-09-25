import { useCallback, useEffect, useMemo, useState } from "react";
import { useBoardSquares } from "@/lib/preferences";
import { Chessboard } from "react-chessboard";
import { toast } from "sonner";
import { useReplay } from "@/hooks/useReplay";
import { useKeyboardNav } from "@/hooks/useKeyboardNav";
import { ReplayMoveList } from "./ReplayMoveList";
import { AnalysisToolbar } from "./AnalysisToolbar";
import { PgnImportDialog } from "./PgnImportDialog";
import { FenImportDialog } from "./FenImportDialog";
import { AiCoachPanel } from "./AiCoachPanel";
import { TablebasePanel } from "./TablebasePanel";
import { ExplorerPanel } from "./ExplorerPanel";
import { downloadPgn, exportPgn } from "@/lib/pgn";
import { SaveAnalysisPanel } from "./SaveAnalysisPanel";

export type SavedAnalysis = {
  id: string;
  owner_id: string;
  title: string;
  notes: string | null;
  start_fen: string;
  headers: Record<string, string>;
  moves: string[];
  ply: number;
  orientation: "white" | "black";
  updated_at: string;
  author: string | null;
};

export function AnalysisApp({ saved }: { saved?: SavedAnalysis } = {}) {
  const replay = useReplay();
  const [orientation, setOrientation] = useState<"white" | "black">(saved?.orientation ?? "white");

  // Open a saved analysis where its owner left it.
  useEffect(() => {
    if (!saved) return;
    replay.loadLine({
      startFen: saved.start_fen,
      headers: saved.headers,
      moves: saved.moves,
      ply: saved.ply,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id, saved?.updated_at]);
  const [pgnOpen, setPgnOpen] = useState(false);
  const [fenOpen, setFenOpen] = useState(false);

  useKeyboardNav({
    onPrev: replay.prev,
    onNext: replay.next,
    onStart: replay.toStart,
    onEnd: replay.toEnd,
  });

  // Hand-off from /
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stash = sessionStorage.getItem("analysis:pgn");
    if (stash) {
      sessionStorage.removeItem("analysis:pgn");
      try {
        replay.loadPgnText(stash);
        toast.success("Game loaded from board.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load game.");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastMoveSquares = useMemo(() => {
    if (replay.ply === 0) return null;
    const m = replay.moves[replay.ply - 1];
    return m ? { from: m.from, to: m.to } : null;
  }, [replay.ply, replay.moves]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMoveSquares) {
      styles[lastMoveSquares.from] = { background: "rgba(250, 204, 21, 0.25)" };
      styles[lastMoveSquares.to] = { background: "rgba(250, 204, 21, 0.35)" };
    }
    return styles;
  }, [lastMoveSquares]);

  const boardSquares = useBoardSquares();
  const boardOptions = useMemo(
    () => ({
      position: replay.fen,
      boardOrientation: orientation,
      squareStyles,
      ...boardSquares,
      animationDurationInMs: 180,
      allowDragging: true,
      onPieceDrop: ({
        sourceSquare,
        targetSquare,
      }: {
        sourceSquare: string;
        targetSquare: string | null;
      }) => !!targetSquare && replay.playMove(sourceSquare, targetSquare),
      id: "analysis-board",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replay.fen, orientation, squareStyles, boardSquares],
  );

  const currentPgn = useMemo(
    () => exportPgn(replay.headers, replay.moves, replay.startFen),
    [replay.headers, replay.moves, replay.startFen],
  );

  const handleExport = useCallback(() => {
    if (replay.moves.length === 0) return;
    downloadPgn(currentPgn, "analysis.pgn");
    toast.success("PGN downloaded.");
  }, [currentPgn, replay.moves.length]);

  const handleCopyFen = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(replay.fen);
      toast.success("FEN copied.");
    } catch {
      toast.error("Could not copy.");
    }
  }, [replay.fen]);

  const handleLoadPgn = useCallback(
    (pgn: string) => {
      replay.loadPgnText(pgn);
      toast.success("PGN loaded.");
    },
    [replay],
  );

  const handleLoadFen = useCallback(
    (fen: string) => {
      replay.loadFenText(fen);
      toast.success("Position loaded.");
    },
    [replay],
  );

  const navBtn =
    "flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-40";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-4 sm:px-6 sm:py-8 lg:flex-row">
        <div className="flex w-full flex-1 flex-col items-center">
          <div className="w-full max-w-[640px] space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="min-w-0">
                <h1 className="truncate font-serif text-2xl font-bold">
                  {saved?.title ?? "Analysis board"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {saved
                    ? `Saved by ${saved.author ?? "a player"} · ${new Date(saved.updated_at).toLocaleDateString()}`
                    : "Import a game or play moves on the board to explore."}{" "}
                  · Move {replay.ply} of {replay.moves.length}
                </p>
              </div>
            </div>
            {saved?.notes && (
              <p className="whitespace-pre-wrap rounded-lg border border-border bg-card p-3 text-sm">
                {saved.notes}
              </p>
            )}
            <AnalysisToolbar
              onImportPgn={() => setPgnOpen(true)}
              onImportFen={() => setFenOpen(true)}
              onExportPgn={handleExport}
              onCopyFen={handleCopyFen}
              onFlip={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
              onReset={replay.reset}
              hasMoves={replay.moves.length > 0}
            />

            <div className="relative aspect-square w-full touch-none select-none overflow-hidden rounded-sm ring-1 ring-border">
              <Chessboard options={boardOptions} />
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={replay.toStart}
                disabled={replay.isStart}
                className={navBtn}
                aria-label="Jump to start"
              >
                ⏮
              </button>
              <button
                onClick={replay.prev}
                disabled={replay.isStart}
                className={navBtn}
                aria-label="Previous move"
              >
                ◀
              </button>
              <button
                onClick={replay.next}
                disabled={replay.isEnd}
                className={navBtn}
                aria-label="Next move"
              >
                ▶
              </button>
              <button
                onClick={replay.toEnd}
                disabled={replay.isEnd}
                className={navBtn}
                aria-label="Jump to end"
              >
                ⏭
              </button>
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              Drag pieces to try ideas. Use ← / → to step, ↑ / ↓ to jump to start / end.
            </p>
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-96">
          <SaveAnalysisPanel
            saved={saved}
            startFen={replay.startFen}
            headers={replay.headers}
            moves={replay.moves.map((m) => m.from + m.to + (m.promotion ?? ""))}
            ply={replay.ply}
            orientation={orientation}
          />
          <TablebasePanel fen={replay.fen} />
          <ExplorerPanel
            fen={replay.fen}
            onPlay={(uci) => replay.playMove(uci.slice(0, 2), uci.slice(2, 4), uci[4])}
          />
          <ReplayMoveList moves={replay.moves} ply={replay.ply} onSelect={replay.setPly} />
          <AiCoachPanel
            fen={replay.fen}
            turn={replay.turn}
            pgn={currentPgn}
            hasMoves={replay.moves.length > 0}
          />
        </aside>
      </main>

      <PgnImportDialog open={pgnOpen} onOpenChange={setPgnOpen} onLoad={handleLoadPgn} />
      <FenImportDialog open={fenOpen} onOpenChange={setFenOpen} onLoad={handleLoadFen} />
    </div>
  );
}
