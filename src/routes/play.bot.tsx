import { createFileRoute } from "@tanstack/react-router";
import { ChessApp } from "@/components/chess/ChessApp";

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
  component: ChessApp,
});
