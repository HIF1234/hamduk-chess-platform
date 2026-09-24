// Admin dashboard: growth metrics, community moderation, announcements and
// reported-content actions. Every function is gated by requireAdminRole() and
// every mutation is written to admin_audit_log.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminRole } from "@/lib/admin-middleware";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function audit(params: Parameters<typeof import("@/lib/admin.server").logAdminAction>[0]) {
  const { logAdminAction } = await import("@/lib/admin.server");
  await logAdminAction(params);
}

const dayMs = 86_400_000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

/** Sign-ups, activity, memberships, referrals and engagement. */
export const getGrowthStats = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("support")])
  .handler(async () => {
    const s = await db();
    const head = { count: "exact" as const, head: true };
    const [
      { data: signups },
      dau,
      wau,
      mau,
      totalPlayers,
      guests,
      plus,
      gold,
      { data: expiring },
      { data: referrals },
      bots24,
      online24,
      puzzles24,
      { data: badges },
    ] = await Promise.all([
      s
        .from("profiles")
        .select("created_at, is_guest")
        .gte("created_at", iso(30 * dayMs))
        .limit(20000),
      s.from("profiles").select("id", head).gte("last_active_at", iso(dayMs)),
      s
        .from("profiles")
        .select("id", head)
        .gte("last_active_at", iso(7 * dayMs)),
      s
        .from("profiles")
        .select("id", head)
        .gte("last_active_at", iso(30 * dayMs)),
      s.from("profiles").select("id", head).eq("is_guest", false),
      s.from("profiles").select("id", head).eq("is_guest", true),
      s.from("profiles").select("id", head).eq("subscription_tier", "plus"),
      s.from("profiles").select("id", head).eq("subscription_tier", "gold"),
      s
        .from("profiles")
        .select("id, username, subscription_tier, subscription_renews_at")
        .neq("subscription_tier", "free")
        .gte("subscription_renews_at", new Date().toISOString())
        .lte("subscription_renews_at", new Date(Date.now() + 7 * dayMs).toISOString())
        .order("subscription_renews_at")
        .limit(50),
      s.from("referral_events").select("referrer_id, reward_days").limit(5000),
      s.from("bot_games").select("id", head).gte("created_at", iso(dayMs)),
      s.from("games").select("id", head).gte("created_at", iso(dayMs)),
      s.from("puzzle_attempts").select("id", head).gte("created_at", iso(dayMs)),
      s.from("user_achievements").select("achievement_slug").limit(20000),
    ]);

    const byDay = new Map<string, { players: number; guests: number }>();
    for (let i = 29; i >= 0; i--)
      byDay.set(new Date(Date.now() - i * dayMs).toISOString().slice(0, 10), {
        players: 0,
        guests: 0,
      });
    for (const p of signups ?? []) {
      const d = byDay.get(p.created_at.slice(0, 10));
      if (d) d[p.is_guest ? "guests" : "players"] += 1;
    }

    const refCount = new Map<string, number>();
    for (const r of referrals ?? [])
      refCount.set(r.referrer_id, (refCount.get(r.referrer_id) ?? 0) + 1);
    const topIds = [...refCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const { data: refNames } = topIds.length
      ? await s
          .from("profiles")
          .select("id, username")
          .in(
            "id",
            topIds.map(([id]) => id),
          )
      : { data: [] };
    const nameOf = new Map((refNames ?? []).map((n) => [n.id, n.username]));

    const badgeCount = new Map<string, number>();
    for (const b of badges ?? [])
      badgeCount.set(b.achievement_slug, (badgeCount.get(b.achievement_slug) ?? 0) + 1);

    return {
      signupsByDay: [...byDay.entries()].map(([day, v]) => ({ day, ...v })),
      active: { day: dau.count ?? 0, week: wau.count ?? 0, month: mau.count ?? 0 },
      players: totalPlayers.count ?? 0,
      guests: guests.count ?? 0,
      members: { plus: plus.count ?? 0, gold: gold.count ?? 0 },
      expiringSoon: expiring ?? [],
      topReferrers: topIds.map(([id, n]) => ({ username: nameOf.get(id) ?? "—", conversions: n })),
      referralConversions: referrals?.length ?? 0,
      last24h: {
        botGames: bots24.count ?? 0,
        onlineGames: online24.count ?? 0,
        puzzles: puzzles24.count ?? 0,
      },
      badges: [...badgeCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
      badgesTotal: badges?.length ?? 0,
    };
  });

/** Recent forum threads including deleted ones, for moderators. */
export const listForumThreadsAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("moderator")])
  .handler(async () => {
    const s = await db();
    const { data } = await s
      .from("forum_threads")
      .select(
        "id, title, category, pinned, locked, reply_count, views, deleted_at, last_reply_at, profiles!forum_threads_author_id_fkey(username)",
      )
      .order("last_reply_at", { ascending: false })
      .limit(100);
    return (data ?? []) as unknown as {
      id: string;
      title: string;
      category: string;
      pinned: boolean;
      locked: boolean;
      reply_count: number;
      views: number;
      deleted_at: string | null;
      last_reply_at: string;
      profiles: { username: string } | null;
    }[];
  });

export const moderateThreadAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("moderator")])
  .inputValidator((d) =>
    z
      .object({
        threadId: z.string().uuid(),
        action: z.enum(["pin", "unpin", "lock", "unlock", "delete", "restore"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await db();
    const patch =
      data.action === "delete"
        ? { deleted_at: new Date().toISOString() }
        : data.action === "restore"
          ? { deleted_at: null }
          : data.action === "pin" || data.action === "unpin"
            ? { pinned: data.action === "pin" }
            : { locked: data.action === "lock" };
    await s.from("forum_threads").update(patch).eq("id", data.threadId);
    await audit({
      adminId: context.userId,
      action: `forum.${data.action}`,
      targetTable: "forum_threads",
      targetId: data.threadId,
    });
    return { ok: true };
  });

export const listClubsAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("moderator")])
  .handler(async () => {
    const s = await db();
    const { data } = await s
      .from("clubs")
      .select(
        "id, slug, name, visibility, min_tier, is_official, member_count, created_at, owner_id",
      )
      .order("member_count", { ascending: false })
      .limit(200);
    const owners = [
      ...new Set((data ?? []).map((c) => c.owner_id).filter((x): x is string => !!x)),
    ];
    const { data: names } = owners.length
      ? await s.from("profiles").select("id, username").in("id", owners)
      : { data: [] };
    const nameOf = new Map((names ?? []).map((n) => [n.id, n.username]));
    return (data ?? []).map((c) => ({
      ...c,
      owner: c.owner_id ? (nameOf.get(c.owner_id) ?? "—") : "—",
    }));
  });

export const updateClubAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("admin")])
  .inputValidator((d) =>
    z
      .object({ clubId: z.string().uuid(), action: z.enum(["official", "unofficial", "delete"]) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await db();
    const { data: before } = await s
      .from("clubs")
      .select("name, slug, is_official")
      .eq("id", data.clubId)
      .maybeSingle();
    if (!before) throw new Error("Club not found");
    if (data.action === "delete") {
      if (before.slug === "hamdukchessclub")
        throw new Error("The official HamdukChessClub can't be deleted.");
      await s.from("clubs").delete().eq("id", data.clubId);
    } else {
      await s
        .from("clubs")
        .update({ is_official: data.action === "official" })
        .eq("id", data.clubId);
    }
    await audit({
      adminId: context.userId,
      action: `club.${data.action}`,
      targetTable: "clubs",
      targetId: data.clubId,
      before,
    });
    return { ok: true };
  });

export const listCommentators = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("admin")])
  .handler(async () => {
    const s = await db();
    const { data } = await s
      .from("tv_commentators")
      .select("user_id, created_at, profiles!tv_commentators_user_id_fkey(username)")
      .order("created_at", { ascending: false });
    return (data ?? []) as unknown as {
      user_id: string;
      created_at: string;
      profiles: { username: string } | null;
    }[];
  });

export const setCommentatorAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("admin")])
  .inputValidator((d) =>
    z.object({ username: z.string().trim().min(2).max(40), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await db();
    const { data: target } = await s
      .from("profiles")
      .select("id")
      .ilike("username", data.username)
      .maybeSingle();
    if (!target) throw new Error("No player with that username.");
    if (data.enabled) {
      await s
        .from("tv_commentators")
        .upsert({ user_id: target.id, added_by: context.userId }, { onConflict: "user_id" });
    } else {
      await s.from("tv_commentators").delete().eq("user_id", target.id);
    }
    await audit({
      adminId: context.userId,
      action: data.enabled ? "tv.commentator_added" : "tv.commentator_removed",
      targetTable: "profiles",
      targetId: target.id,
    });
    return { ok: true };
  });

/** In-app announcement to all registered players, or one membership group. */
export const sendAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("admin")])
  .inputValidator((d) =>
    z
      .object({
        audience: z.enum(["all", "free", "plus", "gold", "paid"]),
        title: z.string().trim().min(4).max(120),
        body: z.string().trim().max(500).optional(),
        link: z
          .string()
          .trim()
          .regex(/^\/[A-Za-z0-9/_\-?=&.%+]*$/, "Use a site path like /tournaments")
          .optional()
          .or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await db();
    let q = s.from("profiles").select("id").eq("is_guest", false);
    if (data.audience === "paid") q = q.neq("subscription_tier", "free");
    else if (data.audience !== "all") q = q.eq("subscription_tier", data.audience);
    const { data: people } = await q.limit(50_000);
    const ids = (people ?? []).map((p) => p.id);
    for (let i = 0; i < ids.length; i += 500) {
      const rows = ids.slice(i, i + 500).map((user_id) => ({
        user_id,
        type: "announcement",
        title: data.title,
        body: data.body || null,
        link: data.link || null,
      }));
      const { error } = await s.from("notifications").insert(rows);
      if (error) throw new Error(error.message);
    }
    await audit({
      adminId: context.userId,
      action: "announcement.sent",
      targetTable: "notifications",
      after: { audience: data.audience, title: data.title, recipients: ids.length },
    });
    return { recipients: ids.length };
  });

/** What a report points at, so moderators can judge it without hunting. */
export const getReportTargets = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("support")])
  .inputValidator((d) =>
    z.object({ items: z.array(z.object({ type: z.string(), id: z.string() })).max(50) }).parse(d),
  )
  .handler(async ({ data }) => {
    const s = await db();
    const out: Record<
      string,
      { label: string; href?: string; content?: string; removable?: boolean }
    > = {};
    for (const it of data.items) {
      const key = `${it.type}:${it.id}`;
      if (it.type === "user") {
        const { data: p } = await s
          .from("profiles")
          .select("username")
          .eq("id", it.id)
          .maybeSingle();
        out[key] = {
          label: p ? `Player ${p.username}` : "Player (deleted)",
          href: `/admin/users/${it.id}`,
        };
      } else if (it.type === "game") {
        out[key] = { label: "Game", href: `/spectate/${it.id}` };
      } else if (it.type === "forum_post") {
        const { data: p } = await s
          .from("forum_posts")
          .select("content, deleted_at, thread_id, profiles!forum_posts_author_id_fkey(username)")
          .eq("id", it.id)
          .maybeSingle();
        const author = (p?.profiles as unknown as { username: string } | null)?.username ?? "—";
        out[key] = p
          ? {
              label: `Forum post by ${author}${p.deleted_at ? " (already deleted)" : ""}`,
              href: `/forums/thread/${p.thread_id}`,
              content: p.content.slice(0, 400),
              removable: !p.deleted_at,
            }
          : { label: "Forum post (gone)" };
      } else if (it.type === "club_post") {
        const { data: p } = await s
          .from("club_posts")
          .select("content, club_id")
          .eq("id", it.id)
          .maybeSingle();
        out[key] = p
          ? { label: "Club post", content: p.content.slice(0, 400), removable: true }
          : { label: "Club post (gone)" };
      } else if (it.type === "message") {
        const { data: m } = await s
          .from("messages")
          .select("content")
          .eq("id", it.id)
          .maybeSingle();
        out[key] = { label: "Direct message", content: m?.content.slice(0, 400) };
      } else {
        out[key] = { label: it.type };
      }
    }
    return out;
  });

/** Removes reported forum/club content and resolves the report. */
export const removeReportedContent = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("moderator")])
  .inputValidator((d) => z.object({ reportId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await db();
    const { data: r } = await s
      .from("reports")
      .select("target_type, target_id")
      .eq("id", data.reportId)
      .maybeSingle();
    if (!r) throw new Error("Report not found");
    if (r.target_type === "forum_post") {
      await s
        .from("forum_posts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", r.target_id);
    } else if (r.target_type === "club_post") {
      await s.from("club_posts").delete().eq("id", r.target_id);
    } else {
      throw new Error("Only posts can be removed from here.");
    }
    await s
      .from("reports")
      .update({
        status: "resolved",
        resolution_note: "Content removed",
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.reportId);
    await audit({
      adminId: context.userId,
      action: "report.content_removed",
      targetTable: r.target_type,
      targetId: r.target_id,
    });
    return { ok: true };
  });
