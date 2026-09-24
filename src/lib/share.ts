// Client-side sharing helpers. Everything runs in the browser: no image server needed.
import { Chess } from "chess.js";

export const SITE_URL = "https://play.chess.hamduk.com.ng";

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const xUrl = (text: string, url: string) =>
  `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Uses the phone's native share sheet when available (Android/iOS), else false. */
export async function nativeShare(data: {
  title: string;
  text: string;
  url: string;
  files?: File[];
}) {
  const nav = navigator as Navigator & { canShare?: (d: object) => boolean };
  if (!nav.share) return false;
  if (data.files && !(nav.canShare?.({ files: data.files }) ?? false)) delete data.files;
  try {
    await nav.share(data);
    return true;
  } catch {
    return false;
  }
}

const GLYPH: Record<string, string> = {
  k: "\u265A",
  q: "\u265B",
  r: "\u265C",
  b: "\u265D",
  n: "\u265E",
  p: "\u265F",
};

type Frame = {
  fen: string;
  light: string;
  dark: string;
  orientation?: "white" | "black";
  title: string;
  subtitle?: string;
  /** Squares to highlight, e.g. the last move ["e2", "e4"]. */
  highlight?: string[];
};

/** Draws a branded board frame onto a canvas of width W (height = W * 10/9). */
function drawFrame(ctx: CanvasRenderingContext2D, W: number, f: Frame) {
  const scale = W / 1080;
  const board = 960 * scale;
  const pad = (W - board) / 2;
  const top = 150 * scale;
  const H = top + board + 90 * scale;
  const sq = board / 8;

  ctx.fillStyle = "#0f0f11";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f5a623";
  ctx.font = `bold ${44 * scale}px 'Playfair Display', Georgia, serif`;
  ctx.fillText("Hamduk Chess", pad, 70 * scale);
  ctx.fillStyle = "#f0ede8";
  ctx.font = `600 ${34 * scale}px 'DM Sans', system-ui, sans-serif`;
  ctx.fillText(f.title, pad, 118 * scale, board);

  const chess = new Chess(f.fen);
  const grid = chess.board();
  const flip = f.orientation === "black";
  const lit = new Set(f.highlight ?? []);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const x = pad + c * sq;
      const y = top + r * sq;
      const file = flip ? 7 - c : c;
      const rank = flip ? r : 7 - r;
      ctx.fillStyle = (r + c) % 2 === 0 ? f.light : f.dark;
      ctx.fillRect(x, y, sq, sq);
      if (lit.has("abcdefgh"[file] + (rank + 1))) {
        ctx.fillStyle = "rgba(245, 166, 35, 0.45)";
        ctx.fillRect(x, y, sq, sq);
      }
      const piece = grid[7 - rank][file];
      if (!piece) continue;
      ctx.font = `${sq * 0.82}px 'Noto Sans Symbols 2', 'Segoe UI Symbol', 'DejaVu Sans', serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(1.5, 3 * scale);
      ctx.strokeStyle = piece.color === "w" ? "#1a1a1a" : "#f0ede8";
      ctx.fillStyle = piece.color === "w" ? "#fafaf8" : "#111";
      ctx.strokeText(GLYPH[piece.type], x + sq / 2, y + sq / 2 + sq * 0.04);
      ctx.fillText(GLYPH[piece.type], x + sq / 2, y + sq / 2 + sq * 0.04);
    }
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#a8a29e";
  ctx.font = `${28 * scale}px 'DM Sans', system-ui, sans-serif`;
  ctx.fillText(f.subtitle ?? "play.chess.hamduk.com.ng", pad, top + board + 58 * scale);
  return H;
}

function canvasFor(W: number) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.round((W * 1200) / 1080);
  return canvas;
}

/** A branded PNG of one position (1080×1200 — good for WhatsApp status and X). */
export async function positionImage(f: Frame): Promise<Blob> {
  const canvas = canvasFor(1080);
  drawFrame(canvas.getContext("2d")!, 1080, f);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not create image"))),
      "image/png",
    ),
  );
}

/**
 * Animated GIF of a game, made in the browser (no server). Uses at most 20 frames:
 * the whole game if it is short, otherwise the key moments (captures, checks,
 * promotions and the final moves). 480px wide keeps it small for WhatsApp.
 */
export async function gameGif(
  opts: Omit<Frame, "fen" | "highlight"> & { pgn: string },
): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const game = new Chess();
  game.loadPgn(opts.pgn);
  const history = game.history({ verbose: true });
  const replay = new Chess(history[0]?.before ?? game.fen());

  const frames: { fen: string; highlight?: string[] }[] = [{ fen: replay.fen() }];
  const MAX = 20;
  const key = new Set<number>();
  history.forEach((m, i) => {
    if (m.captured || m.promotion || m.san.includes("+") || m.san.includes("#")) key.add(i);
  });
  for (let i = Math.max(0, history.length - 4); i < history.length; i++) key.add(i);
  let picked =
    history.length <= MAX - 1 ? history.map((_, i) => i) : [...key].sort((a, b) => a - b);
  if (picked.length > MAX - 1) {
    const step = picked.length / (MAX - 1);
    picked = Array.from({ length: MAX - 1 }, (_, i) => picked[Math.floor(i * step)]);
    picked[picked.length - 1] = history.length - 1;
  }
  const wanted = new Set(picked);
  history.forEach((m, i) => {
    replay.move(m.san);
    if (wanted.has(i)) frames.push({ fen: replay.fen(), highlight: [m.from, m.to] });
  });

  const W = 480;
  const canvas = canvasFor(W);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const gif = GIFEncoder();
  frames.forEach((fr, i) => {
    drawFrame(ctx, W, { ...opts, fen: fr.fen, highlight: fr.highlight });
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const palette = quantize(data, 128);
    const last = i === frames.length - 1;
    gif.writeFrame(applyPalette(data, palette), canvas.width, canvas.height, {
      palette,
      delay: i === 0 ? 900 : last ? 3000 : 700,
      repeat: 0,
    });
  });
  gif.finish();
  return new Blob([new Uint8Array(gif.bytes())], { type: "image/gif" });
}
