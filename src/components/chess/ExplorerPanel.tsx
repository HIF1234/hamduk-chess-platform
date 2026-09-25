import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Crown, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getExplorer, type ExplorerMove } from "@/lib/explorer.functions";

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

/** Moves played from the current position, with results. Opening phase only. */
export function ExplorerPanel({ fen, onPlay }: { fen: string; onPlay: (uci: string) => void }) {
  const { user } = useAuth();
  const fetchExplorer = useServerFn(getExplorer);
  const [source, setSource] = useState<"hamduk" | "masters">("hamduk");
  const fullmove = Number(fen.split(" ")[5] ?? 1);
  const inOpening = fullmove <= 15;
  const q = useQuery({
    queryKey: ["explorer", source, fen],
    enabled: !!user && inOpening,
    staleTime: 5 * 60_000,
    queryFn: () => fetchExplorer({ data: { fen, source } }),
  });
  if (!inOpening) return null;
  const r = q.data;
  const tab = (on: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-medium ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="h-4 w-4 text-primary" /> Opening explorer
        </p>
        {r?.mastersAvailable && (
          <div className="flex gap-0.5 rounded-lg border border-border p-0.5">
            <button className={tab(source === "hamduk")} onClick={() => setSource("hamduk")}>
              Hamduk
            </button>
            <button className={tab(source === "masters")} onClick={() => setSource("masters")}>
              Masters
            </button>
          </div>
        )}
      </div>

      {!user ? (
        <p className="text-sm text-muted-foreground">
          <Link to="/login" className="text-primary underline">
            Sign in
          </Link>{" "}
          to see what other players choose here.
        </p>
      ) : q.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : q.error ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : source === "masters" && !r?.gold ? (
        <GoldNote text="The masters database is part of" />
      ) : !r?.moves.length ? (
        <p className="text-sm text-muted-foreground">
          {source === "hamduk"
            ? "No Hamduk games have reached this position yet."
            : "No master games from this position."}
        </p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="pb-1 font-medium">Move</th>
                <th className="pb-1 text-right font-medium">Games</th>
                <th className="w-1/2 pb-1 pl-3 font-medium">White / draw / Black</th>
              </tr>
            </thead>
            <tbody>
              {r.moves.map((m) => (
                <MoveRow key={m.uci} m={m} total={r.total} onPlay={onPlay} />
              ))}
            </tbody>
          </table>
          {!r.gold && (
            <GoldNote text="You're seeing the top 3 moves. Every move and the masters database come with" />
          )}
        </>
      )}
    </div>
  );
}

function MoveRow({
  m,
  total,
  onPlay,
}: {
  m: ExplorerMove;
  total: number;
  onPlay: (uci: string) => void;
}) {
  const n = m.white + m.draws + m.black;
  const [w, d] = [pct(m.white, n), pct(m.draws, n)];
  const b = 100 - w - d;
  return (
    <tr
      onClick={() => onPlay(m.uci)}
      className="cursor-pointer border-t border-border hover:bg-accent/50"
      title={m.averageRating ? `Average rating ${m.averageRating}` : undefined}
    >
      <td className="py-1.5 font-mono font-semibold">{m.san}</td>
      <td className="py-1.5 text-right tabular-nums text-muted-foreground">
        {n.toLocaleString()} <span className="text-[11px]">({pct(n, total)}%)</span>
      </td>
      <td className="py-1.5 pl-3">
        <div className="flex h-4 overflow-hidden rounded text-[10px] font-medium leading-4">
          {/* Fixed colours: these stand for the white and black pieces in both themes. */}
          <span style={{ width: `${w}%` }} className="bg-zinc-100 text-center text-zinc-900">
            {w >= 15 ? `${w}%` : ""}
          </span>
          <span style={{ width: `${d}%` }} className="bg-zinc-400 text-center text-zinc-900">
            {d >= 15 ? `${d}%` : ""}
          </span>
          <span style={{ width: `${b}%` }} className="bg-zinc-800 text-center text-zinc-100">
            {b >= 15 ? `${b}%` : ""}
          </span>
        </div>
      </td>
    </tr>
  );
}

function GoldNote({ text }: { text: string }) {
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      <Crown className="mr-1 inline h-3.5 w-3.5 text-gold" />
      {text}{" "}
      <Link to="/billing" className="text-primary underline">
        Hamduk Gold
      </Link>
      .
    </p>
  );
}
