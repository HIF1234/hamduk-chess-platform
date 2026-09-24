import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Newspaper, PenLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { canWriteArticles } from "@/lib/articles.functions";
import { ArticleCard } from "@/components/ArticleCard";

export const Route = createFileRoute("/news/")({
  head: () => ({
    meta: [
      { title: "News & Articles — Hamduk Chess" },
      {
        name: "description",
        content: "Chess news, articles and events from Nigeria, Africa and the world.",
      },
    ],
  }),
  component: NewsIndex,
});

const TABS = [
  { id: "all", label: "All" },
  { id: "news", label: "News" },
  { id: "article", label: "Articles" },
  { id: "event", label: "Events" },
] as const;

function NewsIndex() {
  const { user } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const checkEditor = useServerFn(canWriteArticles);
  const editor = useQuery({
    queryKey: ["articles", "editor", user?.id],
    enabled: !!user,
    queryFn: () => checkEditor(),
  });
  const q = useQuery({
    queryKey: ["articles", "list", tab],
    queryFn: async () => {
      let query = supabase
        .from("articles")
        .select("id, slug, type, title, excerpt, cover_url, published_at, tags")
        .order("published_at", { ascending: false })
        .limit(40);
      if (tab !== "all") query = query.eq("type", tab);
      const { data } = await query;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="flex items-center gap-2 font-serif text-4xl font-bold tracking-tight">
            <Newspaper className="h-8 w-8 text-primary" /> News & Articles
          </h1>
          {editor.data?.ok && (
            <Link
              to="/news/write"
              search={{}}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <PenLine className="h-4 w-4" /> Write
            </Link>
          )}
        </header>
        <div className="mt-6 inline-flex overflow-hidden rounded-md border border-border text-sm">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 ${tab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {q.isLoading && <Loader2 className="mt-6 h-5 w-5 animate-spin" />}
        {!q.isLoading && !q.data?.length && (
          <p className="mt-8 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Nothing published here yet.
          </p>
        )}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data?.map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
        </div>
      </main>
    </div>
  );
}
