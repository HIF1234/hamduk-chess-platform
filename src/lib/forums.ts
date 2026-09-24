// Client-safe forum configuration.
export const FORUM_CATEGORIES = [
  { id: "general", name: "General Chess", blurb: "Anything chess — games, players, news." },
  {
    id: "naija",
    name: "Naija Chess Scene",
    blurb: "Clubs, tournaments and players across Nigeria and Africa.",
  },
  { id: "openings", name: "Openings", blurb: "Repertoires, traps and opening theory." },
  {
    id: "tactics",
    name: "Tactics & Puzzles",
    blurb: "Share puzzles, combinations and brilliant moves.",
  },
  {
    id: "improvement",
    name: "Improvement & Coaching",
    blurb: "Study plans, coaching and getting better.",
  },
  {
    id: "events",
    name: "Tournaments & Events",
    blurb: "Announce and discuss events, online and over the board.",
  },
  { id: "game-analysis", name: "Game Analysis", blurb: "Post a game and ask for feedback." },
  {
    id: "feedback",
    name: "Hamduk Feedback",
    blurb: "Ideas, bugs and questions about Hamduk Chess.",
  },
] as const;

export type ForumCategoryId = (typeof FORUM_CATEGORIES)[number]["id"];

export function categoryById(id: string) {
  return FORUM_CATEGORIES.find((c) => c.id === id);
}
