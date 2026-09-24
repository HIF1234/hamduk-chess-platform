import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ShareLinks } from "@/components/ShareLinks";

export const Route = createFileRoute("/news/$slug")({
  head: () => ({ meta: [{ title: "Hamduk Chess News" }] }),
  component: ArticlePage,
});

function ArticlePage() {
  const { slug } = Route.useParams();
  useEffect(() => {
    void supabase.rpc("article_bump_views", { p_slug: slug });
  }, [slug]);
  const q = useQuery({
    queryKey: ["articles", "one", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("articles")
        .select(
          "title, type, excerpt, body, cover_url, published_at, tags, views, profiles!articles_author_id_fkey(username)",
        )
        .eq("slug", slug)
        .maybeSingle();
      return data as
        | (Omit<NonNullable<typeof data>, "profiles"> & { profiles: { username: string } | null })
        | null;
    },
  });

  if (q.isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  const a = q.data;
  if (!a) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-muted-foreground">This article doesn't exist or isn't published yet.</p>
        <Link to="/news" className="mt-4 inline-block text-primary underline">
          All news
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link
          to="/news"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> News & Articles
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gold">{a.type}</p>
        <h1 className="mt-1 font-serif text-4xl font-bold leading-tight tracking-tight">
          {a.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {a.profiles?.username ? `By ${a.profiles.username} · ` : ""}
          {a.published_at &&
            new Date(a.published_at).toLocaleDateString(undefined, { dateStyle: "long" })}
        </p>
        {a.cover_url && (
          <img src={a.cover_url} alt="" className="mt-6 w-full rounded-xl object-cover" />
        )}
        <div className="prose prose-lg mt-8 max-w-none dark:prose-invert prose-headings:font-serif prose-a:text-primary">
          <ReactMarkdown>{a.body}</ReactMarkdown>
        </div>
        {a.tags.length > 0 && (
          <p className="mt-8 flex flex-wrap gap-2">
            {a.tags.map((t) => (
              <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                #{t}
              </span>
            ))}
          </p>
        )}
        <div className="mt-8 border-t border-border pt-6">
          <ShareLinks text={a.title} path={`/news/${slug}`} />
        </div>
      </article>
    </div>
  );
}
