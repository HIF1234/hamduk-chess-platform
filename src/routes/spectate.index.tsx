import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2, Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/spectate/")({
  head: () => ({
    meta: [
      { title: "Watch Live Chess Games — Hamduk Chess" },
      { name: "description", content: "Follow live rated games with engine evaluation and spectator chat." },
      { property: "og:title", content: "Watch Live Chess Games — Hamduk Chess" },
      { property: "og:description", content: "Follow live rated games with engine evaluation and spectator chat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SpectateIndex,
});

function SpectateIndex() {
  const liveQuery = useQuery({
    queryKey: ["spectate", "live"],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data: games, error } = await supabase
        .from("games")
        .select("id, white_id, black_id, time_control, variant, ply, spectator_count, rated")
        .eq("status", "active")
        .eq("is_public", true)
        .eq("is_correspondence", false)
        .order("last_move_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const ids = Array.from(new Set((games ?? []).flatMap((g) => [g.white_id, g.black_id])));
      const names: Record<string, { username: string; rating: number }> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, rating")
          .in("id", ids);
        for (const p of profs ?? []) names[p.id] = { username: p.username, rating: p.rating };
      }
      return { games: games ?? [], names };
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <h1 className="font-serif text-4xl font-bold tracking-tight">Watch live</h1>
          <p className="mt-1 text-muted-foreground">
            Public games in progress. Spectators see the board, engine evaluation and a side chat.
          </p>
        </header>

        {liveQuery.isLoading && <Loader2 className="h-6 w-6 animate-spin" />}
        {liveQuery.data?.games.length === 0 && (
          <p className="rounded-xl border border-border bg-card p-6 text-muted-foreground">
            No public games right now. Start one from the lobby.
          </p>
        )}

        <div className="grid gap-3">
          {liveQuery.data?.games.map((g) => {
            const w = liveQuery.data.names[g.white_id];
            const b = liveQuery.data.names[g.black_id];
            return (
              <Link
                key={g.id}
                to="/spectate/$gameId"
                params={{ gameId: g.id }}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition hover:border-primary/60"
              >
                <div>
                  <p className="font-semibold">
                    {w?.username ?? "—"} <span className="text-muted-foreground">({w?.rating ?? "—"})</span>{" "}
                    vs {b?.username ?? "—"} <span className="text-muted-foreground">({b?.rating ?? "—"})</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Swords className="h-3.5 w-3.5" /> {g.time_control} · {g.variant} · move{" "}
                    {Math.floor(g.ply / 2) + 1}
                    {!g.rated && " · casual"}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Eye className="h-4 w-4" /> {g.spectator_count}
                </span>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
