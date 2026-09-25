import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Swords, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { createPrivateBattle, findBattle, myBattles } from "@/lib/puzzle-battle.functions";

export const Route = createFileRoute("/puzzles/battle/")({
  head: () => ({
    meta: [
      { title: "Puzzle Battle — Hamduk Chess" },
      {
        name: "description",
        content: "Race another player through the same puzzles. First to five wins.",
      },
    ],
  }),
  component: BattleLobby,
});

function BattleLobby() {
  const { user, isGuest, loading } = useAuth();
  const navigate = useNavigate();
  const find = useServerFn(findBattle);
  const invite = useServerFn(createPrivateBattle);
  const history = useServerFn(myBattles);
  const [busy, setBusy] = useState<"find" | "invite" | null>(null);

  const past = useQuery({
    queryKey: ["puzzle-battles", user?.id],
    enabled: !!user && !isGuest,
    queryFn: () => history(),
  });

  async function go(kind: "find" | "invite") {
    setBusy(kind);
    try {
      const { battleId } = kind === "find" ? await find() : await invite();
      void navigate({ to: "/puzzles/battle/$id", params: { id: battleId } });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  }

  const signedOut = !loading && (!user || isGuest);
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="flex items-center gap-2 font-serif text-4xl font-bold tracking-tight">
          <Swords className="h-8 w-8 text-primary" /> Puzzle Battle
        </h1>
        <p className="mt-2 text-muted-foreground">
          You and an opponent get the same puzzles. First to solve five wins. After three minutes,
          the higher score wins. A wrong move costs you that puzzle, so think before you click.
        </p>

        {signedOut ? (
          <p className="mt-8 rounded-xl border border-border bg-card p-6 text-center">
            <Link to="/login" className="font-semibold text-primary underline">
              Create a free account
            </Link>{" "}
            to battle.
          </p>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => void go("find")}
              disabled={!!busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-5 text-lg font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy === "find" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Swords className="h-5 w-5" />
              )}
              Find an opponent
            </button>
            <button
              onClick={() => void go("invite")}
              disabled={!!busy}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-5 text-lg font-semibold hover:bg-accent disabled:opacity-50"
            >
              {busy === "invite" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <UserPlus className="h-5 w-5" />
              )}
              Challenge a friend
            </button>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Free accounts get 3 battles a day. Hamduk Plus and Gold are unlimited.
        </p>

        {!!past.data?.length && (
          <section className="mt-10">
            <h2 className="mb-3 font-semibold">Recent battles</h2>
            <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
              {past.data.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span>
                    vs{" "}
                    <Link
                      to="/profile/$username"
                      params={{ username: b.opponent }}
                      className="font-medium hover:underline"
                    >
                      {b.opponent}
                    </Link>
                  </span>
                  <span className="font-mono">
                    {b.mine}–{b.theirs}{" "}
                    <span
                      className={
                        b.result === "won"
                          ? "text-primary"
                          : b.result === "lost"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }
                    >
                      {b.result}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
