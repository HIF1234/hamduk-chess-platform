import { createFileRoute } from "@tanstack/react-router";
import { ChessApp } from "@/components/chess/ChessApp";
import { BOT_PERSONAS } from "@/lib/bot-personas";

export const Route = createFileRoute("/play/bot")({
  head: () => ({
    meta: [
      { title: "Play the Nigerian bots — Hamduk Chess" },
      {
        name: "description",
        content:
          "Play 13 Nigerian bot personalities from Army Legend (500) to Naija Legend (3000).",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { bot?: string } => ({
    bot: typeof s.bot === "string" && BOT_PERSONAS.some((b) => b.id === s.bot) ? s.bot : undefined,
  }),
  component: BotPage,
});

function BotPage() {
  const { bot } = Route.useSearch();
  // key: switching bots from a link starts a fresh game.
  return <ChessApp key={bot ?? "default"} initialMode="engine" initialPersonaId={bot} />;
}
