import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, EmptyState, PageHeader, Stat, when } from "@/components/admin/AdminUi";
import { getGrowthStats } from "@/lib/admin-extra.functions";

export const Route = createFileRoute("/admin/growth")({
  head: () => ({
    meta: [
      { title: "Growth | Hamduk Chess staff" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Growth,
  errorComponent: ({ error }) => (
    <div className="p-4 text-sm text-destructive">{error.message}</div>
  ),
});

function Growth() {
  const q = useQuery({
    queryKey: ["admin-growth"],
    queryFn: () => getGrowthStats(),
    refetchInterval: 60_000,
  });
  const d = q.data;
  const max = Math.max(1, ...(d?.signupsByDay ?? []).map((x) => x.players + x.guests));
  return (
    <div className="space-y-6">
      <PageHeader title="Growth" subtitle="Sign-ups, activity, memberships and referrals." />
      {!d ? (
        <EmptyState>Loading…</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Registered players"
              value={d.players.toLocaleString()}
              hint={`${d.guests.toLocaleString()} guests`}
            />
            <Stat
              label="Active today"
              value={d.active.day}
              hint={`${d.active.week} this week · ${d.active.month} this month`}
            />
            <Stat
              label="Paying members"
              value={d.members.plus + d.members.gold}
              hint={`${d.members.plus} Plus · ${d.members.gold} Gold`}
            />
            <Stat
              label="Last 24h"
              value={d.last24h.onlineGames + d.last24h.botGames}
              hint={`${d.last24h.onlineGames} online · ${d.last24h.botGames} bot games · ${d.last24h.puzzles} puzzles`}
            />
          </div>

          <Card>
            <p className="mb-3 text-sm font-semibold">Sign-ups, last 30 days</p>
            <div
              className="flex h-40 items-end gap-1"
              role="img"
              aria-label="Daily sign-ups for the last 30 days"
            >
              {d.signupsByDay.map((x) => (
                <div
                  key={x.day}
                  className="flex flex-1 flex-col justify-end"
                  title={`${x.day}: ${x.players} players, ${x.guests} guests`}
                >
                  <div className="bg-gold/60" style={{ height: `${(x.guests / max) * 100}%` }} />
                  <div className="bg-primary" style={{ height: `${(x.players / max) * 100}%` }} />
                </div>
              ))}
            </div>
            <p className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-3 bg-primary" /> Registered
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-3 bg-gold/60" /> Guests
              </span>
            </p>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <p className="mb-3 text-sm font-semibold">Memberships ending in the next 7 days</p>
              {d.expiringSoon.length ? (
                <ul className="divide-y divide-border text-sm">
                  {d.expiringSoon.map((p) => (
                    <li key={p.id} className="flex justify-between py-2">
                      <Link
                        to="/admin/users/$userId"
                        params={{ userId: p.id }}
                        className="hover:underline"
                      >
                        {p.username}
                      </Link>
                      <span className="text-muted-foreground">
                        {p.subscription_tier} · {when(p.subscription_renews_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState>None this week.</EmptyState>
              )}
            </Card>
            <Card>
              <p className="mb-3 text-sm font-semibold">
                Top referrers ({d.referralConversions} paid conversions)
              </p>
              {d.topReferrers.length ? (
                <ol className="divide-y divide-border text-sm">
                  {d.topReferrers.map((r, i) => (
                    <li key={r.username + i} className="flex justify-between py-2">
                      <span>
                        {i + 1}. {r.username}
                      </span>
                      <span className="font-mono">{r.conversions}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState>No referral conversions yet.</EmptyState>
              )}
            </Card>
          </div>

          <Card>
            <p className="mb-3 text-sm font-semibold">Achievements unlocked ({d.badgesTotal})</p>
            {d.badges.length ? (
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {d.badges.map(([slug, n]) => (
                  <li key={slug} className="flex justify-between rounded bg-muted/40 px-3 py-1.5">
                    <span>{slug}</span>
                    <span className="font-mono">{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>No badges earned yet.</EmptyState>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
