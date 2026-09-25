import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CATEGORY_LABEL, idsIn, type TimeControlCategory } from "@/lib/time-controls";
import { flag } from "@/lib/flags";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Hamduk Chess" },
      {
        name: "description",
        content:
          "Top Hamduk Chess players by time control — globally, in Nigeria and among your friends.",
      },
    ],
  }),
  component: LeaderboardPage,
});

const CATEGORIES: TimeControlCategory[] = ["bullet", "blitz", "rapid", "classical"];
const PAGE = 50;

// Africa first; a player can pick any country from their profile.
const COUNTRIES: [string, string][] = [
  ["NG", "Nigeria"],
  ["GH", "Ghana"],
  ["KE", "Kenya"],
  ["ZA", "South Africa"],
  ["EG", "Egypt"],
  ["UG", "Uganda"],
  ["CM", "Cameroon"],
  ["SN", "Senegal"],
  ["CI", "Côte d'Ivoire"],
  ["ET", "Ethiopia"],
];

type Row = {
  rank: number;
  user_id: string;
  username: string;
  country: string | null;
  rating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  games_month: number;
  last_active_at: string;
  total: number;
};

function LeaderboardPage() {
  const { user, isGuest } = useAuth();
  const [category, setCategory] = useState<TimeControlCategory>("blitz");
  const [variant, setVariant] = useState<"standard" | "chess960">("standard");
  const [scope, setScope] = useState<"global" | "country" | "friends">("global");
  const [country, setCountry] = useState("NG");
  const [month, setMonth] = useState(false);
  const [page, setPage] = useState(0);

  const args = {
    p_tcs: idsIn(category),
    p_variant: variant,
    p_country: scope === "country" ? country : undefined,
    p_friends_of: scope === "friends" && user ? user.id : undefined,
    p_month: month,
  };

  const q = useQuery({
    queryKey: ["leaderboard", category, variant, scope, country, month, page, user?.id],
    enabled: scope !== "friends" || !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("leaderboard", {
        ...args,
        p_limit: PAGE,
        p_offset: page * PAGE,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const mine = useQuery({
    queryKey: ["leaderboard", "me", category, variant, scope, country, month, user?.id],
    enabled: !!user && !isGuest,
    queryFn: async () => {
      const { data } = await supabase.rpc("leaderboard", { ...args, p_only: user!.id });
      return ((data ?? []) as Row[])[0] ?? null;
    },
  });

  const rows = q.data ?? [];
  const total = rows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const reset = () => setPage(0);
  const chip = (on: boolean) =>
    `rounded-md px-3 py-1.5 text-sm ${on ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`;
  const meOnPage = mine.data && rows.some((r) => r.user_id === mine.data!.user_id);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mb-6 flex items-center gap-3">
          <Trophy className="h-8 w-8 text-gold" />
          <div>
            <h1 className="font-serif text-4xl font-bold tracking-tight">Leaderboard</h1>
            <p className="text-muted-foreground">
              {CATEGORY_LABEL[category]} · {variant === "chess960" ? "Chess960" : "Standard"} ·{" "}
              {scope === "global"
                ? "Global"
                : scope === "country"
                  ? COUNTRIES.find((c) => c[0] === country)?.[1]
                  : "Friends"}{" "}
              · {month ? "This month" : "All time"}
            </p>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCategory(c);
                  reset();
                }}
                className={chip(category === c)}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-lg border border-border p-0.5">
            <button
              onClick={() => {
                setVariant("standard");
                reset();
              }}
              className={chip(variant === "standard")}
            >
              Standard
            </button>
            <button
              onClick={() => {
                setVariant("chess960");
                reset();
              }}
              className={chip(variant === "chess960")}
            >
              960
            </button>
          </div>
          <div className="inline-flex rounded-lg border border-border p-0.5">
            <button
              onClick={() => {
                setMonth(false);
                reset();
              }}
              className={chip(!month)}
            >
              All time
            </button>
            <button
              onClick={() => {
                setMonth(true);
                reset();
              }}
              className={chip(month)}
            >
              This month
            </button>
          </div>
        </div>
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5">
            <button
              onClick={() => {
                setScope("global");
                reset();
              }}
              className={chip(scope === "global")}
            >
              Global
            </button>
            <button
              onClick={() => {
                setScope("country");
                reset();
              }}
              className={chip(scope === "country")}
            >
              Country
            </button>
            <button
              onClick={() => {
                setScope("friends");
                reset();
              }}
              className={chip(scope === "friends")}
              disabled={!user}
            >
              Friends
            </button>
          </div>
          {scope === "country" && (
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                reset();
              }}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {COUNTRIES.map(([code, name]) => (
                <option key={code} value={code}>
                  {flag(code)} {name}
                </option>
              ))}
            </select>
          )}
        </div>

        {mine.data && !meOnPage && (
          <div className="mb-3 rounded-xl border border-primary/50 bg-primary/10">
            <table className="w-full text-sm">
              <tbody>
                <PlayerRow r={mine.data} me />
              </tbody>
            </table>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-14 px-4 py-3">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Rating</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">
                  {month ? "This month" : "Games"}
                </th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!q.isLoading && scope === "friends" && !user && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <Link to="/login" className="text-primary underline">
                      Sign in
                    </Link>{" "}
                    to see how you rank among friends.
                  </td>
                </tr>
              )}
              {!q.isLoading && !rows.length && (scope !== "friends" || user) && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No rated {CATEGORY_LABEL[category].toLowerCase()} players here yet — be the
                    first.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <PlayerRow key={r.user_id} r={r} me={r.user_id === user?.id} month={month} />
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3 text-sm">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-border p-1.5 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              Page {page + 1} of {pages}
            </span>
            <button
              disabled={page + 1 >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-border p-1.5 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function PlayerRow({ r, me, month }: { r: Row; me?: boolean; month?: boolean }) {
  const online = Date.now() - new Date(r.last_active_at).getTime() < 5 * 60_000;
  const decided = r.wins + r.losses + r.draws;
  const winRate = decided ? Math.round(((r.wins + r.draws * 0.5) / decided) * 100) : 0;
  return (
    <tr
      className={`border-t border-border first:border-t-0 ${me ? "bg-primary/10" : "hover:bg-accent/30"}`}
    >
      <td className="px-4 py-3">
        <span className={`font-bold ${r.rank <= 3 ? "text-gold" : "text-muted-foreground"}`}>
          {r.rank}
        </span>
      </td>
      <td className="px-4 py-3 font-medium">
        <span className="inline-flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${online ? "bg-primary" : "bg-muted"}`}
            title={online ? "Online" : "Offline"}
          />
          <span aria-hidden>{flag(r.country)}</span>
          <Link
            to="/profile/$username"
            params={{ username: r.username }}
            className="hover:underline"
          >
            {r.username}
          </Link>
          {me && <span className="text-xs text-primary">(you)</span>}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-mono font-bold text-primary">
        {r.games < 10 ? "~" : ""}
        {r.rating}
      </td>
      <td className="hidden px-4 py-3 text-right text-muted-foreground sm:table-cell">
        {month ? r.games_month : r.games}
      </td>
      <td className="hidden px-4 py-3 text-right text-muted-foreground sm:table-cell">
        {winRate}%
      </td>
    </tr>
  );
}
