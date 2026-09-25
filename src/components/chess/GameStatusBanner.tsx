import type { GameStatus } from "@/hooks/useChessGame";

export function GameStatusBanner({
  status,
  onNewGame,
  you,
  opponentName,
}: {
  status: GameStatus;
  onNewGame: () => void;
  /** Set when playing a bot, so the banner can say who won in plain terms. */
  you?: "w" | "b";
  opponentName?: string;
}) {
  if (status.kind === "active" || status.kind === "check") return null;

  let title = "";
  let subtitle = "";
  if (status.kind === "checkmate") {
    title = "Checkmate";
    subtitle = `${status.winner === "w" ? "White" : "Black"} wins`;
  } else if (status.kind === "stalemate") {
    title = "Stalemate";
    subtitle = "Draw";
  } else if (status.kind === "draw") {
    title = "Draw";
    subtitle = status.reason;
  } else if (status.kind === "resigned") {
    title = "Resignation";
    subtitle = `${status.winner === "w" ? "White" : "Black"} wins`;
  }

  const winner = status.kind === "checkmate" || status.kind === "resigned" ? status.winner : null;
  if (you && winner) {
    title = winner === you ? "You win!" : `${opponentName ?? "The bot"} wins`;
    subtitle = status.kind === "checkmate" ? "Checkmate" : "Resignation";
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-sm">
      <div className="bg-card rounded-lg ring-1 ring-border px-8 py-6 text-center shadow-xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-2">
          {subtitle}
        </p>
        <h3 className="text-3xl font-semibold mb-4">{title}</h3>
        <button
          onClick={onNewGame}
          className="px-5 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          New Game
        </button>
      </div>
    </div>
  );
}
