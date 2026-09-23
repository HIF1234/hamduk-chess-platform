import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  CalendarDays,
  Crown,
  Loader2,
  Lock,
  MessageSquare,
  Pin,
  Shield,
  Swords,
  Trash2,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  appealClubBan,
  decideClubAppeal,
  getClubAnalytics,
  joinClub,
  leaveClub,
  moderateClubMember,
  moderateClubPost,
  postToClub,
} from "@/lib/clubs.functions";
import { createTournament } from "@/lib/tournaments.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/clubs/$slug")({
  head: () => ({
    meta: [
      { title: "Club — Hamduk Chess" },
      { name: "description", content: "Club forum, members, events, games and study boards." },
      { property: "og:title", content: "Club — Hamduk Chess" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ClubPage,
});

type Member = {
  user_id: string;
  role: string;
  status: string;
  muted_until: string | null;
  created_at: string;
  profiles: { username: string; rating: number; subscription_tier: string } | null;
};

function useClub(slug: string) {
  return useQuery({
    queryKey: ["club", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select(
          "id, slug, name, description, visibility, min_tier, is_official, member_count, owner_id",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function ClubPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const clubQuery = useClub(slug);
  const club = clubQuery.data;
  const join = useServerFn(joinClub);
  const leave = useServerFn(leaveClub);
  const [busy, setBusy] = useState(false);

  const membersQuery = useQuery({
    queryKey: ["club", slug, "members"],
    enabled: !!club,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_members")
        .select(
          "user_id, role, status, muted_until, created_at, profiles(username, rating, subscription_tier)",
        )
        .eq("club_id", club!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Member[];
    },
  });

  const banQuery = useQuery({
    queryKey: ["club", slug, "my-ban", user?.id],
    enabled: !!club && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("club_bans")
        .select("reason, appeal_status")
        .eq("club_id", club!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  if (clubQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!club) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-serif text-3xl font-bold">Club not found</h1>
        <p className="mt-2 text-muted-foreground">It may be private or no longer exist.</p>
        <Link to="/clubs" className="mt-6 inline-block text-primary underline">
          Browse clubs
        </Link>
      </div>
    );
  }

  const members = membersQuery.data ?? [];
  const me = members.find((m) => m.user_id === user?.id);
  const isMember = me?.status === "approved";
  const isPending = me?.status === "pending";
  const isOwner = club.owner_id === user?.id;
  const isAdmin = isOwner || (isMember && ["owner", "admin"].includes(me!.role));
  const approved = members.filter((m) => m.status === "approved");
  const memberIds = approved.map((m) => m.user_id);
  const canSeeContent = club.visibility === "public" || isMember;

  const refresh = () => void qc.invalidateQueries({ queryKey: ["club", slug] });

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mb-8 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-gold/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">
                {club.is_official ? "Official club" : "Club"}
              </p>
              <h1 className="flex items-center gap-2 font-serif text-4xl font-bold tracking-tight">
                {club.name}
                {club.is_official && <BadgeCheck className="h-7 w-7 text-primary" />}
                {club.visibility === "private" && (
                  <Lock className="h-5 w-5 text-muted-foreground" />
                )}
              </h1>
              {club.description && (
                <p className="mt-2 max-w-2xl text-muted-foreground">{club.description}</p>
              )}
              <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-4 w-4" /> {club.member_count} member
                {club.member_count === 1 ? "" : "s"}
                {club.min_tier !== "free" && ` · ${club.min_tier} members and above`}
              </p>
            </div>
            {user && !banQuery.data && (
              <div>
                {isMember && !isOwner && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(() => leave({ data: { clubId: club.id } }), "Left club")
                    }
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                  >
                    Leave
                  </button>
                )}
                {isPending && (
                  <span className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground">
                    Request pending
                  </span>
                )}
                {!me && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => join({ data: { clubId: club.id } }),
                        club.visibility === "public" ? "Welcome to the club!" : "Request sent",
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {club.visibility === "public" ? "Join club" : "Request to join"}
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {banQuery.data && <BanNotice clubId={club.id} ban={banQuery.data} onDone={refresh} />}

        {!canSeeContent ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            <Lock className="mx-auto mb-2 h-6 w-6" />
            This is a private club. Members only.
          </div>
        ) : (
          <Tabs defaultValue="forum">
            <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="forum">
                <MessageSquare className="mr-1.5 h-4 w-4" />
                Forum
              </TabsTrigger>
              <TabsTrigger value="members">
                <Users className="mr-1.5 h-4 w-4" />
                Members
              </TabsTrigger>
              <TabsTrigger value="events">
                <CalendarDays className="mr-1.5 h-4 w-4" />
                Events
              </TabsTrigger>
              <TabsTrigger value="games">
                <Swords className="mr-1.5 h-4 w-4" />
                Games
              </TabsTrigger>
              <TabsTrigger value="studies">
                <BookOpen className="mr-1.5 h-4 w-4" />
                Studies
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="manage">
                  <Shield className="mr-1.5 h-4 w-4" />
                  Manage
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="forum">
              <Forum clubId={club.id} slug={slug} canPost={isMember} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="members">
              <MemberList members={approved} />
            </TabsContent>
            <TabsContent value="events">
              <Events clubId={club.id} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="games">
              <GamesFeed slug={slug} memberIds={memberIds} />
            </TabsContent>
            <TabsContent value="studies">
              <Studies slug={slug} memberIds={memberIds} />
            </TabsContent>
            {isAdmin && (
              <TabsContent value="manage">
                <Manage clubId={club.id} slug={slug} members={members} ownerId={club.owner_id} />
              </TabsContent>
            )}
          </Tabs>
        )}
      </main>
    </div>
  );
}

function BanNotice({
  clubId,
  ban,
  onDone,
}: {
  clubId: string;
  ban: { reason: string | null; appeal_status: string };
  onDone: () => void;
}) {
  const appeal = useServerFn(appealClubBan);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-sm">
      <p className="font-semibold text-destructive">You are banned from this club.</p>
      {ban.reason && <p className="mt-1 text-muted-foreground">Reason: {ban.reason}</p>}
      {ban.appeal_status === "pending" && <p className="mt-2">Your appeal is being reviewed.</p>}
      {ban.appeal_status === "rejected" && <p className="mt-2">Your appeal was rejected.</p>}
      {ban.appeal_status === "none" && (
        <div className="mt-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Explain why the ban should be lifted (at least 10 characters)"
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
          <button
            disabled={busy || text.trim().length < 10}
            onClick={async () => {
              setBusy(true);
              try {
                await appeal({ data: { clubId, text: text.trim() } });
                toast.success("Appeal sent");
                onDone();
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-40"
          >
            Send appeal
          </button>
        </div>
      )}
    </div>
  );
}

function Forum({
  clubId,
  slug,
  canPost,
  isAdmin,
}: {
  clubId: string;
  slug: string;
  canPost: boolean;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const post = useServerFn(postToClub);
  const moderate = useServerFn(moderateClubPost);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const postsQuery = useQuery({
    queryKey: ["club", slug, "posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_posts")
        .select("id, content, pinned, created_at, user_id, profiles(username)")
        .eq("club_id", clubId)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        content: string;
        pinned: boolean;
        created_at: string;
        profiles: { username: string } | null;
      }[];
    },
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["club", slug, "posts"] });

  async function submit() {
    setBusy(true);
    try {
      await post({ data: { clubId, content: text.trim() } });
      setText("");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function act(postId: string, action: "pin" | "unpin" | "delete") {
    try {
      await moderate({ data: { clubId, postId, action } });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <section className="space-y-4">
      {canPost && (
        <div className="rounded-xl border border-border bg-card p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Share a game, ask a question, announce a meetup…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={() => void submit()}
            disabled={busy || !text.trim()}
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Post
          </button>
        </div>
      )}
      {postsQuery.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
      {postsQuery.data?.length === 0 && <Empty text="No posts yet. Start the conversation." />}
      {postsQuery.data?.map((p) => (
        <article
          key={p.id}
          className={`rounded-xl border bg-card p-4 ${p.pinned ? "border-gold/60" : "border-border"}`}
        >
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {p.pinned && <Pin className="h-3.5 w-3.5 text-gold" />}
              {p.profiles?.username ? (
                <Link
                  to="/profile/$username"
                  params={{ username: p.profiles.username }}
                  className="font-medium text-foreground hover:underline"
                >
                  {p.profiles.username}
                </Link>
              ) : (
                "member"
              )}
              · {new Date(p.created_at).toLocaleString()}
            </span>
            {isAdmin && (
              <span className="flex gap-1">
                <button
                  onClick={() => void act(p.id, p.pinned ? "unpin" : "pin")}
                  className="rounded p-1 hover:bg-accent"
                  aria-label={p.pinned ? "Unpin post" : "Pin post"}
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => void act(p.id, "delete")}
                  className="rounded p-1 text-destructive hover:bg-accent"
                  aria-label="Delete post"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm">{p.content}</p>
        </article>
      ))}
    </section>
  );
}

function MemberList({ members }: { members: Member[] }) {
  if (!members.length) return <Empty text="No members yet." />;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {members.map((m) => (
        <div
          key={m.user_id}
          className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
        >
          <div className="flex items-center gap-2">
            {m.role === "owner" && <Crown className="h-4 w-4 text-gold" />}
            {m.role === "admin" && <Shield className="h-4 w-4 text-primary" />}
            {m.profiles ? (
              <Link
                to="/profile/$username"
                params={{ username: m.profiles.username }}
                className="font-medium hover:underline"
              >
                {m.profiles.username}
              </Link>
            ) : (
              <span className="text-muted-foreground">member</span>
            )}
            {m.profiles?.subscription_tier === "gold" && (
              <span className="rounded bg-gold/20 px-1.5 text-[10px] font-bold uppercase text-gold">
                Gold
              </span>
            )}
          </div>
          <span className="font-mono text-sm text-muted-foreground">
            {m.profiles?.rating ?? "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function Events({ clubId, isAdmin }: { clubId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const create = useServerFn(createTournament);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "swiss" as "swiss" | "arena" | "round_robin" | "knockout",
    timeControl: "5+0" as "3+0" | "5+0" | "10+0" | "15+10",
    rounds: 5,
    startsAt: "",
  });

  const eventsQuery = useQuery({
    queryKey: ["club", clubId, "events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id, name, type, time_control, status, starts_at, max_players")
        .eq("club_id", clubId)
        .order("starts_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function submit() {
    setBusy(true);
    try {
      await create({
        data: {
          name: form.name.trim(),
          type: form.type,
          timeControl: form.timeControl,
          rounds: form.rounds,
          startsAt: new Date(form.startsAt).toISOString(),
          clubId,
        },
      });
      toast.success("Club event created");
      setShow(false);
      void qc.invalidateQueries({ queryKey: ["club", clubId, "events"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const events = eventsQuery.data ?? [];
  const upcoming = events.filter((e) => e.status !== "finished" && e.status !== "cancelled");
  const past = events.filter((e) => e.status === "finished" || e.status === "cancelled");

  return (
    <section className="space-y-6">
      {isAdmin && (
        <div>
          <button
            onClick={() => setShow((v) => !v)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            New club event
          </button>
          {show && (
            <div className="mt-3 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
              <Field label="Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  maxLength={80}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </Field>
              <Field label="Format">
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="swiss">Swiss</option>
                  <option value="arena">Arena</option>
                  <option value="round_robin">Round-robin</option>
                  <option value="knockout">Knockout</option>
                </select>
              </Field>
              <Field label="Time control">
                <select
                  value={form.timeControl}
                  onChange={(e) =>
                    setForm({ ...form, timeControl: e.target.value as typeof form.timeControl })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="3+0">3+0 Blitz</option>
                  <option value="5+0">5+0 Blitz</option>
                  <option value="10+0">10+0 Rapid</option>
                  <option value="15+10">15+10 Rapid</option>
                </select>
              </Field>
              <Field label="Rounds">
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={form.rounds}
                  onChange={(e) => setForm({ ...form, rounds: Number(e.target.value) })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </Field>
              <Field label="Starts at">
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </Field>
              <button
                onClick={() => void submit()}
                disabled={busy || form.name.trim().length < 3 || !form.startsAt}
                className="inline-flex w-fit items-center gap-2 self-end rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create event
              </button>
            </div>
          )}
        </div>
      )}
      <EventList title="Upcoming & live" events={upcoming} empty="No upcoming events." />
      <EventList title="Tournament history" events={past} empty="No past events yet." />
    </section>
  );
}

function EventList({
  title,
  events,
  empty,
}: {
  title: string;
  events: {
    id: string;
    name: string;
    type: string;
    time_control: string;
    status: string;
    starts_at: string;
  }[];
  empty: string;
}) {
  return (
    <div>
      <h2 className="mb-2 font-serif text-xl font-semibold">{title}</h2>
      {events.length === 0 ? (
        <Empty text={empty} />
      ) : (
        <div className="space-y-2">
          {events.map((t) => (
            <Link
              key={t.id}
              to="/tournaments/$id"
              params={{ id: t.id }}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/60"
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-xs text-muted-foreground">
                {t.type.replace("_", "-")} · {t.time_control} ·{" "}
                {new Date(t.starts_at).toLocaleString()} ·{" "}
                <span className="font-semibold uppercase">{t.status}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function GamesFeed({ slug, memberIds }: { slug: string; memberIds: string[] }) {
  const gamesQuery = useQuery({
    queryKey: ["club", slug, "games", memberIds.length],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      const ids = memberIds.slice(0, 200).join(",");
      const { data, error } = await supabase
        .from("games")
        .select("id, white_id, black_id, result, time_control, ended_at, status")
        .eq("is_public", true)
        .or(`white_id.in.(${ids}),black_id.in.(${ids})`)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const games = data ?? [];
      const players = [...new Set(games.flatMap((g) => [g.white_id, g.black_id]))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", players);
      const names = new Map((profs ?? []).map((p) => [p.id, p.username]));
      return games.map((g) => ({
        ...g,
        white: names.get(g.white_id) ?? "?",
        black: names.get(g.black_id) ?? "?",
      }));
    },
  });

  if (gamesQuery.isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (!gamesQuery.data?.length) return <Empty text="No games from club members yet." />;
  return (
    <div className="space-y-2">
      {gamesQuery.data.map((g) => (
        <Link
          key={g.id}
          to="/spectate/$gameId"
          params={{ gameId: g.id }}
          className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/60"
        >
          <span className="text-sm">
            <span className="font-medium">{g.white}</span>
            <span className="mx-2 text-muted-foreground">vs</span>
            <span className="font-medium">{g.black}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {g.time_control} · {g.status === "active" ? "LIVE" : (g.result ?? g.status)}
          </span>
        </Link>
      ))}
    </div>
  );
}

function Studies({ slug, memberIds }: { slug: string; memberIds: string[] }) {
  const studiesQuery = useQuery({
    queryKey: ["club", slug, "studies", memberIds.length],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_boards")
        .select("id, title, owner_id, updated_at, visibility")
        .in("owner_id", memberIds.slice(0, 200))
        .neq("visibility", "private")
        .order("updated_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (studiesQuery.isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (!studiesQuery.data?.length) {
    return <Empty text="No shared study boards from members yet." />;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {studiesQuery.data.map((s) => (
        <Link
          key={s.id}
          to="/study/$studyId"
          params={{ studyId: s.id }}
          className="rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/60"
        >
          <p className="font-medium">{s.title}</p>
          <p className="text-xs text-muted-foreground">
            Updated {new Date(s.updated_at).toLocaleDateString()}
          </p>
        </Link>
      ))}
    </div>
  );
}

function Manage({
  clubId,
  slug,
  members,
  ownerId,
}: {
  clubId: string;
  slug: string;
  members: Member[];
  ownerId: string | null;
}) {
  const qc = useQueryClient();
  const moderate = useServerFn(moderateClubMember);
  const decide = useServerFn(decideClubAppeal);
  const analytics = useServerFn(getClubAnalytics);

  const statsQuery = useQuery({
    queryKey: ["club", slug, "analytics"],
    queryFn: () => analytics({ data: { clubId } }),
  });

  const bansQuery = useQuery({
    queryKey: ["club", slug, "bans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_bans")
        .select("user_id, reason, appeal_text, appeal_status, profiles(username)")
        .eq("club_id", clubId);
      if (error) throw error;
      return (data ?? []) as unknown as {
        user_id: string;
        reason: string | null;
        appeal_text: string | null;
        appeal_status: string;
        profiles: { username: string } | null;
      }[];
    },
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["club", slug] });

  async function act(
    userId: string,
    action: "approve" | "reject" | "promote" | "demote" | "mute" | "unmute" | "remove" | "ban",
  ) {
    try {
      await moderate({ data: { clubId, userId, action } });
      toast.success("Done");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const pending = members.filter((m) => m.status === "pending");
  const approved = members.filter((m) => m.status === "approved" && m.user_id !== ownerId);
  const stats = statsQuery.data?.totals;

  return (
    <section className="space-y-8">
      <div>
        <h2 className="mb-3 flex items-center gap-2 font-serif text-xl font-semibold">
          <BarChart3 className="h-5 w-5" /> Analytics
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Members" value={stats?.members} />
          <Stat label="Games played" value={stats?.games} />
          <Stat label="Tournament entries" value={stats?.tournamentEntries} />
          <Stat label="Forum posts" value={stats?.posts} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-serif text-xl font-semibold">Join requests</h2>
        {pending.length === 0 ? (
          <Empty text="No pending requests." />
        ) : (
          <div className="space-y-2">
            {pending.map((m) => (
              <Row key={m.user_id} name={m.profiles?.username}>
                <ActionButton onClick={() => void act(m.user_id, "approve")}>Approve</ActionButton>
                <ActionButton onClick={() => void act(m.user_id, "reject")}>Reject</ActionButton>
              </Row>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 font-serif text-xl font-semibold">Members</h2>
        {approved.length === 0 ? (
          <Empty text="No other members yet." />
        ) : (
          <div className="space-y-2">
            {approved.map((m) => {
              const muted = m.muted_until && new Date(m.muted_until) > new Date();
              return (
                <Row
                  key={m.user_id}
                  name={m.profiles?.username}
                  tag={m.role !== "member" ? m.role : undefined}
                >
                  {m.role === "admin" ? (
                    <ActionButton onClick={() => void act(m.user_id, "demote")}>
                      Demote
                    </ActionButton>
                  ) : (
                    <ActionButton onClick={() => void act(m.user_id, "promote")}>
                      Make admin
                    </ActionButton>
                  )}
                  <ActionButton onClick={() => void act(m.user_id, muted ? "unmute" : "mute")}>
                    {muted ? "Unmute" : "Mute 24h"}
                  </ActionButton>
                  <ActionButton onClick={() => void act(m.user_id, "remove")}>Remove</ActionButton>
                  <ActionButton danger onClick={() => void act(m.user_id, "ban")}>
                    Ban
                  </ActionButton>
                </Row>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 font-serif text-xl font-semibold">Bans & appeals</h2>
        {!bansQuery.data?.length ? (
          <Empty text="No banned members." />
        ) : (
          <div className="space-y-2">
            {bansQuery.data.map((b) => (
              <div
                key={b.user_id}
                className="rounded-lg border border-border bg-card px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{b.profiles?.username ?? "user"}</span>
                  <span className="text-xs uppercase text-muted-foreground">
                    appeal: {b.appeal_status}
                  </span>
                </div>
                {b.reason && <p className="mt-1 text-muted-foreground">Reason: {b.reason}</p>}
                {b.appeal_text && <p className="mt-1 italic">“{b.appeal_text}”</p>}
                <div className="mt-2 flex gap-2">
                  <ActionButton
                    onClick={async () => {
                      await decide({ data: { clubId, userId: b.user_id, accept: true } });
                      refresh();
                    }}
                  >
                    Lift ban
                  </ActionButton>
                  {b.appeal_status === "pending" && (
                    <ActionButton
                      danger
                      onClick={async () => {
                        await decide({ data: { clubId, userId: b.user_id, accept: false } });
                        refresh();
                      }}
                    >
                      Reject appeal
                    </ActionButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Row({ name, tag, children }: { name?: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3">
      <span className="font-medium">
        {name ?? "user"}
        {tag && <span className="ml-2 text-xs uppercase text-muted-foreground">{tag}</span>}
      </span>
      <span className="flex flex-wrap gap-1.5">{children}</span>
    </div>
  );
}

function ActionButton({
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
      className={`rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent ${
        danger ? "border-destructive/50 text-destructive" : "border-border"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-2xl font-bold">{value ?? "—"}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}
