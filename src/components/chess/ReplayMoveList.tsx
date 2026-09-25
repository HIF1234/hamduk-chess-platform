import type { Move } from "chess.js";
import { useEffect, useRef } from "react";

type Props = {
  moves: Move[];
  ply: number;
  onSelect: (ply: number) => void;
};

export function ReplayMoveList({ moves, ply, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-ply="${ply}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [ply]);

  const pairs: { num: number; white?: { m: Move; ply: number }; black?: { m: Move; ply: number } }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      num: i / 2 + 1,
      white: { m: moves[i], ply: i + 1 },
      black: moves[i + 1] ? { m: moves[i + 1], ply: i + 2 } : undefined,
    });
  }

  return (
    <div className="bg-card ring-1 ring-border rounded-lg flex flex-col h-[420px]">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-medium">Notation</h2>
        <button
          onClick={() => onSelect(0)}
          className="text-[10px] font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider"
        >
          Start
        </button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
        {pairs.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No moves loaded. Import a PGN to begin.</p>
        ) : (
          <div className="grid grid-cols-[3ch_1fr_1fr] gap-x-4 gap-y-2 text-sm leading-tight">
            {pairs.map((p) => (
              <div key={p.num} className="contents">
                <span className="text-muted-foreground tabular-nums">{p.num}</span>
                <MoveCell move={p.white?.m} cellPly={p.white?.ply} currentPly={ply} onSelect={onSelect} />
                <MoveCell move={p.black?.m} cellPly={p.black?.ply} currentPly={ply} onSelect={onSelect} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MoveCell({
  move,
  cellPly,
  currentPly,
  onSelect,
}: {
  move?: Move;
  cellPly?: number;
  currentPly: number;
  onSelect: (ply: number) => void;
}) {
  if (!move || !cellPly) return <span />;
  const active = cellPly === currentPly;
  return (
    <button
      data-ply={cellPly}
      onClick={() => onSelect(cellPly)}
      className={
        "text-left font-medium px-1 rounded-sm cursor-pointer transition-colors " +
        (active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent")
      }
    >
      {move.san}
    </button>
  );
}
