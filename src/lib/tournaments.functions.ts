import { createServerFn } from "@tanstack/react-start";
import { TIME_CONTROL_IDS } from "@/lib/time-controls";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CREATE_LIMITS } from "./tournament-config";

const TypeEnum = z.enum(["swiss", "arena", "round_robin", "knockout"]);

async function readProfile(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, username, subscription_tier, rating")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

async function isAdmin(userId: string) {
  const { lookupAdminRole, hasRank } = await import("@/lib/admin-middleware");
  return hasRank(await lookupAdminRole(userId), "moderator");
}

export const createTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(3).max(80),
        description: z.string().max(500).optional(),
        type: TypeEnum,
        timeControl: z.enum(TIME_CONTROL_IDS),
        variant: z.enum(["standard", "chess960"]).default("standard"),
        rated: z.boolean().default(true),
        rounds: z.number().int().min(1).max(15).default(5),
        startsAt: z.string().min(4),
        durationMin: z.number().int().min(15).max(360).default(60),
        maxPlayers: z.number().int().min(2).max(256).default(32),
        minTier: z.enum(["free", "plus", "gold"]).default("free"),
        entryFeeKobo: z.number().int().min(0).max(10_000_000).default(0),
        clubId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const profile = await readProfile(userId);
    const tier = (profile?.subscription_tier ?? "free") as keyof typeof CREATE_LIMITS;
    const cap = CREATE_LIMITS[tier];
    if (!cap) {
      throw new Error("Creating tournaments requires a Plus or Gold membership.");
    }
    if (data.maxPlayers > cap) {
      throw new Error(`Your plan allows up to ${cap} players per tournament.`);
    }

    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new Error("Invalid start time");

    const { data: row, error } = await supabaseAdmin
      .from("tournaments")
      .insert({
        creator_id: userId,
        club_id: data.clubId ?? null,
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        time_control: data.timeControl,
        variant: data.variant,
        rated: data.rated,
        rounds: data.type === "arena" ? 1 : data.rounds,
        starts_at: startsAt.toISOString(),
        duration_min: data.durationMin,
        max_players: data.maxPlayers,
        min_tier: data.minTier,
        entry_fee_kobo: data.entryFeeKobo,
        status: "scheduled",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const joinTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tournamentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const profile = await readProfile(userId);
    const tier = profile?.subscription_tier ?? "free";

    const { data: t } = await supabaseAdmin
      .from("tournaments")
      .select("id, status, max_players, min_tier, entry_fee_kobo, time_control, variant")
      .eq("id", data.tournamentId)
      .maybeSingle();
    if (!t) throw new Error("Tournament not found");
    if (t.status !== "scheduled") throw new Error("Registration is closed for this tournament.");

    const rank = { free: 0, plus: 1, gold: 2 } as const;
    if (rank[tier as "free"] < rank[t.min_tier as "free"]) {
      throw new Error(`This tournament is for ${t.min_tier} members and above.`);
    }
    if (t.entry_fee_kobo > 0 && tier === "free") {
      throw new Error("Free accounts can only join tournaments without an entry fee.");
    }

    const { count } = await supabaseAdmin
      .from("tournament_players")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", t.id);
    if ((count ?? 0) >= t.max_players) throw new Error("This tournament is full.");

    const { data: rating } = await supabaseAdmin
      .from("ratings")
      .select("rating")
      .eq("user_id", userId)
      .eq("time_control", t.time_control)
      .eq("variant", t.variant)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("tournament_players").insert({
      tournament_id: t.id,
      user_id: userId,
      rating_at_join: rating?.rating ?? profile?.rating ?? 1200,
      seed: (count ?? 0) + 1,
      paid: t.entry_fee_kobo === 0,
    });
    if (error) {
      if (error.code === "23505" || error.message.includes("duplicate")) {
        return { ok: true, alreadyJoined: true, requiresPayment: false };
      }
      throw new Error(error.message);
    }
    return { ok: true, alreadyJoined: false, requiresPayment: t.entry_fee_kobo > 0 };
  });

export const withdrawFromTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tournamentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin
      .from("tournaments")
      .select("status")
      .eq("id", data.tournamentId)
      .maybeSingle();
    if (t?.status === "scheduled") {
      await supabaseAdmin
        .from("tournament_players")
        .delete()
        .eq("tournament_id", data.tournamentId)
        .eq("user_id", context.userId);
    } else {
      await supabaseAdmin
        .from("tournament_players")
        .update({ status: "withdrawn" })
        .eq("tournament_id", data.tournamentId)
        .eq("user_id", context.userId);
    }
    return { ok: true };
  });

/** Creator or admin may start early; the sweep starts it automatically at start time. */
export const startTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tournamentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin
      .from("tournaments")
      .select("id, creator_id, type, status, current_round")
      .eq("id", data.tournamentId)
      .maybeSingle();
    if (!t) throw new Error("Tournament not found");
    if (t.creator_id !== userId && !(await isAdmin(userId))) {
      throw new Error("Only the organiser can start this tournament.");
    }
    if (t.status === "completed") throw new Error("Tournament already finished.");
    const { generateRound, pairArena } = await import("@/lib/tournaments.server");
    if (t.type === "arena") return await pairArena(t.id);
    return await generateRound(t.id, Math.max(1, t.current_round || 1));
  });

export const closeTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tournamentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin
      .from("tournaments")
      .select("id, creator_id")
      .eq("id", data.tournamentId)
      .maybeSingle();
    if (!t) throw new Error("Tournament not found");
    const admin = await isAdmin(userId);
    if (t.creator_id !== userId && !admin) throw new Error("Not allowed");
    await supabaseAdmin.from("tournaments").update({ status: "completed" }).eq("id", t.id);
    if (admin) {
      await supabaseAdmin.from("admin_audit_log").insert({
        admin_id: userId,
        action: "tournament.force_close",
        target_table: "tournaments",
        target_id: t.id,
      });
    }
    return { ok: true };
  });

/** Admin-only result override; recomputes scores and tie-breaks. */
export const overrideTournamentResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        tournamentGameId: z.string().uuid(),
        result: z.enum(["white", "black", "draw"]),
        reason: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (!(await isAdmin(userId))) throw new Error("Administrator access required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recomputeTiebreaks } = await import("@/lib/tournaments.server");

    const { data: tg } = await supabaseAdmin
      .from("tournament_games")
      .select("id, tournament_id, white_id, black_id, result, recorded")
      .eq("id", data.tournamentGameId)
      .maybeSingle();
    if (!tg) throw new Error("Pairing not found");

    const points = (result: string, isWhite: boolean) =>
      result === "draw" ? 0.5 : (result === "white") === isWhite ? 1 : 0;

    const { data: entries } = await supabaseAdmin
      .from("tournament_players")
      .select("id, user_id, score, games_played")
      .eq("tournament_id", tg.tournament_id)
      .in("user_id", [tg.white_id, tg.black_id].filter(Boolean) as string[]);

    for (const e of entries ?? []) {
      const isWhite = e.user_id === tg.white_id;
      const old = tg.result ? points(tg.result, isWhite) : 0;
      const next = points(data.result, isWhite);
      await supabaseAdmin
        .from("tournament_players")
        .update({
          score: Number(e.score) - old + next,
          games_played: tg.recorded ? e.games_played : e.games_played + 1,
        })
        .eq("id", e.id);
    }

    await supabaseAdmin
      .from("tournament_games")
      .update({ result: data.result, recorded: true })
      .eq("id", tg.id);
    await recomputeTiebreaks(tg.tournament_id);
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: userId,
      action: "tournament.override_result",
      target_table: "tournament_games",
      target_id: tg.id,
      before: { result: tg.result },
      after: { result: data.result },
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

/** Paystack checkout for a paid entry. Registration is confirmed on verify. */
export const payTournamentEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        tournamentId: z.string().uuid(),
        callback_url: z.string().url().max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { PAYSTACK_BASE, getPaystackSecret } = await import("@/lib/paystack.server");

    const { data: t } = await supabaseAdmin
      .from("tournaments")
      .select("id, name, entry_fee_kobo")
      .eq("id", data.tournamentId)
      .maybeSingle();
    if (!t) throw new Error("Tournament not found");
    if (t.entry_fee_kobo <= 0) return { authorization_url: null, reference: null };

    const profile = await readProfile(userId);
    const { data: userRes } = await supabase.auth.getUser();
    const email = userRes.user?.email ?? `${profile?.username ?? "player"}+guest@hamdukchess.local`;
    const reference = `ht_${t.id.slice(0, 8)}_${userId.slice(0, 8)}_${Date.now()}`;

    const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getPaystackSecret()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: t.entry_fee_kobo,
        currency: "NGN",
        reference,
        callback_url: data.callback_url,
        metadata: { user_id: userId, tournament_id: t.id, kind: "tournament_entry" },
      }),
    });
    const json = (await res.json()) as {
      status: boolean;
      message?: string;
      data?: { authorization_url: string; reference: string };
    };
    if (!res.ok || !json.status || !json.data) throw new Error(json.message || "Paystack failed");
    return { authorization_url: json.data.authorization_url, reference: json.data.reference };
  });

export const verifyTournamentEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ reference: z.string().min(4).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { PAYSTACK_BASE, getPaystackSecret } = await import("@/lib/paystack.server");
    const res = await fetch(
      `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(data.reference)}`,
      { headers: { Authorization: `Bearer ${getPaystackSecret()}` } },
    );
    const json = (await res.json()) as {
      status: boolean;
      data?: {
        status: string;
        reference: string;
        amount: number;
        currency: string;
        metadata?: { user_id?: string; tournament_id?: string };
      };
    };
    const tx = json.data;
    if (!res.ok || !json.status || !tx || tx.status !== "success") {
      return { ok: false as const };
    }
    if (tx.metadata?.user_id !== userId || !tx.metadata?.tournament_id) {
      return { ok: false as const };
    }
    await supabaseAdmin
      .from("tournament_players")
      .update({ paid: true, paystack_reference: tx.reference })
      .eq("tournament_id", tx.metadata.tournament_id)
      .eq("user_id", userId);
    await supabaseAdmin.from("payment_events").insert({
      user_id: userId,
      event: "tournament.entry_paid",
      reference: tx.reference,
      amount: tx.amount,
      currency: tx.currency,
      raw: { tournament_id: tx.metadata.tournament_id },
    });
    return { ok: true as const, tournamentId: tx.metadata.tournament_id };
  });

/** Admin view: recent tournaments with their pairings for overrides. */
export const adminListTournaments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Administrator access required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tournaments } = await supabaseAdmin
      .from("tournaments")
      .select("id, name, type, status, rounds, current_round, starts_at, entry_fee_kobo, max_players")
      .order("starts_at", { ascending: false })
      .limit(40);
    const ids = (tournaments ?? []).map((t) => t.id);
    const { data: pairings } = ids.length
      ? await supabaseAdmin
          .from("tournament_games")
          .select("id, tournament_id, round, white_id, black_id, result, recorded")
          .in("tournament_id", ids)
          .order("round", { ascending: false })
      : { data: [] as Array<Record<string, never>> };
    const userIds = Array.from(
      new Set(
        (pairings ?? []).flatMap((p) => [
          (p as { white_id: string | null }).white_id,
          (p as { black_id: string | null }).black_id,
        ]),
      ),
    ).filter(Boolean) as string[];
    const { data: profs } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, username").in("id", userIds)
      : { data: [] as Array<{ id: string; username: string }> };
    const names: Record<string, string> = {};
    for (const p of profs ?? []) names[p.id] = p.username;
    return {
      tournaments: tournaments ?? [],
      pairings: (pairings ?? []) as unknown as Array<{
        id: string;
        tournament_id: string;
        round: number;
        white_id: string | null;
        black_id: string | null;
        result: string | null;
        recorded: boolean;
      }>,
      names,
    };
  });
