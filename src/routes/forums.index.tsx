import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FORUM_CATEGORIES } from "@/lib/forums";
import { timeAgo } from "@/components/forums/time";

export const Route = createFileRoute("/forums/")({
  head: () => ({
    meta: [
      { title: "Forums — Hamduk Chess" },
      { name: "description", content: "Talk chess with players across Nigeria and Africa." },
    ],
  }),
  component: ForumsIndex,
});

function ForumsIndex() {
  const q = useQuery({
    queryKey: ["forums", "overview"],
    queryFn: async () => {
      const { data } = await supabase
        .from("forum_threads")
        .select("id, category, title, last_reply_at, reply_count")
        .order("last_reply_at", { ascending: false })
        .limit(300);
      const byCat = new Map<
        string,
        { count: number; latest?: { id: string; title: string; at: string } }
      >();
      for (const t of data ?? []) {
        const e = byCat.get(t.category) ?? { count: 0 };
        e.count += 1;
        if (!e.latest) e.latest = { id: t.id, title: t.title, at: t.last_reply_at };
        byCat.set(t.category, e);
      }
      return byCat;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="flex items-center gap-2 font-serif text-4xl font-bold tracking-tight">
          <MessagesSquare className="h-8 w-8 text-primary" /> Forums
        </h1>
        <p className="mt-1 text-muted-foreground">
          Talk chess with players across Nigeria and Africa.
        </p>
        <div className="mt-8 space-y-2">
          {FORUM_CATEGORIES.map((c) => {
            const stat = q.data?.get(c.id);
            return (
              <Link
                key={c.id}
                to="/forums/$category"
                params={{ category: c.id }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/60"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.blurb}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>
                    <span className="font-semibold text-foreground">{stat?.count ?? 0}</span>{" "}
                    threads
                  </p>
                  {stat?.latest && (
                    <p className="max-w-56 truncate">
                      {stat.latest.title} · {timeAgo(stat.latest.at)}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
