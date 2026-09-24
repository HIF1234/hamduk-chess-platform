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

const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

/** Draws a branded PNG of a position (1080×1200, good for WhatsApp status and X). */
export async function positionImage(opts: {
  fen: string;
  light: string;
  dark: string;
  orientation?: "white" | "black";
  title: string;
  subtitle?: string;
}): Promise<Blob> {
  const W = 1080;
  const board = 960;
  const pad = (W - board) / 2;
  const top = 150;
  const H = top + board + 90;
  const sq = board / 8;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0f0f11";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#f5a623";
  ctx.font = "bold 44px 'Playfair Display', Georgia, serif";
  ctx.fillText("Hamduk Chess", pad, 70);
  ctx.fillStyle = "#f0ede8";
  ctx.font = "600 34px 'DM Sans', system-ui, sans-serif";
  ctx.fillText(opts.title, pad, 118);

  const chess = new Chess(opts.fen);
  const flip = opts.orientation === "black";
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const x = pad + f * sq;
      const y = top + r * sq;
      ctx.fillStyle = (r + f) % 2 === 0 ? opts.light : opts.dark;
      ctx.fillRect(x, y, sq, sq);
      const file = flip ? 7 - f : f;
      const rank = flip ? r : 7 - r;
      const piece = chess.board()[7 - rank][file];
      if (!piece) continue;
      ctx.font = `${sq * 0.82}px 'Noto Sans Symbols 2', 'Segoe UI Symbol', 'DejaVu Sans', serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3;
      ctx.strokeStyle = piece.color === "w" ? "#1a1a1a" : "#f0ede8";
      ctx.fillStyle = piece.color === "w" ? "#fafaf8" : "#111";
      ctx.strokeText(GLYPH[piece.type], x + sq / 2, y + sq / 2 + sq * 0.04);
      ctx.fillText(GLYPH[piece.type], x + sq / 2, y + sq / 2 + sq * 0.04);
    }
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#a8a29e";
  ctx.font = "28px 'DM Sans', system-ui, sans-serif";
  ctx.fillText(opts.subtitle ?? "play.chess.hamduk.com.ng", pad, top + board + 58);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not create image"))),
      "image/png",
    ),
  );
}
