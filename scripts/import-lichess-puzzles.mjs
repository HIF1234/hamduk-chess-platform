#!/usr/bin/env node
// Converts a slice of the Lichess puzzle database (CC0, https://database.lichess.org/#puzzles)
// into a CSV ready for `\copy public.puzzles (fen, solution, themes, rating, source, approved)`.
//
// Lichess stores the position BEFORE the opponent's last move and lists that move first.
// Hamduk puzzles start with the solver to move, so the first move is applied here.
//
// Usage: node scripts/import-lichess-puzzles.mjs <lichess.csv> <out.csv> [perBucket=2300]
import { createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { Chess } from "chess.js";

const [input, output, perBucketArg] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: import-lichess-puzzles.mjs <lichess.csv> <out.csv> [perBucket]");
  process.exit(1);
}
const PER_BUCKET = Number(perBucketArg ?? 2300); // per 100-point rating band, 400..3000
const THEME_ALIASES = { intermezzo: "zwischenzug", trappedPiece: "trapping" };

const buckets = new Map();
let seen = 0;
let skipped = 0;

const rl = createInterface({ input: createReadStream(input) });
for await (const line of rl) {
  if (line.startsWith("PuzzleId")) continue;
  seen++;
  const [id, fen, moves, rating, deviation, popularity, plays, themes] = line.split(",");
  const r = Number(rating);
  // Well-established, well-liked puzzles only.
  if (
    !(r >= 400 && r < 3000) ||
    Number(deviation) > 90 ||
    Number(popularity) < 80 ||
    Number(plays) < 200
  ) {
    skipped++;
    continue;
  }
  const band = Math.floor(r / 100);
  const list = buckets.get(band) ?? [];
  if (list.length >= PER_BUCKET) continue;
  list.push({ id, fen, moves: moves.split(" "), rating: r, themes: themes.split(" ") });
  buckets.set(band, list);
}

const out = createWriteStream(output);
const pgArray = (xs) => `{${xs.map((x) => `"${x.replace(/"/g, '\\"')}"`).join(",")}}`;
let written = 0;
for (const list of buckets.values()) {
  for (const p of list) {
    const chess = new Chess(p.fen);
    const first = p.moves[0];
    try {
      chess.move({ from: first.slice(0, 2), to: first.slice(2, 4), promotion: first[4] });
    } catch {
      skipped++;
      continue;
    }
    const themes = [...new Set(p.themes.map((t) => THEME_ALIASES[t] ?? t))];
    const row = [
      chess.fen(),
      pgArray(p.moves.slice(1)),
      pgArray(themes),
      p.rating,
      `lichess:${p.id}`,
      "t",
    ];
    out.write(row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\n");
    written++;
  }
}
out.end();
console.log(JSON.stringify({ seen, written, skipped, bands: buckets.size }));
