import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FORUM_CATEGORIES, type ForumCategoryId } from "@/lib/forums";

const CategoryEnum = z.enum(
  FORUM_CATEGORIES.map((c) => c.id) as [ForumCategoryId, ...ForumCategoryId[]],
);

async function ctx(userId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [{ data: profile }, { data: role }] = await Promise.all([
    db.from("profiles").select("username, is_guest, banned_at").eq("id", userId).maybeSingle(),
    db.from("admin_roles").select("role").eq("user_id", userId).maybeSingle(),
  ]);
  const isMod = !!role && ["super_admin", "admin", "moderator"].includes(role.role);
  return { db, profile, isMod };
}

function assertCanPost(p: { is_guest: boolean; banned_at: string | null } | null) {
  if (!p) throw new Error("Profile not found");
  if (p.is_guest) throw new Error("Create a free account to post in the forums.");
  if (p.banned_at) throw new Error("Your account can't post right now.");
}

async function limit(userId: string, action: string, max: number, windowSec: number) {
  try {
    const { assertRate } = await import("@/lib/rate-limit.server");
    await assertRate(userId, action, max, windowSec);
  } catch (e) {
    // Only rate-limit errors should block posting; a Redis outage must not.
    if ((e as Error).message.startsWith("Rate limit")) throw e;
  }
}

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        category: CategoryEnum,
        title: z.string().trim().min(4).max(140),
        body: z.string().trim().min(1).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, profile } = await ctx(context.userId);
    assertCanPost(profile);
    await limit(context.userId, "forum-thread", 5, 3600);
    const { data: thread, error } = await db
      .from("forum_threads")
      .insert({ category: data.category, author_id: context.userId, title: data.title })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { error: postErr } = await db
      .from("forum_posts")
      .insert({ thread_id: thread.id, author_id: context.userId, content: data.body });
    if (postErr) throw new Error(postErr.message);
    return { id: thread.id };
  });

export const replyToThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        threadId: z.string().uuid(),
        content: z.string().trim().min(1).max(5000),
        parentPostId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, profile, isMod } = await ctx(context.userId);
    assertCanPost(profile);
    await limit(context.userId, "forum-post", 20, 600);
    const { data: thread } = await db
      .from("forum_threads")
      .select("id, title, author_id, locked, deleted_at, reply_count")
      .eq("id", data.threadId)
      .maybeSingle();
    if (!thread || thread.deleted_at) throw new Error("Thread not found");
    if (thread.locked && !isMod) throw new Error("This thread is locked.");

    let parentAuthor: string | null = null;
    if (data.parentPostId) {
      const { data: parent } = await db
        .from("forum_posts")
        .select("author_id, thread_id")
        .eq("id", data.parentPostId)
        .maybeSingle();
      if (!parent || parent.thread_id !== thread.id) throw new Error("Can't reply to that post.");
      parentAuthor = parent.author_id;
    }

    const { data: post, error } = await db
      .from("forum_posts")
      .insert({
        thread_id: thread.id,
        author_id: context.userId,
        content: data.content,
        parent_post_id: data.parentPostId ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await db
      .from("forum_threads")
      .update({ reply_count: thread.reply_count + 1, last_reply_at: new Date().toISOString() })
      .eq("id", thread.id);

    const { notify } = await import("@/lib/notifications.server");
    const who = profile?.username ?? "Someone";
    const recipients = new Set([thread.author_id, parentAuthor].filter((u): u is string => !!u));
    recipients.delete(context.userId);
    for (const r of recipients) {
      await notify(r, {
        type: "forum_reply",
        title: `${who} replied in “${thread.title.slice(0, 60)}”`,
        body: data.content.slice(0, 140),
        link: `/forums/thread/${thread.id}`,
      });
    }
    return { id: post.id };
  });

export const togglePostLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, profile } = await ctx(context.userId);
    assertCanPost(profile);
    const { data: existing } = await db
      .from("forum_post_likes")
      .select("post_id")
      .eq("post_id", data.postId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) {
      await db
        .from("forum_post_likes")
        .delete()
        .eq("post_id", data.postId)
        .eq("user_id", context.userId);
    } else {
      await db.from("forum_post_likes").insert({ post_id: data.postId, user_id: context.userId });
    }
    const { count } = await db
      .from("forum_post_likes")
      .select("post_id", { count: "exact", head: true })
      .eq("post_id", data.postId);
    await db
      .from("forum_posts")
      .update({ likes: count ?? 0 })
      .eq("id", data.postId);
    return { liked: !existing, likes: count ?? 0 };
  });

/** Authors can delete their own posts; moderators can delete any. */
export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, isMod } = await ctx(context.userId);
    const { data: post } = await db
      .from("forum_posts")
      .select("author_id")
      .eq("id", data.postId)
      .maybeSingle();
    if (!post) throw new Error("Post not found");
    if (post.author_id !== context.userId && !isMod) throw new Error("You can't delete this post.");
    await db
      .from("forum_posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.postId);
    return { ok: true };
  });

export const moderateThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        threadId: z.string().uuid(),
        action: z.enum(["pin", "unpin", "lock", "unlock", "delete"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, isMod } = await ctx(context.userId);
    const { data: thread } = await db
      .from("forum_threads")
      .select("author_id")
      .eq("id", data.threadId)
      .maybeSingle();
    if (!thread) throw new Error("Thread not found");
    const ownDelete = data.action === "delete" && thread.author_id === context.userId;
    if (!isMod && !ownDelete) throw new Error("Only moderators can do that.");
    const patch =
      data.action === "delete"
        ? { deleted_at: new Date().toISOString() }
        : data.action === "pin" || data.action === "unpin"
          ? { pinned: data.action === "pin" }
          : { locked: data.action === "lock" };
    await db.from("forum_threads").update(patch).eq("id", data.threadId);
    return { ok: true };
  });

/** Whether the signed-in player moderates the forums (shows mod tools). */
export const getForumRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isMod, profile } = await ctx(context.userId);
    return { isMod, canPost: !!profile && !profile.is_guest && !profile.banned_at };
  });
