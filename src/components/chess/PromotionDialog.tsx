import type { PieceSymbol, Color } from "chess.js";

const GLYPH_WHITE: Record<string, string> = { q: "♕", r: "♖", b: "♗", n: "♘" };
const GLYPH_BLACK: Record<string, string> = { q: "♛", r: "♜", b: "♝", n: "♞" };

export function PromotionDialog({
  color,
  onPick,
  onCancel,
}: {
  color: Color;
  onPick: (p: PieceSymbol) => void;
  onCancel: () => void;
}) {
  const glyphs = color === "w" ? GLYPH_WHITE : GLYPH_BLACK;
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="bg-card rounded-lg ring-1 ring-border p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4 text-center">
          Promote to
        </p>
        <div className="flex gap-2">
          {(["q", "r", "b", "n"] as PieceSymbol[]).map((p) => (
            <button
              key={p}
              onClick={() => onPick(p)}
              className="size-16 text-5xl bg-muted hover:bg-accent rounded ring-1 ring-border flex items-center justify-center transition-colors cursor-pointer"
            >
              {glyphs[p]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
