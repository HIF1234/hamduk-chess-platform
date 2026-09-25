import { Chess, type Move } from "chess.js";

export type LoadedPgn = {
  headers: Record<string, string>;
  moves: Move[];
  finalFen: string;
};

export function loadPgn(pgn: string): LoadedPgn {
  const chess = new Chess();
  chess.loadPgn(pgn, { strict: false });
  const rawHeaders = chess.header() as Record<string, string | null>;
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawHeaders)) {
    if (v != null) headers[k] = v;
  }
  return {
    headers,
    moves: chess.history({ verbose: true }),
    finalFen: chess.fen(),
  };
}

export function exportPgn(
  headers: Record<string, string>,
  moves: Move[],
  startFen?: string,
): string {
  const custom = startFen && startFen !== new Chess().fen() ? startFen : undefined;
  const chess = custom ? new Chess(custom) : new Chess();
  for (const [k, v] of Object.entries(headers)) {
    if (v) chess.header(k, v);
  }
  // A game from a set-up position needs these headers, or it replays from the start.
  if (custom) {
    chess.header("SetUp", "1");
    chess.header("FEN", custom);
  }
  for (const m of moves) {
    chess.move({ from: m.from, to: m.to, promotion: m.promotion });
  }
  return chess.pgn();
}

export function downloadPgn(pgn: string, filename = "game.pgn") {
  const blob = new Blob([pgn], { type: "application/x-chess-pgn" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
