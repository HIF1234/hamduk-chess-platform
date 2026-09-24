import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Bell,
  CheckCheck,
  Loader2,
  Mail,
  Swords,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Hamduk Chess" }] }),
  component: NotificationsPage,
});

type Row = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

const ICONS: Record<string, typeof Bell> = {
  achievement: Award,
  correspondence_move: Swords,
  new_follower: UserPlus,
  friend_request: UserPlus,
  friend_accepted: Users,
  message: Mail,
  club_approved: Users,
  tournament_starting: Swords,
};

function NotificationsPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const list = useQuery({
    queryKey: ["notifications", "list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, title, body, link, read, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["notifications"] });

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    refresh();
  }

  async function open(n: Row) {
    if (!n.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
      refresh();
    }
    if (n.link) navigate({ to: n.link });
  }

  async function remove(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    refresh();
  }

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-muted-foreground">Sign in to see your notifications.</p>
        <Link to="/login" className="mt-4 inline-block text-primary underline">
          Sign in
        </Link>
      </div>
    );
  }

  const rows = list.data ?? [];
  const unread = rows.filter((r) => !r.read).length;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl font-bold tracking-tight">Notifications</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {unread ? `${unread} unread` : "You're all caught up."}
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={() => void markAllRead()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              <CheckCheck className="h-4 w-4" /> Mark all read
            </button>
          )}
        </header>

        {list.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {!list.isLoading && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            <Bell className="mx-auto mb-2 h-6 w-6" />
            Nothing yet. Play a game, follow players, or join a club.
          </div>
        )}

        <ul className="space-y-2">
          {rows.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <li
                key={n.id}
                className={`group flex items-start gap-3 rounded-xl border p-4 transition ${
                  n.read ? "border-border bg-card" : "border-primary/40 bg-primary/5"
                }`}
              >
                <span
                  className={`mt-0.5 rounded-full p-2 ${
                    n.type === "achievement" ? "bg-gold/20 text-gold" : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <button onClick={() => void open(n)} className="min-w-0 flex-1 text-left">
                  <p className={`text-sm ${n.read ? "" : "font-semibold"}`}>{n.title}</p>
                  {n.body && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                </button>
                <button
                  onClick={() => void remove(n.id)}
                  aria-label="Delete notification"
                  className="rounded p-1 text-muted-foreground opacity-60 hover:bg-accent hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d} d ago` : new Date(iso).toLocaleDateString();
}
