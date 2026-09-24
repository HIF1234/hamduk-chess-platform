import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Chessboard } from "react-chessboard";
import type { Square } from "chess.js";
import { Loader2, RotateCcw } from "lucide-react";
import { useChessGame } from "@/hooks/useChessGame";
import { useStockfish } from "@/hooks/useStockfish";
import { BOT_PERSONAS, getPersona } from "@/lib/bot-personas";
import { useBoardSquares } from "@/lib/preferences";
import { sounds } from "@/lib/chess-sounds";
import { useAuth } from "@/lib/auth";

const FREE_BOTS = BOT_PERSONAS.filter((b) => b.tier === "free");

/**
 * Play a bot right on the home page: no account, no guest session. The engine
 * (a large download) only loads after the visitor's first move.
 */
export function HomeBotGame() {
  const { user } = useAuth();
  const [botId, setBotId] = useState("agbero");
  const [gameKey, setGameKey] = useState(0);
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {FREE_BOTS.map((b) => (
          <button
            key={b.id}
            onClick={() => {
              setBotId(b.id);
              setGameKey((k) => k + 1);
            }}
            className={`flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs ${
              botId === b.id
                ? "border-primary bg-primary/10 font-semibold"
                : "border-border hover:bg-accent"
            }`}
          >
            <img
              src={b.portrait}
              alt=""
              className="h-7 w-7 rounded-full object-cover"
              loading="lazy"
            />
            {b.name}
            <span className="text-muted-foreground">{b.rating}</span>
          </button>
        ))}
      </div>
      <MiniGame
        key={`${botId}-${gameKey}`}
        botId={botId}
        onRestart={() => setGameKey((k) => k + 1)}
        signedIn={!!user}
      />
    </div>
  );
}

function MiniGame({
  botId,
  onRestart,
  signedIn,
}: {
  botId: string;
  onRestart: () => void;
  signedIn: boolean;
}) {
  const game = useChessGame();
  const persona = getPersona(botId);
  const squares = useBoardSquares();
  const [selected, setSelected] = useState<Square | null>(null);
  const [started, setStarted] = useState(false);

  const play = useCallback(
    (from: Square, to: Square) => {
      const move = game.makeMove(from, to, "q");
      if (!move) return false;
      if (move.captured) sounds.capture();
      else sounds.move();
      setStarted(true);
      setSelected(null);
      return true;
    },
    [game],
  );

  const humanTurn = game.turn === "w" && !game.gameOver;
  const legal = useMemo(() => (selected ? game.legalMovesFor(selected) : []), [selected, game]);

  const styles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (game.lastMove) {
      s[game.lastMove.from] = { background: "rgba(245, 166, 35, 0.3)" };
      s[game.lastMove.to] = { background: "rgba(245, 166, 35, 0.45)" };
    }
    if (selected) {
      s[selected] = { background: "rgba(26, 107, 58, 0.45)" };
      for (const t of legal)
        s[t] = { background: "radial-gradient(circle, rgba(0,0,0,.3) 22%, transparent 24%)" };
    }
    return s;
  }, [game.lastMove, selected, legal]);

  const status = game.status;
  const result =
    status.kind === "checkmate" || status.kind === "resigned"
      ? status.winner === "w"
        ? `You beat ${persona.name}! 🎉`
        : `${persona.name} wins this one.`
      : status.kind === "stalemate" || status.kind === "draw"
        ? "It's a draw."
        : null;

  useEffect(() => {
    if (game.gameOver) sounds.end();
  }, [game.gameOver]);

  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <img src={persona.portrait} alt="" className="h-10 w-10 rounded-full object-cover" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {persona.name}{" "}
            <span className="font-normal text-muted-foreground">· {persona.hometown}</span>
          </p>
          <p className="truncate text-xs italic text-muted-foreground">“{persona.catchphrase}”</p>
        </div>
        {started && !game.gameOver && game.turn === "b" && (
          <Loader2
            className="ml-auto h-4 w-4 animate-spin text-muted-foreground"
            aria-label="Thinking"
          />
        )}
      </div>
      <div className="aspect-square w-full">
        <Chessboard
          options={{
            ...squares,
            id: "home-board",
            position: game.fen,
            squareStyles: styles,
            allowDragging: humanTurn,
            animationDurationInMs: 150,
            onPieceDrop: ({ sourceSquare, targetSquare }) =>
              humanTurn && !!targetSquare && play(sourceSquare as Square, targetSquare as Square),
            onSquareClick: ({ square }) => {
              if (!humanTurn) return;
              const sq = square as Square;
              if (selected && legal.includes(sq)) {
                play(selected, sq);
                return;
              }
              setSelected(game.legalMovesFor(sq).length ? sq : null);
            },
          }}
        />
      </div>
      {started && !game.gameOver && <BotMover game={game} botId={botId} play={play} />}

      <div className="mt-3 flex min-h-9 flex-wrap items-center gap-2 text-sm">
        {result ? (
          <>
            <span className="font-semibold">{result}</span>
            <button
              onClick={onRestart}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Play again
            </button>
            {!signedIn && (
              <Link to="/login" className="text-xs text-primary underline">
                Sign up free to save games & earn badges
              </Link>
            )}
          </>
        ) : !started ? (
          <span className="text-muted-foreground">
            You're White — make your first move to start.
          </span>
        ) : (
          <>
            <button
              onClick={() => game.resign("w")}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              Resign
            </button>
            <Link to="/play/bot" search={{ bot: botId }} className="text-xs text-primary underline">
              Open full board
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

/** Mounted only once the game has started, so Stockfish loads on demand. */
function BotMover({
  game,
  botId,
  play,
}: {
  game: ReturnType<typeof useChessGame>;
  botId: string;
  play: (from: Square, to: Square) => boolean;
}) {
  const { requestBotMove } = useStockfish();
  const thinking = useRef(false);
  const persona = getPersona(botId);

  useEffect(() => {
    if (game.gameOver || game.turn !== "b" || thinking.current) return;
    thinking.current = true;
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
          thinking.current = false;
          if (!uci || uci === "(none)") return;
          play(uci.slice(0, 2) as Square, uci.slice(2, 4) as Square);
        },
      );
    }, 300);
    return () => {
      clearTimeout(timer);
      thinking.current = false;
    };
  }, [game.fen, game.turn, game.gameOver, game.history.length, persona, play, requestBotMove]);

  return null;
}
