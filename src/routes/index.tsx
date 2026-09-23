import { createFileRoute } from "@tanstack/react-router";
import { ChessApp } from "@/components/chess/ChessApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hamduk Chess — Play, learn and compete" },
      { name: "description", content: "Play chess online, against Nigerian-persona bots or friends, and learn with puzzles, lessons and coaching." },
      { property: "og:title", content: "Hamduk Chess — Play, learn and compete" },
      { property: "og:description", content: "Play chess online, against Nigerian-persona bots or friends, and learn with puzzles, lessons and coaching." },
    ],
  }),
  component: Index,
});

function Index() {
  return <ChessApp />;
}
