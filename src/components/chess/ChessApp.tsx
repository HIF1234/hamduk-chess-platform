import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBoardSquares } from "@/lib/preferences";
import { Chessboard } from "react-chessboard";
import { type Square, type PieceSymbol, type Color } from "chess.js";
import { Chess } from "chess.js";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { User as UserIcon } from "lucide-react";
import { useChessGame } from "@/hooks/useChessGame";
import { useStockfish } from "@/hooks/useStockfish";
import { sounds } from "@/lib/chess-sounds";
import { MoveList } from "./MoveList";
import { CapturedStrip } from "./CapturedPieces";
import { PromotionDialog } from "./PromotionDialog";
import { GameStatusBanner } from "./GameStatusBanner";
import { PersonaPicker } from "./PersonaPicker";
import { DEFAULT_PERSONA_ID, getPersona } from "@/lib/bot-personas";
import { recordBotGame, getMyBilling } from "@/lib/ratings.functions";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

type Mode = "human" | "engine";

// Blindfold mode draws every piece as nothing; the squares and highlights stay.
const BLANK_PIECES = Object.fromEntries(
  ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"].map((k) => [
    k,
    () => <></>,
  ]),
);

export function ChessApp({
  initialMode = "human",
  initialPersonaId,
}: {
  initialMode?: Mode;
  initialPersonaId?: string;
} = {}) {
  const game = useChessGame();
  const { requestBotMove } = useStockfish();
  const navigate = useNavigate();
  const recordBot = useServerFn(recordBotGame);
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [personaId, setPersonaId] = useState<string>(initialPersonaId ?? DEFAULT_PERSONA_ID);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromo, setPendingPromo] = useState<{ from: Square; to: Square } | null>(null);
  const engineThinking = useRef(false);
  const recordedRef = useRef(false);
  const persona = getPersona(personaId);
  const [userTier, setUserTier] = useState<"free" | "plus" | "gold">("free");
  const [playerColor, setPlayerColor] = useState<Color>("w");
  const [blindfold, setBlindfold] = useState(false);
  const [peek, setPeek] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!user) {
      setUserTier("free");
      return;
    }
    void getMyBilling({})
      .then((b) => setUserTier(b.tier))
      .catch(() => setUserTier("free"));
  }, [user]);

  // In engine mode the bot takes whichever colour the player didn't pick.
  const engineColor: Color = playerColor === "w" ? "b" : "w";

  const playWithSound = useCallback(
    (from: Square, to: Square, promo?: PieceSymbol) => {
      const move = game.makeMove(from, to, promo);
      if (!move) return false;
      if (move.flags.includes("c") || move.flags.includes("e")) sounds.capture();
      else sounds.move();
      // Status sounds after re-render
      setTimeout(() => {
        // game.status is stale here; rely on chess.js side-effects via setTimeout poll
      }, 0);
      return true;
    },
    [game],
  );

  // Sound on check/end based on status changes
  const lastStatusKind = useRef(game.status.kind);
  useEffect(() => {
    if (game.status.kind !== lastStatusKind.current) {
      if (game.status.kind === "check") sounds.check();
      if (
        game.status.kind === "checkmate" ||
        game.status.kind === "stalemate" ||
        game.status.kind === "draw" ||
        game.status.kind === "resigned"
      )
        sounds.end();
      lastStatusKind.current = game.status.kind;
    }
  }, [game.status]);

  // Engine move — uses MultiPV + blunder injection + eval noise + opening book
  useEffect(() => {
    if (mode !== "engine" || game.gameOver) return;
    if (game.turn !== engineColor) return;
    if (engineThinking.current) return;
    engineThinking.current = true;
    const timer = setTimeout(() => {
      requestBotMove(
        game.fen,
        {
          depthMin: persona.depthMin,
          depthMax: persona.depthMax,
          blunderRate: persona.blunderRate,
          randomness: persona.randomness,
          movetimeMs: persona.movetimeMs,
          openingRepertoire: persona.openingRepertoire,
          ply: game.history.length,
        },
        (uci) => {
          engineThinking.current = false;
          if (!uci || uci === "(none)") return;
          const from = uci.slice(0, 2) as Square;
          const to = uci.slice(2, 4) as Square;
          const promo = (uci[4] as PieceSymbol | undefined) ?? undefined;
          playWithSound(from, to, promo);
        },
      );
    }, 250);
    return () => {
      clearTimeout(timer);
      engineThinking.current = false;
    };
  }, [
    mode,
    game.turn,
    game.fen,
    game.gameOver,
    requestBotMove,
    playWithSound,
    persona,
    game.history.length,
    engineColor,
  ]);

  // Record bot game once when it ends (no ELO, just bot_games counter)
  useEffect(() => {
    if (mode !== "engine" || !game.gameOver || recordedRef.current || !user) return;
    recordedRef.current = true;
    const st = game.status;
    const winner = st.kind === "checkmate" || st.kind === "resigned" ? st.winner : null;
    const result = winner === null ? "draw" : winner === engineColor ? "loss" : "win";
    void recordBot({
      data: {
        timeControl: "5+0",
        variant: "standard",
        botId: persona.id,
        result,
        playerColor: playerColor === "w" ? "white" : "black",
        endReason: st.kind,
        ply: game.history.length,
      },
    }).catch(() => {
      /* silent — bot tracking is best-effort */
    });
  }, [
    mode,
    game.gameOver,
    game.status,
    game.history.length,
    user,
    recordBot,
    persona.id,
    playerColor,
    engineColor,
  ]);

  // Reset record flag on new game
  useEffect(() => {
    if (game.history.length === 0) recordedRef.current = false;
  }, [game.history.length]);

  const legalTargets = useMemo<Square[]>(
    () => (selected ? game.legalMovesFor(selected) : []),
    [selected, game],
  );

  const isPromotion = (from: Square, to: Square): boolean => {
    const piece = from && to ? null : null;
    void piece;
    // Look at current FEN — find piece at `from`
    const fenBoard = game.fen.split(" ")[0];
    const ranks = fenBoard.split("/");
    const fileIdx = from.charCodeAt(0) - "a".charCodeAt(0);
    const rankIdx = 8 - parseInt(from[1]);
    let p: string | null = null;
    let col = 0;
    for (const ch of ranks[rankIdx]) {
      if (/\d/.test(ch)) col += parseInt(ch);
      else {
        if (col === fileIdx) {
          p = ch;
          break;
        }
        col++;
      }
    }
    if (!p || p.toLowerCase() !== "p") return false;
    const toRank = parseInt(to[1]);
    return (p === "P" && toRank === 8) || (p === "p" && toRank === 1);
  };

  const tryMove = (from: Square, to: Square): boolean => {
    if (from === to) return false;
    if (mode === "engine" && game.turn === engineColor) return false;
    if (isPromotion(from, to)) {
      // verify it's a legal target first
      if (!game.legalMovesFor(from).includes(to)) return false;
      setPendingPromo({ from, to });
      return true;
    }
    const ok = playWithSound(from, to);
    if (ok) setSelected(null);
    return ok;
  };

  const onPieceDrop = ({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }) => {
    if (!targetSquare) return false;
    return tryMove(sourceSquare as Square, targetSquare as Square);
  };

  const onSquareClick = ({ square }: { square: string }) => {
    const sq = square as Square;
    if (selected) {
      if (sq === selected) {
        setSelected(null);
        return;
      }
      if (legalTargets.includes(sq)) {
        tryMove(selected, sq);
        return;
      }
    }
    // Select only own piece
    const board = game.fen.split(" ")[0];
    const ranks = board.split("/");
    const fileIdx = sq.charCodeAt(0) - "a".charCodeAt(0);
    const rankIdx = 8 - parseInt(sq[1]);
    let p: string | null = null;
    let col = 0;
    for (const ch of ranks[rankIdx]) {
      if (/\d/.test(ch)) col += parseInt(ch);
      else {
        if (col === fileIdx) {
          p = ch;
          break;
        }
        col++;
      }
    }
    if (!p) {
      setSelected(null);
      return;
    }
    const pieceColor: Color = p === p.toUpperCase() ? "w" : "b";
    if (pieceColor !== game.turn) {
      setSelected(null);
      return;
    }
    if (mode === "engine" && pieceColor === engineColor) return;
    setSelected(sq);
  };

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (selected) {
      styles[selected] = { background: "rgba(234, 179, 8, 0.35)" };
      for (const t of legalTargets) {
        styles[t] = {
          background: "radial-gradient(circle, rgba(24,24,27,0.35) 22%, transparent 24%)",
        };
      }
    }
    if (game.lastMove) {
      styles[game.lastMove.from] = {
        ...styles[game.lastMove.from],
        background: "rgba(250, 204, 21, 0.25)",
      };
      styles[game.lastMove.to] = {
        ...styles[game.lastMove.to],
        background: "rgba(250, 204, 21, 0.35)",
      };
    }
    return styles;
  }, [selected, legalTargets, game.lastMove]);

  const boardSquares = useBoardSquares();
  const boardOptions = useMemo(
    () => ({
      position: game.fen,
      onPieceDrop,
      onSquareClick,
      boardOrientation: orientation,
      squareStyles,
      ...boardSquares,
      animationDurationInMs: 180,
      allowDragging: !game.gameOver && !blindfold,
      id: "main-board",
      ...(blindfold && !peek ? { pieces: BLANK_PIECES } : {}),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game.fen, orientation, squareStyles, game.gameOver, boardSquares, blindfold, peek],
  );

  /** Plays a move typed in algebraic notation (e4, Nf3, O-O, exd5, e8=Q). */
  const submitTyped = () => {
    const text = typed.trim();
    if (!text) return;
    if (mode === "engine" && game.turn === engineColor) return;
    let move;
    try {
      move = new Chess(game.fen).move(text);
    } catch {
      toast.error(`"${text}" isn't a legal move here.`);
      return;
    }
    if (playWithSound(move.from, move.to, move.promotion)) setTyped("");
  };

  const handleNewGame = () => {
    game.reset();
    setSelected(null);
    setPendingPromo(null);
  };
  const chooseColor = (c: Color | "random") => {
    const next = c === "random" ? (Math.random() < 0.5 ? "w" : "b") : c;
    setPlayerColor(next);
    setOrientation(next === "w" ? "white" : "black");
    handleNewGame();
  };
  const handleUndo = () => {
    game.undo();
    if (mode === "engine") game.undo(); // undo engine reply too
    setSelected(null);
  };
  const handleFlip = () => setOrientation((o) => (o === "white" ? "black" : "white"));
  const handleResign = () => {
    if (game.gameOver) return;
    game.resign(mode === "engine" ? playerColor : game.turn);
  };
  const handleOpenInAnalysis = () => {
    const chess = new Chess();
    for (const m of game.history) {
      chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    }
    sessionStorage.setItem("analysis:pgn", chess.pgn());
    navigate({ to: "/analysis" });
  };

  const vsBot = mode === "engine";
  const botThinking = vsBot && !game.gameOver && game.turn === engineColor;
  const top: Color = orientation === "white" ? "b" : "w";
  const strip = (color: Color) => {
    const isBot = vsBot && color === engineColor;
    return (
      <PlayerStrip
        name={isBot ? persona.name : vsBot ? "You" : color === "w" ? "White" : "Black"}
        sub={isBot ? `${persona.hometown} · ${persona.rating}` : color === "w" ? "White" : "Black"}
        portrait={isBot ? persona.portrait : undefined}
        active={game.turn === color && !game.gameOver}
        thinking={isBot && botThinking}
        captured={
          <CapturedStrip
            color={color === "w" ? "b" : "w"}
            pieces={color === "w" ? game.captured.b : game.captured.w}
            advantage={Math.max(0, color === "w" ? game.advantage : -game.advantage)}
          />
        }
      />
    );
  };
  const seg = (on: boolean) =>
    "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors " +
    (on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent");
  const action =
    "rounded-md border border-border bg-card px-2 py-2 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto grid max-w-6xl items-start gap-6 px-4 py-4 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="mx-auto w-full max-w-[640px] space-y-3">
          {strip(top)}
          <div className="relative aspect-square w-full touch-none select-none overflow-hidden rounded-sm ring-1 ring-border">
            <Chessboard options={boardOptions} />
            <GameStatusBanner
              status={game.status}
              onNewGame={handleNewGame}
              you={vsBot ? playerColor : undefined}
              opponentName={vsBot ? persona.name : undefined}
            />
          </div>
          {strip(top === "w" ? "b" : "w")}

          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={handleNewGame}
              className={action.replace(
                "bg-card",
                "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              New
            </button>
            <button onClick={handleUndo} disabled={game.history.length === 0} className={action}>
              Undo
            </button>
            <button onClick={handleFlip} className={action}>
              Flip
            </button>
            <button
              onClick={handleResign}
              disabled={game.gameOver || game.history.length === 0}
              className={`${action} text-destructive`}
            >
              Resign
            </button>
          </div>

          {blindfold && (
            <div className="space-y-2 rounded-lg border border-border bg-card p-3">
              <p className="text-sm text-muted-foreground">
                {game.history.length
                  ? `Last move: ${Math.ceil(game.history.length / 2)}${game.history.length % 2 ? "." : "..."} ${game.history[game.history.length - 1].san}`
                  : "Type your move, or tap the from and to squares."}
              </p>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitTyped();
                }}
              >
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="e.g. Nf3"
                  autoCapitalize="off"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={game.gameOver}
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
                />
                <button type="submit" className={action}>
                  Play
                </button>
                <button
                  type="button"
                  onPointerDown={() => setPeek(true)}
                  onPointerUp={() => setPeek(false)}
                  onPointerLeave={() => setPeek(false)}
                  className={action}
                >
                  Peek
                </button>
              </form>
            </div>
          )}
        </div>

        <aside className="flex w-full flex-col gap-4">
          <div>
            <h1 className="font-serif text-2xl font-bold">
              {vsBot ? "Play the bots" : "Pass and play"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {vsBot
                ? `${persona.name}: “${persona.catchphrase}”. Bot games don't change your rating.`
                : "Two players, one device. Flip the board after each move if you like."}
            </p>
          </div>

          {vsBot && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                You play
              </p>
              <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5">
                <button onClick={() => chooseColor("w")} className={seg(playerColor === "w")}>
                  White
                </button>
                <button onClick={() => chooseColor("random")} className={seg(false)}>
                  Random
                </button>
                <button onClick={() => chooseColor("b")} className={seg(playerColor === "b")}>
                  Black
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Changing colour starts a new game.
              </p>
            </div>
          )}

          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <span>
              <span className="font-medium">Blindfold</span>
              <span className="block text-xs text-muted-foreground">
                Hide the pieces and play from memory. Hold Peek to look.
              </span>
            </span>
            <input
              type="checkbox"
              checked={blindfold}
              onChange={(e) => setBlindfold(e.target.checked)}
              className="h-5 w-5 accent-[var(--primary)]"
            />
          </label>

          {/* On phones the opponent picker comes first; the move list matters once a game is on. */}
          <div className="order-4 lg:order-3">
            <MoveList history={game.history} />
          </div>

          {vsBot && (
            <div className="order-3 rounded-lg border border-border bg-card p-3 lg:order-4">
              <PersonaPicker
                value={personaId}
                userTier={userTier}
                onChange={(id) => {
                  setPersonaId(id);
                  game.reset();
                  setSelected(null);
                  setPendingPromo(null);
                  recordedRef.current = false;
                }}
                onLockedClick={(p) =>
                  toast.info(`${p.name} is a Plus opponent. Upgrade to unlock.`, {
                    action: { label: "Upgrade", onClick: () => navigate({ to: "/billing" }) },
                  })
                }
              />
              <p className="mt-2 text-xs italic leading-snug text-muted-foreground">
                {persona.bio}
              </p>
            </div>
          )}

          <div className="order-5 flex flex-wrap gap-2 text-sm">
            <button
              onClick={handleOpenInAnalysis}
              disabled={game.history.length === 0}
              className={action}
            >
              Open in analysis
            </button>
            <button
              onClick={() => {
                setMode(vsBot ? "human" : "engine");
                handleNewGame();
              }}
              className={action}
            >
              {vsBot ? "Pass and play instead" : "Play a bot instead"}
            </button>
          </div>
        </aside>
      </main>

      {pendingPromo && (
        <PromotionDialog
          color={game.turn}
          onCancel={() => setPendingPromo(null)}
          onPick={(p) => {
            const { from, to } = pendingPromo;
            setPendingPromo(null);
            playWithSound(from, to, p);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function PlayerStrip({
  name,
  sub,
  portrait,
  active,
  thinking,
  captured,
}: {
  name: string;
  sub: string;
  portrait?: string;
  active: boolean;
  thinking?: boolean;
  captured: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border">
        {portrait ? (
          <img
            src={portrait}
            alt=""
            width={40}
            height={40}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-muted-foreground">
            <UserIcon className="h-5 w-5" />
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate text-sm font-semibold">
          {name}
          {active && <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" />}
          {thinking && <span className="text-xs font-normal text-muted-foreground">thinking…</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      <div className="ml-auto min-w-0">{captured}</div>
    </div>
  );
}
