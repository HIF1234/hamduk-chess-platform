import { useCallback, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { recordClientSignals } from "@/lib/fair-play-signals.functions";

type Win = { type: "blur"; at: number; ply: number; duration_ms?: number };
type Page = { type: "copy" | "paste" | "cut"; at: number; ply: number };
type MoveSig = { ply: number; drag_duration_ms?: number; reaction_time_ms?: number };

const FLUSH_MS = 15_000;

/**
 * Records fair-play signals for the current player during a live game: when the game tab
 * loses focus, copy/paste/cut, and how long each move took to start and to make. Batches go
 * to the server every 15 seconds and when the game ends. Nothing about other tabs or sites
 * is recorded, only that this tab lost focus and for how long.
 */
export function useFairPlaySignals(opts: {
  gameId: string;
  active: boolean;
  ply: number;
  myTurn: boolean;
}) {
  const send = useServerFn(recordClientSignals);
  const buf = useRef<{ window: Win[]; page: Page[]; moves: MoveSig[] }>({
    window: [],
    page: [],
    moves: [],
  });
  const ply = useRef(opts.ply);
  ply.current = opts.ply;
  const turnStart = useRef<number | null>(null);
  const firstTouch = useRef<number | null>(null);
  const lastTouch = useRef<number | null>(null);

  const flush = useCallback(() => {
    const b = buf.current;
    if (!b.window.length && !b.page.length && !b.moves.length) return;
    buf.current = { window: [], page: [], moves: [] };
    void send({ data: { gameId: opts.gameId, ...b } }).catch(() => {
      // Put it back for the next attempt, within limits.
      buf.current.window.unshift(...b.window.slice(-50));
      buf.current.page.unshift(...b.page.slice(-50));
      buf.current.moves.unshift(...b.moves.slice(-50));
    });
  }, [send, opts.gameId]);

  // A new turn starts the reaction clock.
  useEffect(() => {
    if (opts.active && opts.myTurn) {
      turnStart.current = performance.now();
      firstTouch.current = null;
      lastTouch.current = null;
    }
  }, [opts.active, opts.myTurn, opts.ply]);

  useEffect(() => {
    if (!opts.active) return;
    let blurAt: number | null = null;
    const onBlur = () => {
      blurAt = performance.now();
      buf.current.window.push({ type: "blur", at: Date.now(), ply: ply.current });
    };
    const onFocus = () => {
      if (blurAt === null) return;
      const last = buf.current.window[buf.current.window.length - 1];
      if (last) last.duration_ms = Math.round(performance.now() - blurAt);
      blurAt = null;
    };
    const onClip = (e: ClipboardEvent) =>
      buf.current.page.push({ type: e.type as Page["type"], at: Date.now(), ply: ply.current });
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("copy", onClip);
    document.addEventListener("paste", onClip);
    document.addEventListener("cut", onClip);
    const t = setInterval(flush, FLUSH_MS);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("copy", onClip);
      document.removeEventListener("paste", onClip);
      document.removeEventListener("cut", onClip);
      clearInterval(t);
      flush();
    };
  }, [opts.active, flush]);

  /** Call on pointerdown on the board. */
  const onBoardPointerDown = useCallback(() => {
    const now = performance.now();
    if (firstTouch.current === null) firstTouch.current = now;
    lastTouch.current = now;
  }, []);

  /** Call when this player submits a move; `movePly` is the ply the move will have. */
  const onMoveMade = useCallback((movePly: number) => {
    const now = performance.now();
    const sig: MoveSig = { ply: movePly };
    if (turnStart.current !== null && firstTouch.current !== null)
      sig.reaction_time_ms = Math.round(firstTouch.current - turnStart.current);
    if (lastTouch.current !== null) sig.drag_duration_ms = Math.round(now - lastTouch.current);
    buf.current.moves.push(sig);
  }, []);

  return { onBoardPointerDown, onMoveMade, flush };
}
