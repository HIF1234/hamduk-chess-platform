import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Heart, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  addGameComment,
  deleteGameComment,
  toggleCommentLike,
} from "@/lib/game-comments.functions";
import { ReportButton } from "@/components/ReportButton";
import { timeAgo } from "@/components/forums/time";

type Comment = {
  id: string;
  content: string;
  ply: number | null;
  likes: number;
  created_at: string;
  user_id: string;
  profiles: { username: string } | null;
};

const moveLabel = (ply: number, sans: string[]) =>
  `${Math.ceil(ply / 2)}${ply % 2 === 1 ? "." : "..."} ${sans[ply - 1] ?? ""}`;

/** Comments on a finished game; each can point at a specific move. */
export function GameComments({ gameId, sans }: { gameId: string; sans: string[] }) {
  const { user, isGuest } = useAuth();
  const qc = useQueryClient();
  const add = useServerFn(addGameComment);
  const like = useServerFn(toggleCommentLike);
  const remove = useServerFn(deleteGameComment);
  const [text, setText] = useState("");
  const [ply, setPly] = useState<number | "">("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["game-comments", gameId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("game_comments")
        .select(
          "id, content, ply, likes, created_at, user_id, profiles!game_comments_user_id_fkey(username)",
        )
        .eq("game_id", gameId)
        .order("created_at", { ascending: true })
        .limit(200);
      const rows = (data ?? []) as unknown as Comment[];
      let mine = new Set<string>();
      if (user && rows.length) {
        const { data: likes } = await supabase
          .from("game_comment_likes")
          .select("comment_id")
          .in(
            "comment_id",
            rows.map((r) => r.id),
          );
        mine = new Set((likes ?? []).map((l) => l.comment_id));
      }
      return { rows, mine };
    },
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["game-comments", gameId] });

  async function submit() {
    setBusy(true);
    try {
      await add({ data: { gameId, content: text.trim(), ply: ply === "" ? undefined : ply } });
      setText("");
      setPly("");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const rows = q.data?.rows ?? [];
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <MessageSquare className="h-4 w-4 text-primary" /> Comments{" "}
        {rows.length ? `(${rows.length})` : ""}
      </h2>
      {q.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {!q.isLoading && !rows.length && (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}
      <ul className="space-y-3">
        {rows.map((c) => {
          const liked = q.data?.mine.has(c.id);
          return (
            <li key={c.id} className="text-sm">
              <p className="text-xs text-muted-foreground">
                {c.profiles ? (
                  <Link
                    to="/profile/$username"
                    params={{ username: c.profiles.username }}
                    className="font-semibold text-foreground hover:underline"
                  >
                    {c.profiles.username}
                  </Link>
                ) : (
                  "player"
                )}
                {c.ply ? (
                  <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] text-primary">
                    {moveLabel(c.ply, sans)}
                  </span>
                ) : null}
                {" · "}
                {timeAgo(c.created_at)}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
              <div className="mt-1 flex items-center gap-3 text-xs">
                <button
                  disabled={!user || isGuest}
                  onClick={async () => {
                    await like({ data: { commentId: c.id } }).catch((e) =>
                      toast.error((e as Error).message),
                    );
                    refresh();
                  }}
                  className={`inline-flex items-center gap-1 ${liked ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} /> {c.likes}
                </button>
                {c.user_id === user?.id ? (
                  <button
                    onClick={async () => {
                      await remove({ data: { commentId: c.id } }).catch((e) =>
                        toast.error((e as Error).message),
                      );
                      refresh();
                    }}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                ) : (
                  <ReportButton targetType="game_comment" targetId={c.id} />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 border-t border-border pt-3">
        {!user || isGuest ? (
          <p className="text-sm text-muted-foreground">
            <Link to="/login" className="text-primary underline">
              Create a free account
            </Link>{" "}
            to comment.
          </p>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="What did you think of this game?"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {sans.length > 0 && (
                <select
                  value={ply}
                  onChange={(e) => setPly(e.target.value ? Number(e.target.value) : "")}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="">Whole game</option>
                  {sans.map((_, i) => (
                    <option key={i} value={i + 1}>
                      About {moveLabel(i + 1, sans)}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => void submit()}
                disabled={busy || !text.trim()}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Comment
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
