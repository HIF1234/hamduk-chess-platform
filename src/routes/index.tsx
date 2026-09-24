import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Chessboard } from "react-chessboard";
import {
  ArrowRight,
  CalendarClock,
  Flame,
  Gift,
  Globe2,
  Lock,
  MessagesSquare,
  Newspaper,
  Puzzle,
  Radio,
  Sparkles,
  Swords,
  Tv,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { HomeBotGame } from "@/components/home/HomeBotGame";
import { ArticleCard } from "@/components/ArticleCard";
import { supabase } from "@/integrations/supabase/client";
import { BOT_PERSONAS } from "@/lib/bot-personas";
import { getHomeStats, getMyDashboard } from "@/lib/home.functions";
import { getTvGames } from "@/lib/tv.functions";
import { getDailyPuzzle } from "@/lib/puzzles.functions";
import { useBoardSquares } from "@/lib/preferences";
import { TIER_PRICING } from "@/lib/paystack-pricing";
import { CATEGORY_LABEL, categoryOf } from "@/lib/time-controls";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hamduk Chess — Play chess online, Africa first" },
      {
        name: "description",
        content:
          "Play chess free — against Nigerian bots, friends on WhatsApp or players across Africa. Puzzles, lessons, tournaments and a coach that listens.",
      },
      { property: "og:title", content: "Hamduk Chess — Play chess online, Africa first" },
    ],
  }),
  component: Home,
});

const QUICK = ["3+0", "5+0", "10+0"] as const;
const today = () => new Date().toISOString().slice(0, 10);

function Home() {
  const { user, isGuest, loading } = useAuth();
  const signedIn = !!user && !loading;
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <section className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
          <div className="order-2 min-w-0 lg:order-1">
            {signedIn ? <Dashboard isGuest={isGuest} /> : <Welcome />}
          </div>
          <div className="order-1 min-w-0 lg:order-2">
            <HomeBotGame />
          </div>
        </section>

        <section className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
          <DailyPuzzleCard />
          <TvCard />
          <CoachCard />
        </section>

        <BotsStrip />

        <section className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <NewsBlock />
          <ForumBlock />
        </section>

        {!signedIn && <Pricing />}
      </main>
    </div>
  );
}

/* ---------------- Logged out ---------------- */

function Welcome() {
  const fetchStats = useServerFn(getHomeStats);
  const stats = useQuery({
    queryKey: ["home", "stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 60_000,
  });
  const s = stats.data;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-gold">Hamduk Chess Club</p>
      <h1 className="mt-2 font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        Play chess, <span className="text-primary">Africa first.</span>
      </h1>
      <p className="mt-3 max-w-xl text-lg text-muted-foreground">
        Your move is already waiting on the board. No sign-up needed — play a Nigerian bot now,
        challenge a friend on WhatsApp, or find an opponent online.
      </p>
      {s && (s.gamesToday > 0 || s.liveGames > 0 || s.puzzlesToday > 0) && (
        // Only real, non-zero numbers: an empty "0 players" row reads as a dead site.
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {s.gamesToday > 0 && <Stat label="games today" value={s.gamesToday} />}
          {s.liveGames > 0 && <Stat label="live now" value={s.liveGames} />}
          {s.playersOnline > 0 && <Stat label="players online" value={s.playersOnline} />}
          {s.puzzlesToday > 0 && <Stat label="puzzles solved today" value={s.puzzlesToday} />}
        </div>
      )}
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <BigButton
          to="/lobby"
          icon={Globe2}
          primary
          title="Play online"
          sub="Guest play — no sign-up"
        />
        <BigButton to="/play" icon={Users} title="Play a friend" sub="Send a link on WhatsApp" />
        <BigButton to="/puzzles" icon={Puzzle} title="Solve puzzles" sub="53,000+ real puzzles" />
        <BigButton
          to="/login"
          icon={Sparkles}
          title="Create free account"
          sub="Save games, ratings & badges"
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <p>
      <span className="font-serif text-2xl font-bold">{value.toLocaleString()}</span>{" "}
      <span className="text-muted-foreground">{label}</span>
    </p>
  );
}

/* ---------------- Logged in ---------------- */

function Dashboard({ isGuest }: { isGuest: boolean }) {
  const fetchDash = useServerFn(getMyDashboard);
  const q = useQuery({
    queryKey: ["home", "dashboard"],
    queryFn: () => fetchDash(),
    refetchInterval: 60_000,
  });
  const d = q.data;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          {d?.username ? `Welcome back, ${d.username}` : "Welcome back"}
        </h1>
        {isGuest && (
          <p className="mt-1 text-sm text-muted-foreground">
            You're playing as a guest.{" "}
            <Link to="/login" className="text-primary underline">
              Create a free account
            </Link>{" "}
            to keep your games.
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Quick play
        </p>
        <div className="grid grid-cols-3 gap-2">
          {QUICK.map((tc) => {
            const cat = categoryOf(tc);
            return (
              <Link
                key={tc}
                to="/lobby"
                search={{ tc }}
                className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-center hover:bg-primary/20"
              >
                <p className="font-serif text-2xl font-bold">{tc}</p>
                <p className="text-xs text-muted-foreground">{cat ? CATEGORY_LABEL[cat] : ""}</p>
              </Link>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <SmallLink to="/play" icon={Users} label="Friend" />
          <SmallLink to="/correspondence" icon={CalendarClock} label="Daily" />
          <SmallLink to="/play" icon={Swords} label="More modes" />
        </div>
      </div>

      {!!d?.yourMove.length && (
        <div className="rounded-xl border border-gold/50 bg-gold/10 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Flame className="h-4 w-4 text-gold" /> Your move ({d.yourMove.length})
          </p>
          <ul className="space-y-1 text-sm">
            {d.yourMove.slice(0, 4).map((g) => (
              <li key={g.id}>
                <Link
                  to="/play/$gameId"
                  params={{ gameId: g.id }}
                  className="flex justify-between rounded px-2 py-1 hover:bg-background/60"
                >
                  <span>vs {g.opponent}</span>
                  <span className="text-muted-foreground">
                    {g.correspondence ? "daily" : g.timeControl}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {d?.lastLoss && (
        <Link
          to="/play/$gameId"
          params={{ gameId: d.lastLoss.id }}
          className="block rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 to-card p-4 hover:border-primary"
        >
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-gold" /> Learn from your last loss
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            vs {d.lastLoss.opponent} ({d.lastLoss.timeControl}, {d.lastLoss.endReason}). Open Review
            and tell the coach what you were thinking.
          </p>
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ratings
          </p>
          {d?.ratings.length ? (
            <ul className="space-y-1 text-sm">
              {d.ratings.map((r) => (
                <li key={`${r.time_control}-${r.variant}`} className="flex justify-between">
                  <span>
                    {r.time_control}
                    {r.variant === "chess960" ? " 960" : ""}
                  </span>
                  <span className="font-mono font-semibold">
                    {r.games_played < 10 ? "~" : ""}
                    {r.rating}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Play a rated game to get your first rating.
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Puzzles
          </p>
          <p className="flex items-center gap-2 text-sm">
            <Flame className="h-4 w-4 text-gold" />
            <span className="font-semibold">{d?.puzzle?.current_streak ?? 0}-day streak</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Rating {d?.puzzle?.rating ?? 1200} · {d?.puzzle?.solved_count ?? 0} solved
          </p>
          <Link
            to="/puzzles"
            className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Keep the streak <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {!isGuest && (
        <Link
          to="/invite"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-gold/60"
        >
          <Gift className="h-6 w-6 shrink-0 text-gold" />
          <span className="text-sm">
            <span className="font-semibold">Invite friends, earn free days.</span>{" "}
            <span className="text-muted-foreground">
              30 days for every friend who joins Plus or Gold.
            </span>
          </span>
        </Link>
      )}
    </div>
  );
}

/* ---------------- Shared sections ---------------- */

function DailyPuzzleCard() {
  const fetchDaily = useServerFn(getDailyPuzzle);
  const date = today();
  const squares = useBoardSquares();
  const q = useQuery({
    queryKey: ["home", "daily", date],
    queryFn: () => fetchDaily({ data: { date } }),
  });
  const p = q.data;
  const toMove = p?.fen.split(" ")[1] === "b" ? "black" : "white";
  return (
    <Card
      icon={Puzzle}
      title="Daily puzzle"
      to="/puzzles/daily/$date"
      params={{ date }}
      cta="Solve it"
    >
      {p ? (
        <>
          <div className="pointer-events-none aspect-square w-full">
            <Chessboard
              options={{
                ...squares,
                position: p.fen,
                boardOrientation: toMove,
                allowDragging: false,
                showNotation: false,
                id: "home-daily",
              }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {toMove === "white" ? "White" : "Black"} to move · rated {p.rating}
          </p>
        </>
      ) : (
        <Skeleton />
      )}
    </Card>
  );
}

function TvCard() {
  const fetchTv = useServerFn(getTvGames);
  const squares = useBoardSquares();
  const q = useQuery({
    queryKey: ["home", "tv"],
    queryFn: () => fetchTv(),
    refetchInterval: 30_000,
  });
  const g = q.data?.live[0] ?? q.data?.finished[0];
  const live = !!q.data?.live[0];
  return (
    <Card icon={Tv} title={live ? "Live on HamdukChess TV" : "HamdukChess TV"} to="/tv" cta="Watch">
      {g ? (
        <>
          <div className="pointer-events-none aspect-square w-full">
            <Chessboard
              options={{
                ...squares,
                position: g.fen,
                allowDragging: false,
                showNotation: false,
                id: "home-tv",
              }}
            />
          </div>
          <p className="mt-2 flex items-center gap-1.5 truncate text-sm">
            {live && (
              <Radio className="h-3.5 w-3.5 shrink-0 animate-pulse text-destructive motion-reduce:animate-none" />
            )}
            <span className="font-semibold">{g.white.username}</span>
            <span className="text-muted-foreground">vs</span>
            <span className="font-semibold">{g.black.username}</span>
          </p>
        </>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">
          The best live games appear here.
        </p>
      )}
    </Card>
  );
}

function CoachCard() {
  return (
    <Card icon={Sparkles} title="A coach that listens" to="/play/bot" cta="Play, then review">
      <p className="text-sm text-muted-foreground">
        After a game, open <span className="font-semibold text-foreground">Review</span>, pick a
        move and say what you were thinking — out loud or typed, in English or Pidgin.
      </p>
      <blockquote className="mt-3 rounded-lg border-l-4 border-gold bg-gold/10 p-3 text-sm italic">
        “I played knight to f5 because I wanted his queen…”
      </blockquote>
      <p className="mt-3 text-sm text-muted-foreground">
        The coach checks your ideas with the engine and tells you what you saw right, what you
        missed, and the habit to build.
      </p>
    </Card>
  );
}

function BotsStrip() {
  return (
    <section className="mt-10 min-w-0">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="font-serif text-2xl font-bold">Meet the bots</h2>
        <Link to="/play/bot" className="text-sm text-primary hover:underline">
          All bots
        </Link>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {BOT_PERSONAS.map((b) => (
          <Link
            key={b.id}
            to="/play/bot"
            search={{ bot: b.id }}
            className="w-36 shrink-0 rounded-xl border border-border bg-card p-3 text-center hover:border-primary/60"
          >
            <img
              src={b.portrait}
              alt={b.name}
              loading="lazy"
              className="mx-auto h-20 w-20 rounded-full object-cover"
            />
            <p className="mt-2 text-sm font-semibold">{b.name}</p>
            <p className="text-xs text-muted-foreground">
              {b.rating} · {b.hometown}
            </p>
            <p className="mt-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-primary">
              {b.tier === "plus" && <Lock className="h-3 w-3 text-gold" />}Challenge
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function NewsBlock() {
  const q = useQuery({
    queryKey: ["home", "news"],
    queryFn: async () => {
      const { data } = await supabase
        .from("articles")
        .select("id, slug, type, title, excerpt, cover_url, published_at")
        .order("published_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="flex items-center gap-2 font-serif text-2xl font-bold">
          <Newspaper className="h-5 w-5 text-primary" /> News
        </h2>
        <Link to="/news" className="text-sm text-primary hover:underline">
          All news
        </Link>
      </div>
      {q.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {q.data.map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Chess news from Nigeria and beyond is coming soon.
        </p>
      )}
    </section>
  );
}

function ForumBlock() {
  const q = useQuery({
    queryKey: ["home", "forum"],
    queryFn: async () => {
      const { data } = await supabase
        .from("forum_threads")
        .select("id, title, reply_count, category")
        .order("last_reply_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="flex items-center gap-2 font-serif text-2xl font-bold">
          <MessagesSquare className="h-5 w-5 text-primary" /> Community
        </h2>
        <Link to="/forums" className="text-sm text-primary hover:underline">
          Forums
        </Link>
      </div>
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {q.data?.length ? (
          q.data.map((t) => (
            <Link
              key={t.id}
              to="/forums/thread/$threadId"
              params={{ threadId: t.id }}
              className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-accent/40"
            >
              <span className="line-clamp-1">{t.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t.reply_count} replies
              </span>
            </Link>
          ))
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Be the first to start a conversation.{" "}
            <Link to="/forums" className="text-primary underline">
              Visit the forums
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}

function Pricing() {
  const ngn = (n: number) => `₦${n.toLocaleString("en-NG")}`;
  const plans = [
    {
      name: "Free",
      price: "₦0",
      points: [
        "Unlimited games online & with friends",
        "5 Nigerian bots",
        "20 puzzles a day",
        "Clubs, forums & TV",
      ],
    },
    {
      name: TIER_PRICING.plus.label,
      price: `${ngn(TIER_PRICING.plus.monthly_ngn)} / 30 days`,
      points: [
        "All 13 bots",
        "Unlimited puzzles & Puzzle Storm",
        "Full game review",
        "Correspondence & Chess960",
      ],
      highlight: true,
    },
    {
      name: TIER_PRICING.gold.label,
      price: `${ngn(TIER_PRICING.gold.monthly_ngn)} / 30 days`,
      points: [
        "Everything in Plus",
        "AI coach & weakness reports",
        "Coach marketplace & lessons",
        "Lagos Night board",
      ],
    },
  ];
  return (
    <section className="mt-12">
      <h2 className="text-center font-serif text-3xl font-bold">Priced for Africa</h2>
      <p className="mt-1 text-center text-muted-foreground">
        Free forever to play. Memberships in Naira, no auto-renew.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`rounded-2xl border p-5 ${p.highlight ? "border-primary bg-primary/5" : "border-border bg-card"}`}
          >
            <p className="font-serif text-xl font-bold">{p.name}</p>
            <p className="mt-1 text-lg font-semibold text-primary">{p.price}</p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              {p.points.map((x) => (
                <li key={x}>✓ {x}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-6 text-center">
        <Link to="/billing" className="text-sm text-primary hover:underline">
          Compare plans
        </Link>
      </div>
    </section>
  );
}

/* ---------------- Small pieces ---------------- */

function BigButton({
  to,
  icon: Icon,
  title,
  sub,
  primary,
}: {
  to: string;
  icon: typeof Globe2;
  title: string;
  sub: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-xl border p-4 transition hover:-translate-y-0.5 motion-reduce:transform-none ${
        primary
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:border-primary/60"
      }`}
    >
      <Icon className="h-6 w-6 shrink-0" />
      <span>
        <span className="block font-semibold">{title}</span>
        <span
          className={`block text-xs ${primary ? "text-primary-foreground/80" : "text-muted-foreground"}`}
        >
          {sub}
        </span>
      </span>
    </Link>
  );
}

function SmallLink({ to, icon: Icon, label }: { to: string; icon: typeof Globe2; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 hover:bg-accent"
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}

function Card({
  icon: Icon,
  title,
  to,
  params,
  cta,
  children,
}: {
  icon: typeof Globe2;
  title: string;
  to: string;
  params?: Record<string, string>;
  cta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-4">
      <p className="mb-3 flex items-center gap-2 font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </p>
      <div className="flex-1">{children}</div>
      <Link
        to={to}
        params={params as never}
        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        {cta} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="aspect-square w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
  );
}
