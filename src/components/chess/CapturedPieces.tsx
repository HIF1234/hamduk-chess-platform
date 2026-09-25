import type { PieceSymbol, Color } from "chess.js";

const GLYPH_WHITE: Record<PieceSymbol, string> = { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" };
const GLYPH_BLACK: Record<PieceSymbol, string> = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };

export function CapturedStrip({
  color,
  pieces,
  advantage,
}: {
  color: Color;
  pieces: PieceSymbol[];
  advantage: number;
}) {
  const glyphs = color === "w" ? GLYPH_WHITE : GLYPH_BLACK;
  const sorted = [...pieces].sort((a, b) => "pnbrqk".indexOf(a) - "pnbrqk".indexOf(b));
  return (
    <div className="flex items-center gap-2 min-h-6">
      <div className="flex flex-wrap gap-0.5 text-xl leading-none">
        {sorted.length === 0 ? (
          <span className="text-[10px] text-muted-foreground/60 italic">no captures</span>
        ) : (
          sorted.map((p, i) => (
            <span key={i} className={color === "w" ? "text-muted-foreground" : "text-foreground"}>
              {glyphs[p]}
            </span>
          ))
        )}
      </div>
      {advantage > 0 && (
        <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
          +{advantage}
        </span>
      )}
    </div>
  );
}
