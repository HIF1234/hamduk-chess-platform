import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Side = {
  username: string;
  country: string | null;
  ratings: { time_control: string; variant: string; rating: number; games_played: number }[];
  record: { wins: number; losses: number; draws: number; games: number };
  accuracy: number | null;
  openings: { name: string; games: number }[];
};

/** Side-by-side stats for two players plus their head-to-head history. Public data only. */
export const comparePlayers = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .object({
        a: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9_.-]{2,40}$/),
        b: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9_.-]{2,40}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const s = await db();
    const { data: people } = await s
      .from("profiles")
      .select("id, username, country, wins, losses, draws, games_played, is_guest")
      // ilike for case-insensitivity; the exact-match find below drops any wildcard hits.
      .or(`username.ilike.${data.a},username.ilike.${data.b}`);
    const pa = people?.find((p) => p.username.toLowerCase() === data.a.toLowerCase());
    const pb = people?.find((p) => p.username.toLowerCase() === data.b.toLowerCase());
    if (!pa || !pb) return { error: "One of those players doesn't exist." as const };

    async function side(p: NonNullable<typeof pa>): Promise<Side> {
      const [{ data: ratings }, { data: games }] = await Promise.all([
        s
          .from("ratings")
          .select("time_control, variant, rating, games_played")
          .eq("user_id", p.id)
          .gt("games_played", 0),
        s
          .from("games")
          .select("id, white_id")
          .eq("status", "completed")
          .or(`white_id.eq.${p.id},black_id.eq.${p.id}`)
          .order("ended_at", { ascending: false })
          .limit(100),
      ]);
      const ids = (games ?? []).map((g) => g.id);
      const whiteOf = new Map((games ?? []).map((g) => [g.id, g.white_id === p.id]));
      const { data: analyses } = ids.length
        ? await s
            .from("game_analysis")
            .select("game_id, accuracy_white, accuracy_black, opening_name")
            .in("game_id", ids)
        : { data: [] };
      const accs: number[] = [];
      const openings = new Map<string, number>();
      for (const a of analyses ?? []) {
        const acc = whiteOf.get(a.game_id) ? a.accuracy_white : a.accuracy_black;
        if (acc !== null && acc !== undefined) accs.push(Number(acc));
        if (a.opening_name) openings.set(a.opening_name, (openings.get(a.opening_name) ?? 0) + 1);
      }
      return {
        username: p.username,
        country: p.country,
        ratings: (ratings ?? []).sort((x, y) => y.games_played - x.games_played),
        record: { wins: p.wins, losses: p.losses, draws: p.draws, games: p.games_played },
        accuracy: accs.length
          ? Math.round((accs.reduce((t, x) => t + x, 0) / accs.length) * 10) / 10
          : null,
        openings: [...openings.entries()]
          .sort((x, y) => y[1] - x[1])
          .slice(0, 3)
          .map(([name, games]) => ({ name, games })),
      };
    }

    const { data: h2h } = await s
      .from("games")
      .select("id, white_id, winner_id, result, end_reason, time_control, ended_at")
      .eq("status", "completed")
      .or(
        `and(white_id.eq.${pa.id},black_id.eq.${pb.id}),and(white_id.eq.${pb.id},black_id.eq.${pa.id})`,
      )
      .order("ended_at", { ascending: false })
      .limit(20);
    const score = { a: 0, b: 0, draws: 0 };
    for (const g of h2h ?? []) {
      if (g.winner_id === pa.id) score.a++;
      else if (g.winner_id === pb.id) score.b++;
      else score.draws++;
    }
    return {
      a: await side(pa),
      b: await side(pb),
      headToHead: {
        score,
        games: (h2h ?? []).map((g) => ({
          id: g.id,
          aWhite: g.white_id === pa.id,
          winner: g.winner_id === pa.id ? "a" : g.winner_id === pb.id ? "b" : "draw",
          endReason: g.end_reason,
          timeControl: g.time_control,
          endedAt: g.ended_at,
        })),
      },
    };
  });
