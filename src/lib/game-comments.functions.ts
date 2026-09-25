import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Comment on a finished public game, optionally on a specific move (ply). */
export const addGameComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        gameId: z.string().uuid(),
        content: z.string().trim().min(1).max(1000),
        ply: z.number().int().min(1).max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await db();
    const [{ data: me }, { data: game }] = await Promise.all([
      s
        .from("profiles")
        .select("username, is_guest, banned_at")
        .eq("id", context.userId)
        .maybeSingle(),
      s
        .from("games")
        .select("status, is_public, ply, white_id, black_id")
        .eq("id", data.gameId)
        .maybeSingle(),
    ]);
    if (!me || me.is_guest) throw new Error("Create a free account to comment.");
    if (me.banned_at) throw new Error("Your account can't comment right now.");
    if (!game || !game.is_public || game.status !== "completed") {
      throw new Error("You can comment once the game has finished.");
    }
    if (data.ply && data.ply > game.ply) throw new Error("That move isn't in this game.");
    try {
      const { assertRate } = await import("@/lib/rate-limit.server");
      await assertRate(context.userId, "game-comment", 10, 60);
    } catch (e) {
      if ((e as Error).message.startsWith("Rate limit")) throw e;
    }
    const { data: row, error } = await s
      .from("game_comments")
      .insert({
        game_id: data.gameId,
        user_id: context.userId,
        content: data.content,
        ply: data.ply ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Let the players know people are talking about their game.
    const { notify } = await import("@/lib/notifications.server");
    for (const player of new Set([game.white_id, game.black_id])) {
      if (player === context.userId) continue;
      await notify(player, {
        type: "game_comment",
        title: `${me.username} commented on your game`,
        body: data.content.slice(0, 140),
        link: `/spectate/${data.gameId}`,
      });
    }
    return { id: row.id };
  });

export const toggleCommentLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ commentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await db();
    const { data: existing } = await s
      .from("game_comment_likes")
      .select("comment_id")
      .eq("comment_id", data.commentId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) {
      await s
        .from("game_comment_likes")
        .delete()
        .eq("comment_id", data.commentId)
        .eq("user_id", context.userId);
    } else {
      await s
        .from("game_comment_likes")
        .insert({ comment_id: data.commentId, user_id: context.userId });
    }
    const { count } = await s
      .from("game_comment_likes")
      .select("comment_id", { count: "exact", head: true })
      .eq("comment_id", data.commentId);
    await s
      .from("game_comments")
      .update({ likes: count ?? 0 })
      .eq("id", data.commentId);
    return { liked: !existing, likes: count ?? 0 };
  });

/** Authors delete their own comments; moderators can delete any. */
export const deleteGameComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ commentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await db();
    const [{ data: c }, { data: role }] = await Promise.all([
      s.from("game_comments").select("user_id").eq("id", data.commentId).maybeSingle(),
      s.from("admin_roles").select("role").eq("user_id", context.userId).maybeSingle(),
    ]);
    if (!c) throw new Error("Comment not found");
    const isMod = !!role && ["super_admin", "admin", "moderator"].includes(role.role);
    if (c.user_id !== context.userId && !isMod) throw new Error("You can't delete this comment.");
    await s
      .from("game_comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.commentId);
    return { ok: true };
  });
