import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Lock, MessageSquare, Pin, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { categoryById } from "@/lib/forums";
import { createThread } from "@/lib/forums.functions";
import { timeAgo } from "@/components/forums/time";

export const Route = createFileRoute("/forums/$category")({
  head: () => ({ meta: [{ title: "Forums — Hamduk Chess" }] }),
  component: CategoryPage,
});

function CategoryPage() {
  const { category } = Route.useParams();
  const cat = categoryById(category);
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const create = useServerFn(createThread);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["forums", "category", category],
    queryFn: async () => {
      const { data } = await supabase
        .from("forum_threads")
        .select(
          "id, title, pinned, locked, views, reply_count, last_reply_at, created_at, profiles!forum_threads_author_id_fkey(username)",
        )
        .eq("category", category)
        .order("pinned", { ascending: false })
        .order("last_reply_at", { ascending: false })
        .limit(100);
      return (data ?? []) as unknown as {
        id: string;
        title: string;
        pinned: boolean;
        locked: boolean;
        views: number;
        reply_count: number;
        last_reply_at: string;
        profiles: { username: string } | null;
      }[];
    },
  });

  if (!cat) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-muted-foreground">This forum doesn't exist.</p>
        <Link to="/forums" className="mt-4 inline-block text-primary underline">
          All forums
        </Link>
      </div>
    );
  }

  async function submit() {
    setBusy(true);
    try {
      const { id } = await create({
        data: { category: cat!.id, title: title.trim(), body: body.trim() },
      });
      navigate({ to: "/forums/thread/$threadId", params: { threadId: id } });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link
          to="/forums"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All forums
        </Link>
        <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">{cat.name}</h1>
            <p className="text-muted-foreground">{cat.blurb}</p>
          </div>
          {user && !isGuest ? (
            <button
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> New thread
            </button>
          ) : (
            <Link to="/login" className="text-sm text-primary underline">
              Create an account to post
            </Link>
          )}
        </header>

        {open && (
          <section className="mt-6 space-y-3 rounded-xl border border-border bg-card p-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder="Title"
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-medium"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={5000}
              placeholder="What do you want to talk about? You can paste a PGN or FEN."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={() => void submit()}
              disabled={busy || title.trim().length < 4 || !body.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Post thread
            </button>
          </section>
        )}

        <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
          {q.isLoading && <Loader2 className="m-4 h-5 w-5 animate-spin" />}
          {!q.isLoading && !q.data?.length && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No threads yet — start the first one.
            </p>
          )}
          {q.data?.map((t) => (
            <Link
              key={t.id}
              to="/forums/thread/$threadId"
              params={{ threadId: t.id }}
              className="flex items-center justify-between gap-4 p-4 hover:bg-accent/40"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-medium">
                  {t.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-gold" />}
                  {t.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  <span className="truncate">{t.title}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  by {t.profiles?.username ?? "player"} · {t.views} views
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <p className="flex items-center justify-end gap-1">
                  <MessageSquare className="h-3.5 w-3.5" /> {t.reply_count}
                </p>
                <p>{timeAgo(t.last_reply_at)}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
