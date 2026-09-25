import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, Database, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { lookupTablebase, type TablebaseResult } from "@/lib/tablebase.functions";

const pieceCount = (fen: string) => fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length;

function verdict(r: TablebaseResult, whiteToMove: boolean) {
  if (r.checkmate) return "Checkmate";
  if (r.stalemate) return "Stalemate";
  const side = whiteToMove ? "White" : "Black";
  const other = whiteToMove ? "Black" : "White";
  const mate = r.dtm ? ` · mate in ${Math.ceil(Math.abs(r.dtm) / 2)}` : "";
  switch (r.category) {
    case "win":
      return `${side} wins${mate}`;
    case "loss":
      return `${other} wins${mate}`;
    case "draw":
      return "Draw with best play";
    case "cursed-win":
      return `${side} wins, but it's a draw under the 50-move rule`;
    case "blessed-loss":
      return `${other} wins, but ${side} is saved by the 50-move rule`;
    default:
      return "Unknown";
  }
}

const tone = (c: string) =>
  c === "win" ? "text-primary" : c === "loss" ? "text-destructive" : "text-muted-foreground";

/** Perfect-play result for ≤7-piece positions (Syzygy via Lichess). Gold feature. */
export function TablebasePanel({ fen }: { fen: string }) {
  const { user } = useAuth();
  const fetchTb = useServerFn(lookupTablebase);
  const eligible = pieceCount(fen) <= 7;
  const q = useQuery({
    queryKey: ["tablebase", fen],
    enabled: eligible && !!user,
    staleTime: Infinity,
    queryFn: () => fetchTb({ data: { fen } }),
  });
  if (!eligible) return null;
  const whiteToMove = fen.split(" ")[1] === "w";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Database className="h-4 w-4 text-gold" /> Endgame tablebase
      </p>
      {!user || q.data?.error === "gold" ? (
        <p className="text-sm text-muted-foreground">
          <Crown className="mr-1 inline h-3.5 w-3.5 text-gold" />
          Perfect play for every position with 7 pieces or fewer is a{" "}
          <Link to="/billing" className="text-primary underline">
            Hamduk Gold
          </Link>{" "}
          feature.
        </p>
      ) : q.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : q.data?.error ? (
        <p className="text-sm text-muted-foreground">{q.data.error}</p>
      ) : q.data?.result ? (
        <>
          <p className={`font-semibold ${tone(q.data.result.category)}`}>
            {verdict(q.data.result, whiteToMove)}
          </p>
          {q.data.result.moves.length > 0 && (
            <ul className="mt-2 space-y-0.5 font-mono text-sm">
              {q.data.result.moves.map((m) => (
                <li key={m.uci} className="flex justify-between">
                  <span>{m.san}</span>
                  <span className={`text-xs ${tone(m.category)}`}>
                    {m.category === "win" || m.category === "loss"
                      ? `${m.category === "win" ? "wins" : "loses"}${m.dtm ? ` · M${Math.ceil(Math.abs(m.dtm) / 2)}` : ""}`
                      : m.category.replace("-", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
