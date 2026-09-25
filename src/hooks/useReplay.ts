import { useCallback, useMemo, useState } from "react";
import { Chess, type Move } from "chess.js";
import { startFen } from "@/lib/fen";
import { loadPgn } from "@/lib/pgn";

export type ReplayState = {
  startFen: string;
  headers: Record<string, string>;
  moves: Move[];
  ply: number; // 0 = start position, N = after Nth move
};

const EMPTY: ReplayState = { startFen, headers: {}, moves: [], ply: 0 };

export function useReplay() {
  const [state, setState] = useState<ReplayState>(EMPTY);

  const currentChess = useMemo(() => {
    const c = new Chess(state.startFen);
    for (let i = 0; i < state.ply; i++) {
      const m = state.moves[i];
      c.move({ from: m.from, to: m.to, promotion: m.promotion });
    }
    return c;
  }, [state]);

  const fen = currentChess.fen();
  const turn = currentChess.turn();

  const setPly = useCallback((p: number) => {
    setState((s) => ({ ...s, ply: Math.max(0, Math.min(s.moves.length, p)) }));
  }, []);

  const next = useCallback(() => setPly(state.ply + 1), [setPly, state.ply]);
  const prev = useCallback(() => setPly(state.ply - 1), [setPly, state.ply]);
  const toStart = useCallback(() => setPly(0), [setPly]);
  const toEnd = useCallback(() => setPly(state.moves.length), [setPly, state.moves.length]);

  const loadPgnText = useCallback((pgn: string) => {
    const loaded = loadPgn(pgn);
    setState({
      startFen,
      headers: loaded.headers,
      moves: loaded.moves,
      ply: loaded.moves.length,
    });
  }, []);

  const loadFenText = useCallback((fenStr: string) => {
    const trimmed = fenStr.trim();
    new Chess(trimmed); // throws if invalid
    setState({ startFen: trimmed, headers: {}, moves: [], ply: 0 });
  }, []);

  const reset = useCallback(() => setState(EMPTY), []);

  /** Loads a saved line: start position, UCI moves and the ply to show. */
  const loadLine = useCallback(
    (line: { startFen: string; headers: Record<string, string>; moves: string[]; ply: number }) => {
      const c = new Chess(line.startFen);
      const moves: Move[] = [];
      for (const uci of line.moves) {
        moves.push(c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }));
      }
      setState({
        startFen: line.startFen,
        headers: line.headers,
        moves,
        ply: Math.min(line.ply, moves.length),
      });
    },
    [],
  );

  /** Plays a move from the current ply. If it isn't the next move of the loaded line,
   *  the rest of the line is replaced. Returns false when the move is illegal. */
  const playMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      let played: Move;
      try {
        played = new Chess(fen).move({ from, to, promotion: promotion ?? "q" });
      } catch {
        return false;
      }
      setState((s) => {
        const nextMove = s.moves[s.ply];
        if (nextMove && nextMove.san === played.san) return { ...s, ply: s.ply + 1 };
        return { ...s, moves: [...s.moves.slice(0, s.ply), played], ply: s.ply + 1 };
      });
      return true;
    },
    [fen],
  );

  return {
    ...state,
    fen,
    turn,
    isStart: state.ply === 0,
    isEnd: state.ply === state.moves.length,
    setPly,
    next,
    prev,
    toStart,
    toEnd,
    loadPgnText,
    loadFenText,
    reset,
    playMove,
    loadLine,
  };
}
