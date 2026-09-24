import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, EmptyState, PageHeader, Pill, when } from "@/components/admin/AdminUi";
import {
  listClubsAdmin,
  listCommentators,
  listForumThreadsAdmin,
  moderateThreadAdmin,
  setCommentatorAdmin,
  updateClubAdmin,
} from "@/lib/admin-extra.functions";
import { categoryById } from "@/lib/forums";

export const Route = createFileRoute("/admin/community")({
  head: () => ({
    meta: [
      { title: "Community | Hamduk Chess staff" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Community,
  errorComponent: ({ error }) => (
    <div className="p-4 text-sm text-destructive">{error.message}</div>
  ),
});

function Community() {
  const [tab, setTab] = useState<"forums" | "clubs" | "tv">("forums");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Community"
        subtitle="Forums, clubs, HamdukChess TV and news."
        action={
          <Link
            to="/news/write"
            search={{}}
            className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
          >
            Open news editor
          </Link>
        }
      />
      <div className="inline-flex overflow-hidden rounded-lg border border-border text-sm">
        {(["forums", "clubs", "tv"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 capitalize ${tab === t ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
          >
            {t === "tv" ? "TV commentators" : t}
          </button>
        ))}
      </div>
      {tab === "forums" && <Forums />}
      {tab === "clubs" && <Clubs />}
      {tab === "tv" && <Commentators />}
    </div>
  );
}

function Forums() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-forums"], queryFn: () => listForumThreadsAdmin() });
  const act = useMutation({
    mutationFn: (v: {
      threadId: string;
      action: "pin" | "unpin" | "lock" | "unlock" | "delete" | "restore";
    }) => moderateThreadAdmin({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-forums"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  if (!q.data) return <EmptyState>Loading…</EmptyState>;
  if (!q.data.length)
    return (
      <Card>
        <EmptyState>No forum threads yet.</EmptyState>
      </Card>
    );
  return (
    <div className="space-y-2">
      {q.data.map((t) => (
        <Card key={t.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <Link
                to="/forums/thread/$threadId"
                params={{ threadId: t.id }}
                className="font-medium hover:underline"
              >
                {t.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {categoryById(t.category)?.name ?? t.category} · by {t.profiles?.username ?? "—"} ·{" "}
                {t.reply_count} replies · {t.views} views · {when(t.last_reply_at)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {t.deleted_at && <Pill tone="bad">deleted</Pill>}
              {t.pinned && <Pill tone="good">pinned</Pill>}
              {t.locked && <Pill tone="warn">locked</Pill>}
              <Btn
                onClick={() => act.mutate({ threadId: t.id, action: t.pinned ? "unpin" : "pin" })}
              >
                {t.pinned ? "Unpin" : "Pin"}
              </Btn>
              <Btn
                onClick={() => act.mutate({ threadId: t.id, action: t.locked ? "unlock" : "lock" })}
              >
                {t.locked ? "Unlock" : "Lock"}
              </Btn>
              <Btn
                danger={!t.deleted_at}
                onClick={() =>
                  act.mutate({ threadId: t.id, action: t.deleted_at ? "restore" : "delete" })
                }
              >
                {t.deleted_at ? "Restore" : "Delete"}
              </Btn>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Clubs() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-clubs"], queryFn: () => listClubsAdmin() });
  const act = useMutation({
    mutationFn: (v: { clubId: string; action: "official" | "unofficial" | "delete" }) =>
      updateClubAdmin({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-clubs"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  if (!q.data) return <EmptyState>Loading…</EmptyState>;
  return (
    <div className="space-y-2">
      {q.data.map((c) => (
        <Card key={c.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Link
                to="/clubs/$slug"
                params={{ slug: c.slug }}
                className="font-medium hover:underline"
              >
                {c.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                owner {c.owner} · {c.member_count} members · {c.visibility} · {c.min_tier}+ ·
                created {when(c.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {c.is_official && <Pill tone="good">official</Pill>}
              <Btn
                onClick={() =>
                  act.mutate({ clubId: c.id, action: c.is_official ? "unofficial" : "official" })
                }
              >
                {c.is_official ? "Remove official" : "Mark official"}
              </Btn>
              {c.slug !== "hamdukchessclub" && (
                <Btn
                  danger
                  onClick={() => {
                    if (confirm(`Delete ${c.name}? This removes its members and posts.`))
                      act.mutate({ clubId: c.id, action: "delete" });
                  }}
                >
                  Delete
                </Btn>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Commentators() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const q = useQuery({ queryKey: ["admin-commentators"], queryFn: () => listCommentators() });
  const set = useMutation({
    mutationFn: (v: { username: string; enabled: boolean }) => setCommentatorAdmin({ data: v }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["admin-commentators"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          set.mutate({ username: name, enabled: true });
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Username"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          disabled={!name.trim()}
          className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40"
        >
          Add commentator
        </button>
      </form>
      {q.data?.length ? (
        <ul className="divide-y divide-border text-sm">
          {q.data.map((c) => (
            <li key={c.user_id} className="flex items-center justify-between py-2">
              <span>
                {c.profiles?.username ?? "—"}{" "}
                <span className="text-xs text-muted-foreground">since {when(c.created_at)}</span>
              </span>
              <Btn
                danger
                onClick={() =>
                  c.profiles && set.mutate({ username: c.profiles.username, enabled: false })
                }
              >
                Remove
              </Btn>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>No commentators yet. Admins can always commentate.</EmptyState>
      )}
    </Card>
  );
}

function Btn({
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
      className={`rounded-lg border px-2.5 py-1 text-xs ${danger ? "border-destructive/50 text-destructive" : "border-border hover:bg-accent"}`}
    >
      {children}
    </button>
  );
}
