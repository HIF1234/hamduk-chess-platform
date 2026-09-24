import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  canWriteArticles,
  deleteArticle,
  getArticleForEdit,
  listArticlesForEditor,
  saveArticle,
} from "@/lib/articles.functions";

export const Route = createFileRoute("/news/write")({
  validateSearch: (s: Record<string, unknown>): { id?: string } => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  head: () => ({ meta: [{ title: "Write — Hamduk Chess News" }] }),
  component: WritePage,
});

type Draft = {
  id?: string;
  type: "news" | "article" | "event";
  title: string;
  excerpt: string;
  body: string;
  coverUrl: string;
  tags: string;
  published: boolean;
};

const EMPTY: Draft = {
  type: "news",
  title: "",
  excerpt: "",
  body: "",
  coverUrl: "",
  tags: "",
  published: false,
};

function WritePage() {
  const { id } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const check = useServerFn(canWriteArticles);
  const list = useServerFn(listArticlesForEditor);
  const load = useServerFn(getArticleForEdit);
  const save = useServerFn(saveArticle);
  const del = useServerFn(deleteArticle);
  const [d, setD] = useState<Draft>(EMPTY);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  const role = useQuery({
    queryKey: ["articles", "editor", user?.id],
    enabled: !!user,
    queryFn: () => check(),
  });
  const mine = useQuery({
    queryKey: ["articles", "mine"],
    enabled: !!role.data?.ok,
    queryFn: () => list(),
  });

  useEffect(() => {
    if (!id || !role.data?.ok) {
      setD(EMPTY);
      return;
    }
    void load({ data: { id } })
      .then((a) =>
        setD({
          id: a.id,
          type: a.type as Draft["type"],
          title: a.title,
          excerpt: a.excerpt ?? "",
          body: a.body,
          coverUrl: a.cover_url ?? "",
          tags: a.tags.join(", "),
          published: !!a.published_at,
        }),
      )
      .catch((e) => toast.error((e as Error).message));
  }, [id, role.data?.ok, load]);

  if (!user || role.isLoading)
    return (
      <div className="p-10">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  if (!role.data?.ok)
    return <p className="p-10 text-muted-foreground">Only editors can write articles.</p>;

  async function submit(publish: boolean) {
    setBusy(true);
    try {
      const res = await save({
        data: {
          id: d.id,
          type: d.type,
          title: d.title,
          excerpt: d.excerpt || undefined,
          body: d.body,
          coverUrl: d.coverUrl,
          tags: d.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          publish,
        },
      });
      toast.success(publish ? "Published" : "Draft saved");
      void mine.refetch();
      if (publish) navigate({ to: "/news/$slug", params: { slug: res.slug } });
      else navigate({ to: "/news/write", search: { id: res.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_260px]">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={d.type}
              onChange={(e) => setD({ ...d, type: e.target.value as Draft["type"] })}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="news">News</option>
              <option value="article">Article</option>
              <option value="event">Event</option>
            </select>
            <button
              onClick={() => setPreview((p) => !p)}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              {preview ? "Edit" : "Preview"}
            </button>
            {d.published && <span className="text-xs font-semibold text-primary">Published</span>}
          </div>
          <input
            value={d.title}
            onChange={(e) => setD({ ...d, title: e.target.value })}
            placeholder="Title"
            maxLength={160}
            className={`${field} font-serif text-2xl font-bold`}
          />
          <input
            value={d.excerpt}
            onChange={(e) => setD({ ...d, excerpt: e.target.value })}
            placeholder="Short summary (shown on cards)"
            maxLength={300}
            className={field}
          />
          <input
            value={d.coverUrl}
            onChange={(e) => setD({ ...d, coverUrl: e.target.value })}
            placeholder="Cover image URL (optional)"
            className={field}
          />
          {preview ? (
            <div className="prose max-w-none rounded-md border border-border p-4 dark:prose-invert">
              <ReactMarkdown>{d.body || "_Nothing yet_"}</ReactMarkdown>
            </div>
          ) : (
            <textarea
              value={d.body}
              onChange={(e) => setD({ ...d, body: e.target.value })}
              rows={20}
              placeholder="Write in Markdown: ## headings, **bold**, [links](https://…), - lists"
              className={`${field} font-mono`}
            />
          )}
          <input
            value={d.tags}
            onChange={(e) => setD({ ...d, tags: e.target.value })}
            placeholder="Tags, comma separated (e.g. lagos, tournament)"
            className={field}
          />
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy || d.title.trim().length < 4}
              onClick={() => void submit(false)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-40"
            >
              {d.published ? "Unpublish & save" : "Save draft"}
            </button>
            <button
              disabled={busy || d.title.trim().length < 4 || !d.body.trim()}
              onClick={() => void submit(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{" "}
              {d.published ? "Update" : "Publish"}
            </button>
            {d.id && (
              <button
                onClick={async () => {
                  await del({ data: { id: d.id! } });
                  toast.success("Deleted");
                  navigate({ to: "/news/write", search: {} });
                  void mine.refetch();
                }}
                className="ml-auto rounded-md border border-destructive/50 px-4 py-2 text-sm text-destructive hover:bg-destructive/5"
              >
                Delete
              </button>
            )}
          </div>
        </section>
        <aside>
          <Link
            to="/news/write"
            search={{}}
            className="mb-3 block rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground"
          >
            New article
          </Link>
          <ul className="space-y-1 text-sm">
            {mine.data?.map((a) => (
              <li key={a.id}>
                <Link
                  to="/news/write"
                  search={{ id: a.id }}
                  className={`block rounded px-2 py-1.5 hover:bg-accent ${a.id === id ? "bg-accent" : ""}`}
                >
                  <span className="line-clamp-1">{a.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.published_at ? "Published" : "Draft"} · {a.type}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
}
