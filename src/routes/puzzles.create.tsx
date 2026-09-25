import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { toast } from "sonner";
import { CheckCircle2, Eraser, Loader2, PenSquare, RotateCcw, Undo2, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useBoardSquares } from "@/lib/preferences";
import { ReviewAnalyzer } from "@/lib/game-review";
import { listMyPuzzles, submitPuzzle } from "@/lib/puzzle-creator.functions";

export const Route = createFileRoute("/puzzles/create")({
  head: () => ({ meta: [{ title: "Create a puzzle — Hamduk Chess" }] }),
  component: CreatePuzzle,
});

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const EMPTY_KINGS = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
const GLYPH: Record<string, string> = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};
const THEMES = [
  "mate",
  "mateIn1",
  "mateIn2",
  "mateIn3",
  "fork",
  "pin",
  "skewer",
  "sacrifice",
  "discoveredAttack",
  "deflection",
  "hangingPiece",
  "endgame",
  "promotion",
  "backRankMate",
];
// A puzzle needs one clearly best move: at least this many centipawns better than the runner-up.
const MIN_GAP = 150;

type Verdict = { ok: boolean; message: string } | null;

function placementToMap(fen: string) {
  const map = new Map<string, string>();
  fen
    .split(" ")[0]
    .split("/")
    .forEach((row, r) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) f += Number(ch);
        else {
          map.set(`${"abcdefgh"[f]}${8 - r}`, ch);
          f++;
        }
      }
    });
  return map;
}

function mapToPlacement(map: Map<string, string>) {
  const rows: string[] = [];
  for (let r = 8; r >= 1; r--) {
    let row = "";
    let gap = 0;
    for (const file of "abcdefgh") {
      const p = map.get(`${file}${r}`);
      if (p) {
        row += (gap || "") + p;
        gap = 0;
      } else gap++;
    }
    rows.push(row + (gap || ""));
  }
  return rows.join("/");
}

function validFen(fen: string): string | null {
  try {
    new Chess(fen);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

function CreatePuzzle() {
  const { user, isGuest, loading } = useAuth();
  const qc = useQueryClient();
  const submit = useServerFn(submitPuzzle);
  const mine = useServerFn(listMyPuzzles);
  const boardSquares = useBoardSquares();

  const [stage, setStage] = useState<"setup" | "record">("setup");
  const [placement, setPlacement] = useState(() => placementToMap(EMPTY_KINGS));
  const [turn, setTurn] = useState<"w" | "b">("w");
  const [brush, setBrush] = useState<string | null>("Q");
  const [fenInput, setFenInput] = useState("");
  const [line, setLine] = useState<string[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [themes, setThemes] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState(1500);
  const [checking, setChecking] = useState(false);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [busy, setBusy] = useState(false);
  const analyzer = useRef<ReviewAnalyzer | null>(null);

  useEffect(() => () => analyzer.current?.dispose(), []);

  // Castling rights are dropped on purpose: puzzles set up by hand rarely need them and a
  // wrong right makes the FEN invalid.
  const startFen = `${mapToPlacement(placement)} ${turn} - - 0 1`;
  const setupError = validFen(startFen);

  const current = useMemo(() => {
    const c = new Chess(setupError ? EMPTY_KINGS : startFen);
    for (const uci of line)
      c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return c;
  }, [startFen, setupError, line]);

  const history = useMemo(() => {
    const c = new Chess(setupError ? EMPTY_KINGS : startFen);
    return line.map(
      (uci) => c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san,
    );
  }, [startFen, setupError, line]);

  const myList = useQuery({
    queryKey: ["my-puzzles", user?.id],
    enabled: !!user && !isGuest,
    queryFn: () => mine(),
  });

  function resetVerdict() {
    setVerdict(null);
  }

  function onSetupClick(sq: string) {
    const next = new Map(placement);
    if (!brush || next.get(sq) === brush) next.delete(sq);
    else {
      // Only one king per side.
      if (brush === "K" || brush === "k")
        for (const [s, p] of next) if (p === brush) next.delete(s);
      next.set(sq, brush);
    }
    setPlacement(next);
  }

  function tryMove(from: Square, to: Square) {
    const piece = current.get(from);
    const promo = piece?.type === "p" && (to[1] === "8" || to[1] === "1") ? "q" : undefined;
    try {
      const probe = new Chess(current.fen());
      probe.move({ from, to, promotion: promo });
    } catch {
      return false;
    }
    setLine((l) => [...l, `${from}${to}${promo ?? ""}`]);
    setSelected(null);
    resetVerdict();
    return true;
  }

  function onRecordClick(sq: Square) {
    if (selected && selected !== sq && tryMove(selected, sq)) return;
    const p = current.get(sq);
    setSelected(p && p.color === current.turn() ? sq : null);
  }

  function loadFen() {
    const f = fenInput.trim();
    const err = validFen(f);
    if (err) return toast.error(`That FEN isn't valid: ${err}`);
    setPlacement(placementToMap(f));
    setTurn(f.split(" ")[1] === "b" ? "b" : "w");
    setFenInput("");
  }

  async function check() {
    if (!line.length) return;
    setChecking(true);
    setVerdict(null);
    try {
      analyzer.current ??= new ReviewAnalyzer();
      const top = await analyzer.current.topMoves(startFen, 16, 2);
      const sign = turn === "w" ? 1 : -1;
      const [best, second] = top;
      if (!best) {
        setVerdict({ ok: false, message: "The engine couldn't analyse this position." });
      } else if (best.uci.slice(0, 4) !== line[0].slice(0, 4)) {
        const san = new Chess(startFen).move({
          from: best.uci.slice(0, 2),
          to: best.uci.slice(2, 4),
          promotion: best.uci[4],
        }).san;
        setVerdict({
          ok: false,
          message: `The engine prefers ${san}. A puzzle's first move must be the best one.`,
        });
      } else if (second && (best.cp - second.cp) * sign < MIN_GAP) {
        setVerdict({
          ok: false,
          message: "Another move is almost as good, so this puzzle would have two answers.",
        });
      } else {
        setVerdict({
          ok: true,
          message: "The engine agrees: your first move is clearly the best.",
        });
      }
    } finally {
      setChecking(false);
    }
  }

  async function send() {
    setBusy(true);
    try {
      await submit({ data: { fen: startFen, solution: line, themes, difficulty } });
      toast.success("Sent for review. We'll notify you when a moderator has looked at it.");
      setLine([]);
      setVerdict(null);
      setStage("setup");
      void qc.invalidateQueries({ queryKey: ["my-puzzles"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!loading && (!user || isGuest)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-muted-foreground">Create a free account to design puzzles.</p>
        <Link to="/login" className="mt-4 inline-block text-primary underline">
          Sign in
        </Link>
      </div>
    );
  }

  const setupStyles: Record<string, React.CSSProperties> = {};
  const recordStyles: Record<string, React.CSSProperties> = {};
  if (selected) recordStyles[selected] = { background: "rgba(245, 166, 35, 0.55)" };
  const moveCount = line.length;
  const endsOnMine = moveCount % 2 === 1;
  const btn =
    "inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40";

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="flex items-center gap-2 font-serif text-3xl font-bold">
          <PenSquare className="h-7 w-7 text-primary" /> Create a puzzle
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up a position, play the winning line, and send it for review. Approved puzzles are
          credited to you. Part of Hamduk Plus and Gold.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,560px)_1fr]">
          <div className="space-y-3">
            <div className="aspect-square w-full touch-none select-none overflow-hidden rounded-sm">
              {stage === "setup" ? (
                <Chessboard
                  options={{
                    id: "puzzle-setup",
                    position: mapToPlacement(placement),
                    allowDragging: false,
                    onSquareClick: ({ square }: { square: string }) => onSetupClick(square),
                    squareStyles: setupStyles,
                    ...boardSquares,
                  }}
                />
              ) : (
                <Chessboard
                  options={{
                    id: "puzzle-record",
                    position: current.fen(),
                    boardOrientation: turn === "w" ? "white" : "black",
                    onPieceDrop: ({
                      sourceSquare,
                      targetSquare,
                    }: {
                      sourceSquare: string;
                      targetSquare: string | null;
                    }) => !!targetSquare && tryMove(sourceSquare as Square, targetSquare as Square),
                    onSquareClick: ({ square }: { square: string }) =>
                      onRecordClick(square as Square),
                    squareStyles: recordStyles,
                    animationDurationInMs: 150,
                    ...boardSquares,
                  }}
                />
              )}
            </div>

            {stage === "setup" && (
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  Pick a piece, then tap squares to place it. Tap it again to remove.
                </p>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(GLYPH).map((p) => (
                    <button
                      key={p}
                      onClick={() => setBrush(p)}
                      aria-label={`Place ${p}`}
                      className={`h-10 w-10 rounded-md text-2xl leading-none ${brush === p ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                    >
                      {GLYPH[p]}
                    </button>
                  ))}
                  <button
                    onClick={() => setBrush(null)}
                    aria-label="Eraser"
                    className={`flex h-10 w-10 items-center justify-center rounded-md ${brush === null ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                  >
                    <Eraser className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            {stage === "setup" ? (
              <section className="space-y-3 rounded-xl border border-border bg-card p-4">
                <h2 className="font-semibold">1 · Set up the position</h2>
                <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
                  {(["w", "b"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setTurn(c)}
                      className={`rounded-md px-3 py-1.5 ${turn === c ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                    >
                      {c === "w" ? "White" : "Black"} to move
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className={btn} onClick={() => setPlacement(placementToMap(START))}>
                    Starting position
                  </button>
                  <button className={btn} onClick={() => setPlacement(placementToMap(EMPTY_KINGS))}>
                    Kings only
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    value={fenInput}
                    onChange={(e) => setFenInput(e.target.value)}
                    placeholder="…or paste a FEN"
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs"
                  />
                  <button className={btn} onClick={loadFen} disabled={!fenInput.trim()}>
                    Load
                  </button>
                </div>
                {setupError && <p className="text-sm text-destructive">{setupError}</p>}
                <button
                  disabled={!!setupError}
                  onClick={() => {
                    setLine([]);
                    setVerdict(null);
                    setStage("record");
                  }}
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                >
                  Next: play the solution
                </button>
              </section>
            ) : (
              <section className="space-y-3 rounded-xl border border-border bg-card p-4">
                <h2 className="font-semibold">2 · Play the solution</h2>
                <p className="text-sm text-muted-foreground">
                  Play the solver's moves and the opponent's best replies. End on the solver's move.
                </p>
                <p className="min-h-6 font-mono text-sm">
                  {history.length
                    ? history.map((san, i) => {
                        const ply = i + (turn === "b" ? 1 : 0);
                        const num = Math.floor(ply / 2) + 1;
                        const prefix = ply % 2 === 0 ? `${num}. ` : i === 0 ? `${num}... ` : "";
                        return (
                          <span key={i} className={i % 2 === 0 ? "font-bold text-primary" : ""}>
                            {prefix}
                            {san}{" "}
                          </span>
                        );
                      })
                    : "No moves yet."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={btn}
                    disabled={!line.length}
                    onClick={() => {
                      setLine((l) => l.slice(0, -1));
                      resetVerdict();
                    }}
                  >
                    <Undo2 className="h-4 w-4" /> Undo
                  </button>
                  <button
                    className={btn}
                    onClick={() => {
                      setLine([]);
                      resetVerdict();
                    }}
                  >
                    <RotateCcw className="h-4 w-4" /> Clear
                  </button>
                  <button className={btn} onClick={() => setStage("setup")}>
                    Edit position
                  </button>
                </div>

                <div>
                  <p className="mb-1 text-sm font-medium">Themes (up to 5)</p>
                  <div className="flex flex-wrap gap-1">
                    {THEMES.map((t) => {
                      const on = themes.includes(t);
                      return (
                        <button
                          key={t}
                          onClick={() =>
                            setThemes((s) =>
                              on ? s.filter((x) => x !== t) : s.length < 5 ? [...s, t] : s,
                            )
                          }
                          className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-primary bg-primary/15 text-primary" : "border-border hover:bg-accent"}`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="block text-sm">
                  <span className="font-medium">Your difficulty guess: {difficulty}</span>
                  <input
                    type="range"
                    min={600}
                    max={2600}
                    step={100}
                    value={difficulty}
                    onChange={(e) => setDifficulty(Number(e.target.value))}
                    className="w-full"
                  />
                </label>

                <button
                  onClick={() => void check()}
                  disabled={!endsOnMine || checking}
                  className={`${btn} w-full justify-center`}
                >
                  {checking && <Loader2 className="h-4 w-4 animate-spin" />} Check with the engine
                </button>
                {!endsOnMine && moveCount > 0 && (
                  <p className="text-xs text-muted-foreground">Add the solver's final move.</p>
                )}
                {verdict && (
                  <p
                    className={`flex items-start gap-1.5 text-sm ${verdict.ok ? "text-primary" : "text-destructive"}`}
                  >
                    {verdict.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    {verdict.message}
                  </p>
                )}
                <button
                  onClick={() => void send()}
                  disabled={!verdict?.ok || busy}
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                >
                  {busy ? "Sending…" : "Submit for review"}
                </button>
              </section>
            )}

            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-2 font-semibold">My submissions</h2>
              {myList.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {!myList.isLoading && !myList.data?.length && (
                <p className="text-sm text-muted-foreground">Nothing yet.</p>
              )}
              <ul className="space-y-2 text-sm">
                {myList.data?.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-2 border-t border-border pt-2 first:border-t-0 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p>
                        {new Date(p.created_at).toLocaleDateString()} · rated {p.rating}
                      </p>
                      {p.review_note && (
                        <p className="text-xs text-muted-foreground">“{p.review_note}”</p>
                      )}
                    </div>
                    {p.approved ? (
                      <Link
                        to="/puzzles/$id"
                        params={{ id: p.id }}
                        className="shrink-0 text-primary hover:underline"
                      >
                        Approved
                      </Link>
                    ) : p.reviewed_at ? (
                      <span className="shrink-0 text-destructive">Declined</span>
                    ) : (
                      <span className="shrink-0 text-muted-foreground">In review</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
