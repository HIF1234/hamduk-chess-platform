import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TIER_RANK = { free: 0, plus: 1, gold: 2 } as const;
type Tier = keyof typeof TIER_RANK;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function myTier(userId: string): Promise<Tier> {
  const db = await admin();
  const { data } = await db
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .maybeSingle();
  return (data?.subscription_tier ?? "free") as Tier;
}

async function assertClubAdmin(clubId: string, userId: string) {
  const db = await admin();
  const { data: club } = await db.from("clubs").select("owner_id").eq("id", clubId).maybeSingle();
  if (!club) throw new Error("Club not found");
  if (club.owner_id === userId) return;
  const { data: m } = await db
    .from("club_members")
    .select("role, status")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!m || m.status !== "approved" || !["owner", "admin"].includes(m.role)) {
    throw new Error("Only club admins can do that.");
  }
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export const createClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(3).max(60),
        description: z.string().max(1000).optional(),
        visibility: z.enum(["public", "private"]).default("public"),
        minTier: z.enum(["free", "plus", "gold"]).default("free"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const base = slugify(data.name) || `club-${Date.now()}`;
    let slug = base;
    for (let i = 1; i < 20; i++) {
      const { data: taken } = await db.from("clubs").select("id").eq("slug", slug).maybeSingle();
      if (!taken) break;
      slug = `${base}-${i}`;
    }
    const { data: club, error } = await db
      .from("clubs")
      .insert({
        owner_id: context.userId,
        slug,
        name: data.name,
        description: data.description ?? null,
        visibility: data.visibility,
        min_tier: data.minTier,
        member_count: 1,
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    await db.from("club_members").insert({
      club_id: club.id,
      user_id: context.userId,
      role: "owner",
      status: "approved",
    });
    return { id: club.id as string, slug: club.slug as string };
  });

export const joinClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clubId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const db = await admin();
    const { data: club } = await db
      .from("clubs")
      .select("id, visibility, min_tier, member_count")
      .eq("id", data.clubId)
      .maybeSingle();
    if (!club) throw new Error("Club not found");

    const { data: ban } = await db
      .from("club_bans")
      .select("id, appeal_status")
      .eq("club_id", club.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (ban) throw new Error("You are banned from this club. You can file an appeal.");

    const tier = await myTier(userId);
    if (TIER_RANK[tier] < TIER_RANK[club.min_tier as Tier]) {
      throw new Error(`This club is for ${club.min_tier} members and above.`);
    }

    const status = club.visibility === "public" ? "approved" : "pending";
    const { error } = await db
      .from("club_members")
      .upsert(
        { club_id: club.id, user_id: userId, role: "member", status },
        { onConflict: "club_id,user_id" },
      );
    if (error) throw new Error(error.message);
    if (status === "approved") {
      await db.from("clubs").update({ member_count: club.member_count + 1 }).eq("id", club.id);
    }
    return { status };
  });

export const leaveClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clubId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: club } = await db
      .from("clubs")
      .select("owner_id, member_count")
      .eq("id", data.clubId)
      .maybeSingle();
    if (club?.owner_id === context.userId) throw new Error("Transfer ownership before leaving.");
    await db
      .from("club_members")
      .delete()
      .eq("club_id", data.clubId)
      .eq("user_id", context.userId);
    await db
      .from("clubs")
      .update({ member_count: Math.max(0, (club?.member_count ?? 1) - 1) })
      .eq("id", data.clubId);
    return { ok: true };
  });

export const moderateClubMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clubId: z.string().uuid(),
        userId: z.string().uuid(),
        action: z.enum(["approve", "reject", "promote", "demote", "mute", "unmute", "remove", "ban"]),
        muteHours: z.number().int().min(1).max(720).optional(),
        reason: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertClubAdmin(data.clubId, context.userId);
    const db = await admin();
    const where = { club_id: data.clubId, user_id: data.userId };

    if (data.action === "approve") {
      await db.from("club_members").update({ status: "approved" }).match(where);
      const { count } = await db
        .from("club_members")
        .select("id", { count: "exact", head: true })
        .eq("club_id", data.clubId)
        .eq("status", "approved");
      await db.from("clubs").update({ member_count: count ?? 0 }).eq("id", data.clubId);
    } else if (data.action === "reject" || data.action === "remove") {
      await db.from("club_members").delete().match(where);
    } else if (data.action === "promote") {
      await db.from("club_members").update({ role: "admin" }).match(where);
    } else if (data.action === "demote") {
      await db.from("club_members").update({ role: "member" }).match(where);
    } else if (data.action === "mute") {
      const until = new Date(Date.now() + (data.muteHours ?? 24) * 3600_000).toISOString();
      await db.from("club_members").update({ muted_until: until }).match(where);
    } else if (data.action === "unmute") {
      await db.from("club_members").update({ muted_until: null }).match(where);
    } else if (data.action === "ban") {
      await db.from("club_members").delete().match(where);
      await db.from("club_bans").upsert(
        {
          club_id: data.clubId,
          user_id: data.userId,
          reason: data.reason ?? null,
          banned_by: context.userId,
          appeal_status: "none",
        },
        { onConflict: "club_id,user_id" },
      );
    }
    return { ok: true };
  });

export const appealClubBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ clubId: z.string().uuid(), text: z.string().min(10).max(1000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db
      .from("club_bans")
      .update({ appeal_text: data.text, appeal_status: "pending" })
      .eq("club_id", data.clubId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const decideClubAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clubId: z.string().uuid(),
        userId: z.string().uuid(),
        accept: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertClubAdmin(data.clubId, context.userId);
    const db = await admin();
    if (data.accept) {
      await db.from("club_bans").delete().eq("club_id", data.clubId).eq("user_id", data.userId);
    } else {
      await db
        .from("club_bans")
        .update({ appeal_status: "rejected" })
        .eq("club_id", data.clubId)
        .eq("user_id", data.userId);
    }
    return { ok: true };
  });

export const postToClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ clubId: z.string().uuid(), content: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: m } = await db
      .from("club_members")
      .select("status, muted_until")
      .eq("club_id", data.clubId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!m || m.status !== "approved") throw new Error("Join the club to post.");
    if (m.muted_until && new Date(m.muted_until) > new Date()) {
      throw new Error("You are muted in this club.");
    }
    const { error } = await db
      .from("club_posts")
      .insert({ club_id: data.clubId, user_id: context.userId, content: data.content });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moderateClubPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clubId: z.string().uuid(),
        postId: z.string().uuid(),
        action: z.enum(["pin", "unpin", "delete"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertClubAdmin(data.clubId, context.userId);
    const db = await admin();
    if (data.action === "delete") {
      await db.from("club_posts").delete().eq("id", data.postId).eq("club_id", data.clubId);
    } else {
      await db
        .from("club_posts")
        .update({ pinned: data.action === "pin" })
        .eq("id", data.postId)
        .eq("club_id", data.clubId);
    }
    return { ok: true };
  });

/** Owner/admin analytics: member activity, games played, tournament participation. */
export const getClubAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clubId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertClubAdmin(data.clubId, context.userId);
    const db = await admin();
    const { data: members } = await db
      .from("club_members")
      .select("user_id, role, status, created_at")
      .eq("club_id", data.clubId)
      .eq("status", "approved");
    const ids = (members ?? []).map((m) => m.user_id);
    if (!ids.length) {
      return { members: [], totals: { members: 0, games: 0, tournamentEntries: 0, posts: 0 } };
    }
    const [{ data: profs }, { data: entries }, { count: posts }] = await Promise.all([
      db.from("profiles").select("id, username, games_played, rating, last_active_at").in("id", ids),
      db.from("tournament_players").select("user_id, tournament_id").in("user_id", ids),
      db
        .from("club_posts")
        .select("id", { count: "exact", head: true })
        .eq("club_id", data.clubId),
    ]);
    const entriesByUser = new Map<string, number>();
    for (const e of entries ?? []) {
      entriesByUser.set(e.user_id, (entriesByUser.get(e.user_id) ?? 0) + 1);
    }
    const rows = (profs ?? []).map((p) => ({
      user_id: p.id,
      username: p.username,
      rating: p.rating,
      games_played: p.games_played,
      last_active_at: p.last_active_at,
      tournament_entries: entriesByUser.get(p.id) ?? 0,
    }));
    return {
      members: rows,
      totals: {
        members: rows.length,
        games: rows.reduce((a, r) => a + r.games_played, 0),
        tournamentEntries: (entries ?? []).length,
        posts: posts ?? 0,
      },
    };
  });

/** Gold members belong to the official club automatically (badge + class sessions). */
export const syncOfficialClubMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tier = await myTier(context.userId);
    if (tier !== "gold") return { joined: false };
    const db = await admin();
    const { data: club } = await db
      .from("clubs")
      .select("id, member_count")
      .eq("slug", "hamdukchessclub")
      .maybeSingle();
    if (!club) return { joined: false };
    const { data: existing } = await db
      .from("club_members")
      .select("id")
      .eq("club_id", club.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) return { joined: true };
    await db
      .from("club_members")
      .insert({ club_id: club.id, user_id: context.userId, role: "member", status: "approved" });
    await db.from("clubs").update({ member_count: club.member_count + 1 }).eq("id", club.id);
    return { joined: true };
  });
