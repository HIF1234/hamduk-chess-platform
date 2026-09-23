import { useEffect, useMemo, useState } from "react";
import { useBoardSquares } from "@/lib/preferences";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Chessboard } from "react-chessboard";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Play, Send, Trophy, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  joinTournament,
  withdrawFromTournament,
  startTournament,
  closeTournament,
  payTournamentEntry,
  verifyTournamentEntry,
} from "@/lib/tournaments.functions";
import { statusLabel, typeLabel } from "@/lib/tournament-config";

export const Route = createFileRoute("/tournaments/$id")({
  head: () => ({
    meta: [
      { title: "Tournament Broadcast — Hamduk Chess" },
      {
        name: "description",
        content: "Live boards, standings and spectator chat for this Hamduk Chess tournament.",
      },
      { property: "og:title", content: "Tournament Broadcast — Hamduk Chess" },
      {
        property: "og:description",
        content: "Live boards, standings and spectator chat for this Hamduk Chess tournament.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TournamentPage,
});

type Tournament = {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  type: string;
  time_control: string;
  variant: string;
  rated: boolean;
  rounds: number;
  current_round: number;
  starts_at: string;
  duration_min: number;
  max_players: number;
  min_tier: string;
  entry_fee_kobo: number;
  status: string;
};

type Standing = {
  id: string;
  user_id: string;
  score: number;
  buchholz: number;
  games_played: number;
  status: string;
  paid: boolean;
  rating_at_join: number;
};

type TGame = {
  id: string;
  round: number;
  game_id: string | null;
  white_id: string | null;
  black_id: string | null;
  result: string | null;
  recorded: boolean;
};

function TournamentPage() {
  const boardSquares = useBoardSquares();
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [boardPage, setBoardPage] = useState(0);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const join = useServerFn(joinTournament);
  const withdraw = useServerFn(withdrawFromTournament);
  const start = useServerFn(startTournament);
  const close = useServerFn(closeTournament);
  const pay = useServerFn(payTournamentEntry);
  const verify = useServerFn(verifyTournamentEntry);

  const dataQuery = useQuery({
    queryKey: ["tournament", id],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data: t, error } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!t) return null;

      const [{ data: players }, { data: tgames }] = await Promise.all([
        supabase
          .from("tournament_players")
          .select("id, user_id, score, buchholz, games_played, status, paid, rating_at_join")
          .eq("tournament_id", id)
          .order("score", { ascending: false })
          .order("buchholz", { ascending: false }),
        supabase
          .from("tournament_games")
          .select("id, round, game_id, white_id, black_id, result, recorded")
          .eq("tournament_id", id)
          .order("round", { ascending: false }),
      ]);

      const ids = Array.from(new Set((players ?? []).map((p) => p.user_id)));
      const names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids);
        for (const p of profs ?? []) names[p.id] = p.username;
      }

      const currentRound = (t as Tournament).current_round;
      const liveIds = (tgames ?? [])
        .filter((g) => g.round === currentRound && g.game_id)
        .map((g) => g.game_id as string);
      const boards: Array<{ id: string; fen: string; status: string; chess960_start_fen: string | null }> = [];
      if (liveIds.length) {
        const { data: games } = await supabase
          .from("games")
          .select("id, fen, status, chess960_start_fen")
          .in("id", liveIds);
        boards.push(...((games ?? []) as typeof boards));
      }

      return {
        tournament: t as Tournament,
        standings: (players ?? []) as Standing[],
        games: (tgames ?? []) as TGame[],
        names,
        boards,
      };
    },
  });

  const chatQuery = useQuery({
    queryKey: ["tournament", id, "chat"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("tournament_chat")
        .select("id, user_id, content, created_at")
        .eq("tournament_id", id)
        .order("created_at", { ascending: false })
        .limit(60);
      return (data ?? []).reverse();
    },
  });

  // Live standings + boards.
  useEffect(() => {
    const channel = supabase
      .channel(`tournament:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_players", filter: `tournament_id=eq.${id}` },
        () => void qc.invalidateQueries({ queryKey: ["tournament", id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_games", filter: `tournament_id=eq.${id}` },
        () => void qc.invalidateQueries({ queryKey: ["tournament", id] }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tournament_chat", filter: `tournament_id=eq.${id}` },
        () => void qc.invalidateQueries({ queryKey: ["tournament", id, "chat"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, qc]);

  // Return trip from Paystack.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("reference");
    if (!ref) return;
    void verify({ data: { reference: ref } })
      .then((r) => {
        if (r.ok) {
          toast.success("Entry fee paid — you're registered.");
          void qc.invalidateQueries({ queryKey: ["tournament", id] });
        }
      })
      .catch(() => undefined)
      .finally(() => window.history.replaceState({}, "", window.location.pathname));
  }, [id, qc, verify]);

  const t = dataQuery.data?.tournament;
  const standings = dataQuery.data?.standings ?? [];
  const games = dataQuery.data?.games ?? [];
  const names = dataQuery.data?.names ?? {};
  const boards = dataQuery.data?.boards ?? [];

  const myEntry = user ? standings.find((s) => s.user_id === user.id) : undefined;
  const roundGames = useMemo(
    () => games.filter((g) => g.round === (t?.current_round ?? 0)),
    [games, t?.current_round],
  );
  const doneCount = roundGames.filter((g) => g.recorded).length;

  // Cycle boards, 4 per view (first one featured).
  const pageCount = Math.max(1, Math.ceil(boards.length / 4));
  useEffect(() => {
    if (pageCount <= 1) return;
    const timer = setInterval(() => setBoardPage((p) => (p + 1) % pageCount), 12_000);
    return () => clearInterval(timer);
  }, [pageCount]);
  const visible = boards.slice(boardPage * 4, boardPage * 4 + 4);

  async function run(fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      await qc.invalidateQueries({ queryKey: ["tournament", id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!user) {
      toast.error("Sign in to join tournaments.");
      return;
    }
    setBusy(true);
    try {
      const res = await join({ data: { tournamentId: id } });
      if (res.requiresPayment) {
        const pr = await pay({
          data: { tournamentId: id, callback_url: `${window.location.origin}/tournaments/${id}` },
        });
        if (pr.authorization_url) {
          window.location.href = pr.authorization_url;
          return;
        }
      }
      toast.success(res.alreadyJoined ? "You're already registered." : "You're in!");
      await qc.invalidateQueries({ queryKey: ["tournament", id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendChat() {
    const text = draft.trim().slice(0, 300);
    if (!text || !user) return;
    const { error } = await supabase
      .from("tournament_chat")
      .insert({ tournament_id: id, user_id: user.id, content: text });
    if (error) toast.error(error.message);
    else {
      setDraft("");
      await qc.invalidateQueries({ queryKey: ["tournament", id, "chat"] });
    }
  }

  if (dataQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!t) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">This tournament isn't available.</p>
        <Link to="/tournaments" className="text-primary underline">All tournaments</Link>
      </div>
    );
  }

  const isOrganiser = user?.id === t.creator_id;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_320px]">
        <div>
          <Link to="/tournaments" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All tournaments
          </Link>

          <header className="mb-5 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="flex items-center gap-2 font-serif text-3xl font-bold tracking-tight">
                  <Trophy className="h-6 w-6 text-primary" /> {t.name}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {typeLabel(t.type)} · {t.time_control} · {t.variant}
                  {!t.rated && " · casual"} · {statusLabel(t.status)}
                  {t.entry_fee_kobo > 0 && ` · ₦${(t.entry_fee_kobo / 100).toLocaleString()} entry`}
                </p>
                {t.description && <p className="mt-2 text-sm">{t.description}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {t.status === "scheduled" && !myEntry && (
                  <button
                    onClick={() => void handleJoin()}
                    disabled={busy}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    Join
                  </button>
                )}
                {myEntry && myEntry.status === "active" && t.status !== "completed" && (
                  <button
                    onClick={() => void run(() => withdraw({ data: { tournamentId: id } }), "Withdrawn")}
                    disabled={busy}
                    className="rounded-md bg-secondary px-4 py-2 text-sm text-secondary-foreground disabled:opacity-40"
                  >
                    Withdraw
                  </button>
                )}
                {isOrganiser && t.status !== "completed" && (
                  <>
                    <button
                      onClick={() => void run(() => start({ data: { tournamentId: id } }), "Round paired")}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-40"
                    >
                      <Play className="h-4 w-4" /> {t.current_round ? "Next round" : "Start"}
                    </button>
                    <button
                      onClick={() => void run(() => close({ data: { tournamentId: id } }), "Closed")}
                      disabled={busy}
                      className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-40"
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.type === "arena"
                ? `Arena · ${t.duration_min} min · ${doneCount}/${roundGames.length} games complete`
                : `Round ${t.current_round || 0} of ${t.rounds} · ${doneCount}/${roundGames.length} games complete`}
            </p>
          </header>

          {visible.length > 0 ? (
            <section className="space-y-4">
              <div className="aspect-square w-full max-w-[520px]">
                <Chessboard
                  options={{
                    ...boardSquares,
                    position: visible[0]!.fen,
                    boardOrientation: "white",
                    allowDragging: false,
                    id: `tboard-featured-${visible[0]!.id}`,
                  }}
                />
              </div>
              {visible.length > 1 && (
                <div className="grid grid-cols-3 gap-3">
                  {visible.slice(1).map((b) => (
                    <Link key={b.id} to="/spectate/$gameId" params={{ gameId: b.id }} className="block">
                      <Chessboard
                        options={{
                          ...boardSquares,
                          position: b.fen,
                          boardOrientation: "white",
                          allowDragging: false,
                          id: `tboard-${b.id}`,
                        }}
                      />
                    </Link>
                  ))}
                </div>
              )}
              {pageCount > 1 && (
                <p className="text-xs text-muted-foreground">
                  Showing boards {boardPage * 4 + 1}–{boardPage * 4 + visible.length} of {boards.length}, cycling.
                </p>
              )}
            </section>
          ) : (
            <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
              No live boards right now.
            </p>
          )}

          <section className="mt-6">
            <h2 className="mb-2 font-serif text-xl font-bold">
              {t.type === "arena" ? "Recent pairings" : `Round ${t.current_round || 0} pairings`}
            </h2>
            <div className="grid gap-2">
              {roundGames.length === 0 && (
                <p className="text-sm text-muted-foreground">Pairings appear when the round starts.</p>
              )}
              {roundGames.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <span>
                    {names[g.white_id ?? ""] ?? "—"} vs {names[g.black_id ?? ""] ?? "—"}
                  </span>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    {g.result
                      ? g.result === "draw"
                        ? "½–½"
                        : g.result === "white"
                          ? "1–0"
                          : "0–1"
                      : "in progress"}
                    {g.game_id && (
                      <Link
                        to="/spectate/$gameId"
                        params={{ gameId: g.game_id }}
                        className="text-primary hover:underline"
                      >
                        watch
                      </Link>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Standings ({standings.length}/{t.max_players})
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1">#</th>
                  <th>Player</th>
                  <th className="text-right">Pts</th>
                  <th className="text-right">TB</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.id} className={s.status !== "active" ? "text-muted-foreground line-through" : ""}>
                    <td className="py-1">{i + 1}</td>
                    <td>
                      <Link
                        to="/profile/$username"
                        params={{ username: names[s.user_id] ?? "" }}
                        className="hover:text-primary"
                      >
                        {names[s.user_id] ?? "—"}
                      </Link>
                    </td>
                    <td className="text-right font-semibold">{Number(s.score)}</td>
                    <td className="text-right text-muted-foreground">{Number(s.buchholz)}</td>
                  </tr>
                ))}
                {standings.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-2 text-muted-foreground">No entrants yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex h-[340px] flex-col rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tournament chat
            </p>
            <div className="flex-1 space-y-1.5 overflow-y-auto text-sm">
              {(chatQuery.data ?? []).length === 0 && (
                <p className="text-muted-foreground">No messages yet.</p>
              )}
              {(chatQuery.data ?? []).map((m) => (
                <p key={m.id}>
                  <span className="font-semibold text-primary">{names[m.user_id] ?? "Player"}</span>{" "}
                  <span>{m.content}</span>
                </p>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendChat();
                }}
                placeholder={user ? "Say something…" : "Sign in to chat"}
                disabled={!user}
                maxLength={300}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              />
              <button
                onClick={() => void sendChat()}
                disabled={!user || !draft.trim()}
                className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
