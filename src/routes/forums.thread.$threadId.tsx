import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Heart, Loader2, Lock, Pin, Reply, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { categoryById } from "@/lib/forums";
import {
  deletePost,
  getForumRole,
  moderateThread,
  replyToThread,
  togglePostLike,
} from "@/lib/forums.functions";
import { ReportButton } from "@/components/ReportButton";
import { timeAgo } from "@/components/forums/time";

export const Route = createFileRoute("/forums/thread/$threadId")({
  head: () => ({ meta: [{ title: "Forum thread — Hamduk Chess" }] }),
  component: ThreadPage,
});

type Post = {
  id: string;
  content: string;
  created_at: string;
  likes: number;
  deleted_at: string | null;
  parent_post_id: string | null;
  author_id: string;
  profiles: { username: string; subscription_tier: string } | null;
};

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const reply = useServerFn(replyToThread);
  const like = useServerFn(togglePostLike);
  const remove = useServerFn(deletePost);
  const moderate = useServerFn(moderateThread);
  const fetchRole = useServerFn(getForumRole);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Post | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.rpc("forum_bump_views", { p_thread: threadId });
  }, [threadId]);

  const role = useQuery({
    queryKey: ["forums", "role", user?.id],
    enabled: !!user,
    queryFn: () => fetchRole(),
  });

  const q = useQuery({
    queryKey: ["forums", "thread", threadId],
    queryFn: async () => {
      const [{ data: thread }, { data: posts }] = await Promise.all([
        supabase
          .from("forum_threads")
          .select("id, title, category, pinned, locked, author_id, created_at")
          .eq("id", threadId)
          .maybeSingle(),
        supabase
          .from("forum_posts")
          .select(
            "id, content, created_at, likes, deleted_at, parent_post_id, author_id, profiles!forum_posts_author_id_fkey(username, subscription_tier)",
          )
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true })
          .limit(500),
      ]);
      let myLikes = new Set<string>();
      if (user && posts?.length) {
        const { data: likes } = await supabase
          .from("forum_post_likes")
          .select("post_id")
          .in(
            "post_id",
            posts.map((p) => p.id),
          );
        myLikes = new Set((likes ?? []).map((l) => l.post_id));
      }
      return { thread, posts: (posts ?? []) as unknown as Post[], myLikes };
    },
  });

  const byId = useMemo(() => new Map((q.data?.posts ?? []).map((p) => [p.id, p])), [q.data]);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["forums", "thread", threadId] });

  if (q.isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  const thread = q.data?.thread;
  if (!thread) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-muted-foreground">This thread doesn't exist or was removed.</p>
        <Link to="/forums" className="mt-4 inline-block text-primary underline">
          All forums
        </Link>
      </div>
    );
  }
  const cat = categoryById(thread.category);
  const isMod = !!role.data?.isMod;
  const canPost = !!role.data?.canPost && (!thread.locked || isMod);

  async function send() {
    setBusy(true);
    try {
      await reply({ data: { threadId, content: text.trim(), parentPostId: replyTo?.id } });
      setText("");
      setReplyTo(null);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function mod(action: "pin" | "unpin" | "lock" | "unlock" | "delete") {
    try {
      await moderate({ data: { threadId, action } });
      if (action === "delete")
        navigate({ to: "/forums/$category", params: { category: thread!.category } });
      else refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link
          to="/forums/$category"
          params={{ category: thread.category }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {cat?.name ?? "Forums"}
        </Link>
        <h1 className="mt-3 flex items-start gap-2 font-serif text-3xl font-bold tracking-tight">
          {thread.pinned && <Pin className="mt-2 h-5 w-5 shrink-0 text-gold" />}
          {thread.locked && <Lock className="mt-2 h-5 w-5 shrink-0 text-muted-foreground" />}
          {thread.title}
        </h1>
        {(isMod || thread.author_id === user?.id) && (
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {isMod && (
              <>
                <ModBtn onClick={() => void mod(thread.pinned ? "unpin" : "pin")}>
                  {thread.pinned ? "Unpin" : "Pin"}
                </ModBtn>
                <ModBtn onClick={() => void mod(thread.locked ? "unlock" : "lock")}>
                  {thread.locked ? "Unlock" : "Lock"}
                </ModBtn>
              </>
            )}
            <ModBtn danger onClick={() => void mod("delete")}>
              Delete thread
            </ModBtn>
          </div>
        )}

        <ol className="mt-6 space-y-3">
          {q.data!.posts.map((p, i) => {
            const parent = p.parent_post_id ? byId.get(p.parent_post_id) : null;
            const liked = q.data!.myLikes.has(p.id);
            return (
              <li
                key={p.id}
                id={`post-${p.id}`}
                className={`rounded-xl border bg-card p-4 ${i === 0 ? "border-primary/40" : "border-border"}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {p.profiles ? (
                      <Link
                        to="/profile/$username"
                        params={{ username: p.profiles.username }}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {p.profiles.username}
                      </Link>
                    ) : (
                      "player"
                    )}
                    {p.profiles?.subscription_tier === "gold" && (
                      <span className="ml-1.5 rounded bg-gold/20 px-1 text-[10px] font-bold uppercase text-gold">
                        Gold
                      </span>
                    )}
                    {" · "}
                    {timeAgo(p.created_at)}
                  </span>
                  <span>#{i + 1}</span>
                </div>
                {parent && !p.deleted_at && (
                  <a
                    href={`#post-${parent.id}`}
                    className="mb-2 block border-l-2 border-primary/40 pl-2 text-xs text-muted-foreground line-clamp-2"
                  >
                    ↪ {parent.profiles?.username ?? "player"}:{" "}
                    {parent.deleted_at ? "[deleted]" : parent.content}
                  </a>
                )}
                <p
                  className={`whitespace-pre-wrap break-words text-sm ${p.deleted_at ? "italic text-muted-foreground" : ""}`}
                >
                  {p.deleted_at ? "[This post was deleted]" : p.content}
                </p>
                {!p.deleted_at && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <button
                      disabled={!role.data?.canPost}
                      onClick={async () => {
                        try {
                          await like({ data: { postId: p.id } });
                          refresh();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                      className={`inline-flex items-center gap-1 ${liked ? "text-destructive" : "text-muted-foreground hover:text-foreground"} disabled:opacity-60`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} /> {p.likes}
                    </button>
                    {canPost && (
                      <button
                        onClick={() => setReplyTo(p)}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Reply className="h-3.5 w-3.5" /> Reply
                      </button>
                    )}
                    {(isMod || p.author_id === user?.id) && i > 0 && (
                      <button
                        onClick={async () => {
                          await remove({ data: { postId: p.id } }).catch((e) =>
                            toast.error((e as Error).message),
                          );
                          refresh();
                        }}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
                    {p.author_id !== user?.id && (
                      <ReportButton targetType="forum_post" targetId={p.id} />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <section className="mt-6 rounded-xl border border-border bg-card p-4">
          {!user ? (
            <p className="text-sm text-muted-foreground">
              <Link to="/login" className="text-primary underline">
                Sign in
              </Link>{" "}
              to reply.
            </p>
          ) : thread.locked && !isMod ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" /> This thread is locked.
            </p>
          ) : !role.data?.canPost ? (
            <p className="text-sm text-muted-foreground">
              Create a free account to join the conversation.
            </p>
          ) : (
            <>
              {replyTo && (
                <p className="mb-2 flex items-center justify-between rounded bg-muted px-2 py-1 text-xs">
                  Replying to {replyTo.profiles?.username ?? "player"}
                  <button onClick={() => setReplyTo(null)} className="underline">
                    cancel
                  </button>
                </p>
              )}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                maxLength={5000}
                placeholder="Write a reply…"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={() => void send()}
                disabled={busy || !text.trim()}
                className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Reply
              </button>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function ModBtn({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 font-medium hover:bg-accent ${danger ? "border-destructive/50 text-destructive" : "border-border"}`}
    >
      {children}
    </button>
  );
}
