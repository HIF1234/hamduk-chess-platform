import { Fragment, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Scale, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { comparePlayers } from "@/lib/compare.functions";
import { flag } from "@/lib/flags";

/** "Compare" controls plus the side-by-side panel when ?compare= is set. */
export function PlayerCompare({ username, compare }: { username: string; compare?: string }) {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const [other, setOther] = useState("");
  const me = useQuery({
    queryKey: ["my-username", user?.id],
    enabled: !!user && !isGuest,
    queryFn: async () =>
      (await supabase.from("profiles").select("username").eq("id", user!.id).maybeSingle()).data
        ?.username ?? null,
  });
  const go = (name: string) =>
    navigate({ to: "/profile/$username", params: { username }, search: { compare: name.trim() } });

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center gap-2">
        <Scale className="h-4 w-4 text-primary" />
        {me.data &&
          me.data.toLowerCase() !== username.toLowerCase() &&
          compare?.toLowerCase() !== me.data.toLowerCase() && (
            <button
              onClick={() => go(me.data!)}
              className="rounded-md border border-primary/50 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
            >
              Compare with me
            </button>
          )}
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (other.trim()) go(other);
          }}
        >
          <input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="Compare with…"
            className="w-36 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <button
            disabled={!other.trim()}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40"
          >
            Compare
          </button>
        </form>
      </div>
      {compare && (
        <ComparePanel
          a={username}
          b={compare}
          onClose={() => navigate({ to: "/profile/$username", params: { username }, search: {} })}
        />
      )}
    </section>
  );
}

function ComparePanel({ a, b, onClose }: { a: string; b: string; onClose: () => void }) {
  const fetchCompare = useServerFn(comparePlayers);
  const q = useQuery({
    queryKey: ["compare", a, b],
    queryFn: () => fetchCompare({ data: { a, b } }),
  });
  if (q.isLoading) return <Loader2 className="mt-4 h-5 w-5 animate-spin" />;
  if (q.isError || !q.data)
    return <p className="mt-4 text-sm text-destructive">Couldn't load the comparison.</p>;
  if ("error" in q.data)
    return <p className="mt-4 text-sm text-muted-foreground">{q.data.error}</p>;
  const { a: A, b: B, headToHead: h } = q.data;
  const tcs = [
    ...new Set([...A.ratings, ...B.ratings].map((r) => `${r.time_control}|${r.variant}`)),
  ];
  const ratingOf = (side: typeof A, key: string) =>
    side.ratings.find((r) => `${r.time_control}|${r.variant}` === key)?.rating;
  const winRate = (r: typeof A.record) =>
    r.games ? Math.round(((r.wins + r.draws * 0.5) / r.games) * 100) : null;
  const row = (
    label: string,
    x: React.ReactNode,
    y: React.ReactNode,
    better?: "a" | "b" | null,
  ) => (
    <tr className="border-t border-border">
      <td
        className={`px-3 py-2 text-right font-mono ${better === "a" ? "font-bold text-primary" : ""}`}
      >
        {x ?? "—"}
      </td>
      <td className="px-3 py-2 text-center text-xs text-muted-foreground">{label}</td>
      <td className={`px-3 py-2 font-mono ${better === "b" ? "font-bold text-primary" : ""}`}>
        {y ?? "—"}
      </td>
    </tr>
  );
  const cmp = (x?: number | null, y?: number | null) =>
    x == null || y == null || x === y ? null : x > y ? "a" : "b";

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between bg-muted/40 px-4 py-3">
        <p className="font-semibold">
          {flag(A.country)} {A.username} <span className="text-muted-foreground">vs</span>{" "}
          {flag(B.country)}{" "}
          <Link
            to="/profile/$username"
            params={{ username: B.username }}
            className="hover:underline"
          >
            {B.username}
          </Link>
        </p>
        <button
          onClick={onClose}
          aria-label="Close comparison"
          className="rounded p-1 hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {tcs.map((k) => {
            const [tc, variant] = k.split("|");
            const x = ratingOf(A, k),
              y = ratingOf(B, k);
            return (
              <Fragment key={k}>
                {row(`${tc}${variant === "chess960" ? " 960" : ""}`, x, y, cmp(x, y))}
              </Fragment>
            );
          })}
          {row("Games", A.record.games, B.record.games)}
          {row(
            "W / L / D",
            `${A.record.wins}/${A.record.losses}/${A.record.draws}`,
            `${B.record.wins}/${B.record.losses}/${B.record.draws}`,
          )}
          {row(
            "Win rate",
            winRate(A.record) != null ? `${winRate(A.record)}%` : null,
            winRate(B.record) != null ? `${winRate(B.record)}%` : null,
            cmp(winRate(A.record), winRate(B.record)),
          )}
          {row(
            "Avg accuracy",
            A.accuracy != null ? `${A.accuracy}%` : null,
            B.accuracy != null ? `${B.accuracy}%` : null,
            cmp(A.accuracy, B.accuracy),
          )}
          {row("Top opening", A.openings[0]?.name, B.openings[0]?.name)}
        </tbody>
      </table>
      <div className="border-t border-border p-4">
        <p className="text-sm font-semibold">
          Head to head:{" "}
          <span className="font-mono">
            {h.score.a} – {h.score.b}
          </span>
          {h.score.draws ? (
            <span className="text-muted-foreground"> ({h.score.draws} drawn)</span>
          ) : null}
        </p>
        {h.games.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {h.games.map((g) => (
              <li key={g.id}>
                <Link
                  to="/spectate/$gameId"
                  params={{ gameId: g.id }}
                  className="flex justify-between rounded px-2 py-1 hover:bg-accent/40"
                >
                  <span>
                    {g.winner === "draw"
                      ? "Draw"
                      : `${g.winner === "a" ? A.username : B.username} won`}{" "}
                    · {g.endReason}
                  </span>
                  <span className="text-muted-foreground">
                    {g.timeControl} · {g.endedAt ? new Date(g.endedAt).toLocaleDateString() : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">They haven't played each other yet.</p>
        )}
      </div>
    </div>
  );
}
