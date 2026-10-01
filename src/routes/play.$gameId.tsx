import { useEffect, useMemo, useRef, useState } from "react";
import { useFairPlaySignals } from "@/hooks/useFairPlaySignals";
import { VoiceChat } from "@/components/game/VoiceChat";
import { ReportButton } from "@/components/ReportButton";
import { ShareGame } from "@/components/ShareGame";
import { useBoardSquares } from "@/lib/preferences";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { submitMove, resignGame, confirmGameReady } from "@/lib/matchmaking.functions";
import {
  offerDraw,
  respondDraw,
  abortGame,
  requestTakeback,
  respondTakeback,
  offerRematch,
  acceptRematch,
  checkFlag,
  checkFirstMoveTimeout,
} from "@/lib/game-actions.functions";
import {
  heartbeat,
  markDisconnected,
  reconnect,
  claimDisconnectWin,
} from "@/lib/presence.functions";
import { sounds } from "@/lib/chess-sounds";
import { useGameClock, formatClock } from "@/hooks/useGameClock";
import { usePremoves } from "@/hooks/usePremoves";
import { GameActionBar } from "@/components/chess/GameActionBar";
import { OfferBanner } from "@/components/chess/OfferBanner";
import { DisconnectBanner } from "@/components/chess/DisconnectBanner";
import { GameReview } from "@/components/chess/GameReview";
import { CorrespondencePanel } from "@/components/chess/CorrespondencePanel";

type GameRow = {
  id: string;
  white_id: string;
  black_id: string;
  fen: string;
  pgn: string;
  ply: number;
  status: string;
  result: string | null;
  end_reason: string | null;
  winner_id: string | null;
  time_control: string;
  variant: string;
  chess960_start_fen: string | null;
  time_white_ms: number | null;
  time_black_ms: number | null;
  last_clock_update: string | null;
  initial_sec: number | null;
  increment_sec: number | null;
  draw_offer_by: string | null;
  draw_offer_at: string | null;
  takeback_offer_by: string | null;
  takeback_offer_at: string | null;
  rated: boolean;
  is_correspondence: boolean;
  days_per_move: number | null;
  move_deadline: string | null;
  notify_by_email: boolean;
};

type ProfileLite = { id: string; username: string; rating: number };

export const Route = createFileRoute("/play/$gameId")({
  head: () => ({ meta: [{ title: "Game — Hamduk Chess" }] }),
  component: PlayPage,
});

function PlayPage() {
  const boardSquares = useBoardSquares();
  const { gameId } = Route.useParams();
  const { user, loading, isGuest } = useAuth();
  const navigate = useNavigate();
  const submit = useServerFn(submitMove);
  const resign = useServerFn(resignGame);
  const draw = useServerFn(offerDraw);
  const drawRespond = useServerFn(respondDraw);
  const abort = useServerFn(abortGame);
  const tbReq = useServerFn(requestTakeback);
  const tbResp = useServerFn(respondTakeback);
  const rematchOffer = useServerFn(offerRematch);
  const rematchAccept = useServerFn(acceptRematch);
  const flagCheck = useServerFn(checkFlag);
  const firstMoveTimeoutCheck = useServerFn(checkFirstMoveTimeout);
  const gameReady = useServerFn(confirmGameReady);
  const beat = useServerFn(heartbeat);
  const disconnect = useServerFn(markDisconnected);
  const reconnectFn = useServerFn(reconnect);
  const claimWin = useServerFn(claimDisconnectWin);

  const [game, setGame] = useState<GameRow | null>(null);
  // The ply we last played the move sound for -- whichever source reaches it first (our own
  // optimistic local apply, the broadcast, or the postgres_changes backstop). State updates
  // from all three still always apply (server truth always wins on fields like clocks), this
  // only stops the sound firing twice for the same move.
  const lastSoundedPlyRef = useRef(0);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [submitting, setSubmitting] = useState(false);
  const [opponentDisconnectedAt, setOpponentDisconnectedAt] = useState<string | null>(null);
  const [rematchPending, setRematchPending] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Correspondence moves are confirmed in two steps to avoid mis-clicks on slow games.
  const [pendingMove, setPendingMove] = useState<{
    from: string;
    to: string;
    promotion?: string;
    san: string;
  } | null>(null);
  const premoves = usePremoves(3);
  // Tap-to-move: select a square, then tap its destination. Drag still works too.
  const [selected, setSelected] = useState<Square | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Initial load + game realtime
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase.from("games").select("*").eq("id", gameId).single();
      if (cancelled) return;
      if (error || !data) {
        toast.error("Game not found");
        navigate({ to: "/lobby" });
        return;
      }
      setGame(data as GameRow);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, rating")
        .in("id", [data.white_id, data.black_id]);
      if (profs) {
        const map: Record<string, ProfileLite> = {};
        for (const p of profs) map[p.id] = p as ProfileLite;
        setProfiles(map);
      }
    }
    void load();
    const channel = supabase
      .channel(`game:${gameId}`)
      .on("broadcast", { event: "move" }, (msg) => {
        const next = msg.payload as GameRow & { san: string; uci: string };
        setGame((prev) => (prev ? { ...prev, ...next } : next));
        if (next.ply > lastSoundedPlyRef.current) {
          lastSoundedPlyRef.current = next.ply;
          sounds.move();
        }
      })
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          const next = payload.new as GameRow;
          setGame(next);
          // Backstop path: only play the sound if nothing has already sounded for this ply
          // (our own optimistic local move, or a broadcast that beat this here).
          if (next.ply > lastSoundedPlyRef.current) {
            lastSoundedPlyRef.current = next.ply;
            sounds.move();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` },
        (payload) => {
          const ev = payload.new as {
            type: string;
            by_user: string | null;
            payload: Record<string, unknown>;
          };
          if (ev.type === "disconnect" && ev.by_user && ev.by_user !== user?.id) {
            setOpponentDisconnectedAt(new Date().toISOString());
          }
          if (ev.type === "reconnect" && ev.by_user && ev.by_user !== user?.id) {
            setOpponentDisconnectedAt(null);
          }
          if (ev.type === "rematch_offer" && ev.by_user && ev.by_user !== user?.id) {
            setRematchPending(true);
          }
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [gameId, navigate, user?.id]);

  // Presence heartbeat
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const tick = () => {
      if (alive && document.visibilityState === "visible") void beat({});
    };
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [user, beat]);

  // Disconnect tracking
  useEffect(() => {
    if (!user || !game || game.status !== "active") return;
    const isParticipant = user.id === game.white_id || user.id === game.black_id;
    if (!isParticipant) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") void disconnect({ data: { gameId } });
      else void reconnectFn({ data: { gameId } });
    };
    const onBeforeUnload = () => {
      void disconnect({ data: { gameId } });
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [user, game, gameId, disconnect, reconnectFn]);

  const chess = useMemo(() => {
    if (!game) return null;
    const c = new Chess(game.chess960_start_fen ?? undefined);
    try {
      if (game.pgn) c.loadPgn(game.pgn);
      else c.load(game.fen);
    } catch {
      c.load(game.fen);
    }
    return c;
  }, [game]);

  const turn: "w" | "b" = chess?.turn() ?? "w";
  const isWhite = !!user && !!game && user.id === game.white_id;
  const isBlack = !!user && !!game && user.id === game.black_id;
  const isParticipant = isWhite || isBlack;
  const myColor: "w" | "b" | null = isWhite ? "w" : isBlack ? "b" : null;
  const myTurn = myColor !== null && myColor === turn && game?.status === "active";
  const signals = useFairPlaySignals({
    gameId,
    active: isParticipant && !!game && !game.is_correspondence && game.status === "active",
    ply: game?.ply ?? 0,
    myTurn,
  });

  const { whiteDisplayMs, blackDisplayMs } = useGameClock({
    whiteMs: game?.time_white_ms ?? 0,
    blackMs: game?.time_black_ms ?? 0,
    turn,
    lastUpdate: game?.last_clock_update ?? null,
    active: game?.status === "active",
  });

  // Auto-flag check when displayed clock hits 0 for opponent
  const flaggedRef = useRef(false);
  useEffect(() => {
    if (!game || game.status !== "active" || flaggedRef.current) return;
    const oppMs = myColor === "w" ? blackDisplayMs : whiteDisplayMs;
    if (oppMs <= 0 && game.ply >= 2 && !myTurn) {
      flaggedRef.current = true;
      void flagCheck({ data: { gameId } }).catch(() => {
        flaggedRef.current = false;
      });
    }
  }, [game, myColor, whiteDisplayMs, blackDisplayMs, myTurn, gameId, flagCheck]);

  // White's client confirms it has actually loaded the game once -- this is what starts the
  // first-move no-show clock, not game creation, so a slow connection gets time to catch up
  // instead of losing the abort race before the board even renders.
  const readySentRef = useRef(false);
  useEffect(() => {
    if (!game || readySentRef.current) return;
    if (isWhite && game.ply === 0 && game.status === "active") {
      readySentRef.current = true;
      void gameReady({ data: { gameId } }).catch(() => {
        readySentRef.current = false;
      });
    }
  }, [game, isWhite, gameId, gameReady]);

  // Black polls for White's first-move no-show while waiting on ply 0 -- there's no clock
  // hitting zero to key off yet, so this checks periodically instead.
  useEffect(() => {
    if (!game || game.status !== "active" || game.ply !== 0 || isWhite) return;
    const id = setInterval(() => {
      void firstMoveTimeoutCheck({ data: { gameId } }).catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [game, isWhite, gameId, firstMoveTimeoutCheck]);

  // A move can race the end of the game (most often a clock running out in bullet). Show
  // what happened and pull the final state instead of the raw server message.
  function moveFailed(e: unknown, fallback: string) {
    const msg = e instanceof Error ? e.message : fallback;
    if (msg !== "Game is not active") {
      toast.error(msg);
      return;
    }
    void supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setGame(data as GameRow);
        toast.info(
          data.end_reason === "flag"
            ? "Time ran out before that move arrived."
            : "The game has already ended.",
        );
      });
  }

  // Clear any tap-to-move selection whenever the position changes (our move landed, the
  // opponent moved, or a premove fired) so a stale highlight never lingers.
  useEffect(() => {
    setSelected(null);
  }, [game?.fen]);

  // Try premove after opponent moves
  useEffect(() => {
    if (!game || game.status !== "active" || !myTurn || !myColor) return;
    const next = premoves.consumeIfLegal(game.fen);
    if (next) {
      const uci = `${next.from}${next.to}${next.promotion ?? ""}`;
      const after = new Chess(game.fen);
      try {
        after.move({ from: next.from, to: next.to, promotion: next.promotion ?? "q" });
        applyMoveOptimistically(after, myColor, game);
      } catch {
        /* validated a moment ago by consumeIfLegal; if this still somehow fails, the server
         * round trip below is the source of truth anyway -- just skip the optimistic render */
      }
      setSubmitting(true);
      signals.onMoveMade(game.ply + 1);
      void submit({ data: { gameId, uci } })
        .catch((e: unknown) => moveFailed(e, "Premove rejected"))
        .finally(() => setSubmitting(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.fen, myTurn]);

  if (loading || !user || !game || !chess) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const orientation: "white" | "black" = isBlack ? "black" : "white";
  const opponent = isWhite ? profiles[game.black_id] : profiles[game.white_id];
  const me = profiles[user.id];

  // Squares the selected piece can go to: real legal moves on our turn, or (for a premove)
  // any square not already held by our own piece — premoves aren't validated until played.
  const legalTargets = new Set<Square>();
  if (selected) {
    if (myTurn) {
      try {
        const probe = new Chess(chess.fen());
        for (const m of probe.moves({ square: selected, verbose: true }) as { to: string }[]) {
          legalTargets.add(m.to as Square);
        }
      } catch {
        /* no legal moves from this square */
      }
    } else {
      for (const file of "abcdefgh") {
        for (const rank of "12345678") {
          const sq = `${file}${rank}` as Square;
          if (sq === selected) continue;
          const piece = chess.get(sq);
          if (!piece || piece.color !== myColor) legalTargets.add(sq);
        }
      }
    }
  }

  function isPromotionMove(from: Square, to: Square): boolean {
    const piece = chess?.get(from);
    if (!piece || piece.type !== "p") return false;
    return (myColor === "w" && to[1] === "8") || (myColor === "b" && to[1] === "1");
  }

  /** Renders a locally-validated move immediately instead of waiting on the round trip to the
   *  server and back through Realtime -- see the longer note at its call sites. `after` is the
   *  chess.js instance with the move already applied (mutates in place, so callers pass the
   *  same instance they just called .move() on). */
  function applyMoveOptimistically(after: Chess, moverColor: "w" | "b", baseline: GameRow) {
    const ply = baseline.ply + 1;
    let status = baseline.status;
    let result = baseline.result;
    let endReason = baseline.end_reason;
    if (after.isCheckmate()) {
      status = "completed";
      result = moverColor === "w" ? "white" : "black";
      endReason = "checkmate";
    } else if (after.isStalemate() || after.isDraw()) {
      status = "completed";
      result = "draw";
      endReason = after.isStalemate() ? "stalemate" : "draw";
    }
    setGame((prev) =>
      prev
        ? {
            ...prev,
            fen: after.fen(),
            pgn: after.pgn(),
            ply,
            status,
            result,
            end_reason: endReason,
            draw_offer_by: null,
            draw_offer_at: null,
            takeback_offer_by: null,
            takeback_offer_at: null,
          }
        : prev,
    );
    lastSoundedPlyRef.current = ply;
    sounds.move();
  }

  /** Shared by drag-drop and tap-to-move. */
  function attemptMove(from: Square, to: Square): boolean {
    if (!game || !chess || from === to) return false;
    const isPromo = isPromotionMove(from, to);

    if (!myTurn) {
      // Premove path: not validated against the current position (it's for a future one);
      // it's checked for real when it's actually played, in usePremoves.consumeIfLegal.
      if (!myColor) return false;
      premoves.enqueue({ from, to, promotion: isPromo ? "q" : undefined });
      setSelected(null);
      return true;
    }

    if (submitting) return false;
    const probe = new Chess(chess.fen());
    let legal;
    try {
      legal = probe.move({ from, to, promotion: "q" });
    } catch {
      return false;
    }
    if (!legal) return false;
    setSelected(null);
    const uci = `${from}${to}${isPromo ? "q" : ""}`;
    if (game.is_correspondence) {
      setPendingMove({ from, to, promotion: isPromo ? "q" : undefined, san: legal.san });
      return false;
    }

    // The move is already known legal locally -- render it now, don't wait on the server.
    // The server is still authoritative: its broadcast (or moveFailed's refetch, if the move
    // is ever rejected -- an out-of-sync race, not a legality issue since that was already
    // checked here) overwrites this moments later with the real state.
    if (!myColor) return false;
    applyMoveOptimistically(probe, myColor, game);

    setSubmitting(true);
    signals.onMoveMade(game.ply + 1);
    void submit({ data: { gameId, uci } })
      .catch((e: unknown) => moveFailed(e, "Move rejected"))
      .finally(() => setSubmitting(false));
    return true;
  }

  function handleDrop({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean {
    if (!targetSquare) return false;
    return attemptMove(sourceSquare as Square, targetSquare as Square);
  }

  function handleSquareClick({ square }: { square: string }) {
    const sq = square as Square;
    if (!chess || !game || game.status !== "active") return;
    if (selected) {
      if (sq === selected) {
        setSelected(null);
        return;
      }
      if (legalTargets.has(sq)) {
        attemptMove(selected, sq);
        return;
      }
    }
    const piece = chess.get(sq);
    setSelected(piece && myColor && piece.color === myColor ? sq : null);
  }

  async function handleResign() {
    if (!confirm("Resign this game?")) return;
    try {
      await resign({ data: { gameId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  async function handleOfferDraw() {
    try {
      await draw({ data: { gameId } });
      toast.success("Draw offered");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  async function handleAbort() {
    try {
      await abort({ data: { gameId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  async function handleRequestTakeback() {
    try {
      await tbReq({ data: { gameId } });
      toast.success("Takeback requested");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  async function handleOfferRematch() {
    try {
      await rematchOffer({ data: { gameId } });
      toast.success("Rematch offered");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  async function handleAcceptRematch() {
    try {
      const { gameId: newId } = await rematchAccept({ data: { gameId } });
      navigate({ to: "/play/$gameId", params: { gameId: newId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const incomingDraw = game.draw_offer_by && game.draw_offer_by !== user.id && game.draw_offer_at;
  const outgoingDraw = game.draw_offer_by === user.id;
  const incomingTb =
    game.takeback_offer_by && game.takeback_offer_by !== user.id && game.takeback_offer_at;
  const outgoingTb = game.takeback_offer_by === user.id;

  const customArrows = premoves.queue.map((p, i) => ({
    startSquare: p.from,
    endSquare: p.to,
    color: `rgba(245, 166, 35, ${0.5 - i * 0.1})`,
  }));

  const squareStyles: Record<string, React.CSSProperties> = {};
  if (selected) {
    squareStyles[selected] = {
      background: myTurn ? "rgba(234, 179, 8, 0.35)" : "rgba(245, 166, 35, 0.4)",
    };
    for (const t of legalTargets) {
      squareStyles[t] = {
        background: "radial-gradient(circle, rgba(24,24,27,0.35) 22%, transparent 24%)",
      };
    }
  }

  const statusText =
    game.status === "completed"
      ? game.result === "draw"
        ? game.end_reason === "first_move_timeout"
          ? "Game aborted — no first move made in time"
          : `Draw by ${game.end_reason ?? "agreement"}`
        : `${game.result === "white" ? (profiles[game.white_id]?.username ?? "White") : (profiles[game.black_id]?.username ?? "Black")} won by ${game.end_reason ?? "resignation"}`
      : myTurn
        ? "Your turn"
        : isParticipant
          ? "Opponent's turn"
          : "Spectating";

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_320px]">
        <div>
          <Link
            to="/lobby"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to lobby
          </Link>
          <PlayerStrip
            profile={opponent}
            color={isWhite ? "Black" : "White"}
            active={!myTurn && game.status === "active"}
            clockMs={isWhite ? blackDisplayMs : whiteDisplayMs}
          />
          <div
            className="my-2 aspect-square w-full max-w-[640px]"
            onPointerDown={signals.onBoardPointerDown}
          >
            <Chessboard
              options={{
                ...boardSquares,
                position: chess.fen(),
                onPieceDrop: handleDrop,
                onSquareClick: handleSquareClick,
                squareStyles,
                boardOrientation: orientation,
                allowDragging: isParticipant && game.status === "active",
                animationDurationInMs: 200,
                id: `game-${gameId}`,
                arrows: customArrows,
              }}
            />
          </div>
          <PlayerStrip
            profile={me}
            color={isWhite ? "White" : "Black"}
            active={myTurn}
            you
            clockMs={isWhite ? whiteDisplayMs : blackDisplayMs}
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {game.time_control} · {game.variant}
              </p>
              {!game.rated && (
                <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">
                  Casual
                </span>
              )}
            </div>
            <p className="mt-1 font-serif text-lg font-bold">{statusText}</p>

            {game.is_correspondence && pendingMove && (
              <div className="my-3 flex items-center justify-between gap-2 rounded-lg border border-primary bg-primary/5 px-3 py-2 text-sm">
                <span>
                  Play <span className="font-mono font-bold">{pendingMove.san}</span>?
                </span>
                <span className="flex gap-2">
                  <button
                    onClick={() => {
                      const uci = `${pendingMove.from}${pendingMove.to}${pendingMove.promotion ?? ""}`;
                      setSubmitting(true);
                      setPendingMove(null);
                      void submit({ data: { gameId, uci } })
                        .catch((e: unknown) => moveFailed(e, "Move rejected"))
                        .finally(() => setSubmitting(false));
                    }}
                    className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setPendingMove(null)}
                    className="rounded-md border border-border px-3 py-1 text-xs font-semibold hover:bg-accent"
                  >
                    Cancel
                  </button>
                </span>
              </div>
            )}

            {game.is_correspondence && isParticipant && (
              <CorrespondencePanel
                gameId={gameId}
                daysPerMove={game.days_per_move}
                moveDeadline={game.move_deadline}
                notifyByEmail={game.notify_by_email}
                myTurn={myTurn}
                active={game.status === "active"}
              />
            )}

            {incomingDraw && (
              <OfferBanner
                kind="draw"
                offeredAt={game.draw_offer_at!}
                onAccept={() => drawRespond({ data: { gameId, accept: true } })}
                onDecline={() => drawRespond({ data: { gameId, accept: false } })}
              />
            )}
            {incomingTb && (
              <OfferBanner
                kind="takeback"
                offeredAt={game.takeback_offer_at!}
                onAccept={() => tbResp({ data: { gameId, accept: true } })}
                onDecline={() => tbResp({ data: { gameId, accept: false } })}
              />
            )}
            {opponentDisconnectedAt && game.status === "active" && (
              <DisconnectBanner
                disconnectedAt={opponentDisconnectedAt}
                onClaimWin={() => {
                  void claimWin({ data: { gameId } });
                }}
              />
            )}
            {rematchPending && game.status === "completed" && (
              <div className="my-3 flex items-center justify-between rounded-lg border border-primary bg-primary/5 px-4 py-3">
                <p className="font-semibold">Rematch offered</p>
                <button
                  onClick={handleAcceptRematch}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Accept
                </button>
              </div>
            )}
            {game.status === "completed" && chess && chess.history().length > 0 && (
              <button
                onClick={() => setReviewOpen(true)}
                className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Review game
              </button>
            )}
            {game.status === "completed" && isParticipant && (
              <div className="mt-2">
                <ReportButton targetType="game" targetId={game.id} label="Report this game" />
              </div>
            )}
            {game.status === "completed" && (
              <div className="mt-3">
                <ShareGame
                  gameId={game.id}
                  fen={game.fen}
                  pgn={game.pgn || undefined}
                  headline={statusText}
                  orientation={orientation}
                />
              </div>
            )}

            <div className="mt-3">
              <GameActionBar
                status={game.status}
                ply={game.ply}
                rated={game.rated}
                isParticipant={isParticipant}
                onResign={handleResign}
                onOfferDraw={handleOfferDraw}
                onAbort={handleAbort}
                onRequestTakeback={handleRequestTakeback}
                onOfferRematch={handleOfferRematch}
                drawOfferOutgoing={!!outgoingDraw}
                takebackOfferOutgoing={!!outgoingTb}
              />
            </div>
            {premoves.queue.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {premoves.queue.length} premove(s) queued —{" "}
                <button onClick={premoves.clear} className="underline hover:text-foreground">
                  clear
                </button>
              </p>
            )}
          </div>

          {isParticipant && !isGuest && !game.is_correspondence && opponent && (
            <VoiceChat gameId={gameId} myId={user.id} opponentName={opponent.username} />
          )}

          <MoveHistory chess={chess} />
        </aside>
      </main>

      {reviewOpen && chess && game && (
        <GameReview
          startFen={
            game.chess960_start_fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
          }
          sanMoves={chess.history()}
          orientation={orientation}
          depth={14}
          gameId={game.id}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </div>
  );
}

function PlayerStrip({
  profile,
  color,
  active,
  you,
  clockMs,
}: {
  profile?: ProfileLite;
  color: string;
  active: boolean;
  you?: boolean;
  clockMs: number;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${active ? "border-primary bg-primary/5" : "border-border bg-card"}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-2.5 w-2.5 rounded-full ${active ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`}
        />
        <div>
          <p className="text-sm font-semibold">
            {profile?.username ?? "—"}{" "}
            {you && <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {color} · {profile?.rating ?? "—"}
          </p>
        </div>
      </div>
      <div
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"} ${clockMs < 10_000 ? "text-destructive" : ""}`}
      >
        <Clock className="h-4 w-4" />
        {formatClock(clockMs)}
      </div>
    </div>
  );
}

function MoveHistory({ chess }: { chess: Chess }) {
  const history = chess.history();
  const rows: { num: number; w?: string; b?: string }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push({ num: i / 2 + 1, w: history[i], b: history[i + 1] });
  }
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Moves
      </p>
      <div className="max-h-[400px] overflow-y-auto font-mono text-sm">
        {rows.length === 0 && <p className="text-muted-foreground">No moves yet.</p>}
        {rows.map((r) => (
          <div key={r.num} className="flex gap-2 py-0.5">
            <span className="w-6 text-right text-muted-foreground">{r.num}.</span>
            <span className="w-16">{r.w}</span>
            <span className="w-16">{r.b ?? ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
