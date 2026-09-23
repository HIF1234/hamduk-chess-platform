import { Chess, type Move } from "chess.js";

const PIECE_WORDS: Record<string, "k" | "q" | "r" | "b" | "n" | "p"> = {
  king: "k",
  queen: "q",
  rook: "r",
  castle: "r",
  bishop: "b",
  knight: "n",
  horse: "n",
  pawn: "p",
};

// Speech engines often mishear file letters; map the common ones back.
const SPOKEN_FILES: Record<string, string> = {
  ay: "a",
  bee: "b",
  be: "b",
  see: "c",
  sea: "c",
  dee: "d",
  ee: "e",
  eff: "f",
  gee: "g",
  aitch: "h",
};

const SPOKEN_RANKS: Record<string, string> = {
  one: "1",
  two: "2",
  to: "2",
  too: "2",
  three: "3",
  four: "4",
  for: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
};

/**
 * Finds legal moves the player mentioned in free text — either written SAN
 * ("Nf5", "Bxe6", "O-O") or spoken phrases ("knight to f5", "bishop takes e 6",
 * "castle kingside"). Returns unique legal moves in the order mentioned.
 */
export function extractMentionedMoves(text: string, fen: string, max = 3): Move[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }
  const legal = chess.moves({ verbose: true });
  const found: Move[] = [];
  const add = (m: Move | undefined) => {
    if (m && !found.some((f) => f.lan === m.lan)) found.push(m);
  };

  // 1. Written SAN tokens. A bare square after a piece word ("knight c3") is
  // left to the spoken-phrase pass so it is not misread as a pawn move.
  const tokens = text.split(/[\s,;()!?]+/);
  for (let t = 0; t < tokens.length; t++) {
    const token = tokens[t].replace(/[.]+$/, "").replace(/^\d+\.+/, "");
    if (/^[a-h][1-8]$/.test(token) && PIECE_WORDS[tokens[t - 1]?.toLowerCase() ?? ""]) continue;
    if (!/^(O-O(-O)?|0-0(-0)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=?[QRBN])?)[+#]?$/.test(token))
      continue;
    const san = token.replace(/0/g, "O");
    add(legal.find((m) => m.san.replace(/[+#]/g, "") === san.replace(/[+#]/g, "")));
  }

  // 2. Spoken castling.
  const lower = text.toLowerCase();
  if (/castl\w*\s+(king\s*side|short)|short castle/.test(lower))
    add(legal.find((m) => m.san.startsWith("O-O") && !m.san.startsWith("O-O-O")));
  if (/castl\w*\s+(queen\s*side|long)|long castle/.test(lower))
    add(legal.find((m) => m.san.startsWith("O-O-O")));

  // 3. Spoken "<piece> (to|takes) <file> <rank>".
  const words = lower
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const piece = PIECE_WORDS[words[i]];
    if (!piece) continue;
    // Look ahead a few words for a square, skipping filler like "to", "takes", "on".
    for (let j = i + 1; j < Math.min(words.length, i + 5); j++) {
      if (PIECE_WORDS[words[j]]) break;
      const square = readSquare(words, j);
      if (!square) continue;
      const matches = legal.filter((m) => m.piece === piece && m.to === square);
      if (matches.length) add(matches[0]);
      break;
    }
  }

  return found.slice(0, max);
}

function readSquare(words: string[], i: number): string | null {
  const w = words[i];
  if (/^[a-h][1-8]$/.test(w)) return w;
  const file = /^[a-h]$/.test(w) ? w : SPOKEN_FILES[w];
  if (!file) return null;
  const next = words[i + 1];
  if (!next) return null;
  const rank = /^[1-8]$/.test(next) ? next : SPOKEN_RANKS[next];
  return rank ? file + rank : null;
}
