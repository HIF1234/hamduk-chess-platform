// Point 5 of the mobile feedback pass: a player shouldn't be able to leave their opponent
// waiting forever on a no-show, but their no-show clock also shouldn't start before their
// client has actually loaded the game (that's the bug that was reported -- slow connections
// were losing the abort race before they'd even seen the board).
//
// Two entry points share this logic: the opponent's client calls checkFirstMoveTimeout
// while it's waiting (same pattern as checkFlag for a normal time forfeit), and the cron
// sweep below catches the case where neither client is present to notice.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Grace period to actually make the first move, once White's client has confirmed ready. */
export const FIRST_MOVE_GRACE_MS = 25_000;
/** If White never confirms ready at all -- true no-show -- give up after this from creation. */
export const MAX_CONNECT_WAIT_MS = 45_000;

/** Checks one game and, if White has missed the first-move deadline, aborts it and records
 *  a strike. Safe to call repeatedly; a no-op once the game is no longer ply 0 and active. */
export async function checkAndAbortFirstMoveTimeout(gameId: string): Promise<{ timedOut: boolean }> {
  const { data: game, error } = await supabaseAdmin
    .from("games")
    .select("id, white_id, black_id, ply, status, created_at, first_move_ready_at")
    .eq("id", gameId)
    .single();
  if (error || !game || game.status !== "active" || game.ply !== 0) return { timedOut: false };

  const deadline = game.first_move_ready_at
    ? new Date(game.first_move_ready_at).getTime() + FIRST_MOVE_GRACE_MS
    : new Date(game.created_at).getTime() + MAX_CONNECT_WAIT_MS;
  if (Date.now() < deadline) return { timedOut: false };

  // Re-check status atomically-ish: only complete it if it's still active and at ply 0, so a
  // move landing in the same instant as this check never gets clobbered.
  const { data: updated, error: uErr } = await supabaseAdmin
    .from("games")
    .update({
      status: "completed",
      result: "draw",
      end_reason: "first_move_timeout",
      ended_at: new Date().toISOString(),
    })
    .eq("id", gameId)
    .eq("status", "active")
    .eq("ply", 0)
    .select("id")
    .maybeSingle();
  if (uErr || !updated) return { timedOut: false };

  await supabaseAdmin.from("game_events").insert({
    game_id: gameId,
    type: "abort",
    by_user: null,
    payload: { reason: "first_move_timeout" },
  });

  const { data: strike } = await supabaseAdmin
    .rpc("record_first_move_strike", { p_user: game.white_id })
    .single<{ new_strikes: number; new_stage: number; banned_until: string | null; indefinite: boolean }>();

  if (strike?.indefinite) {
    await notifyAdminsOfEscalation(game.white_id);
  }

  return { timedOut: true };
}

async function notifyAdminsOfEscalation(userId: string) {
  try {
    const [{ data: admins }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("admin_roles").select("user_id"),
      supabaseAdmin.from("profiles").select("username").eq("id", userId).maybeSingle(),
    ]);
    if (!admins?.length) return;
    const { notify } = await import("@/lib/notifications.server");
    const who = profile?.username ?? userId;
    await Promise.all(
      admins.map((a) =>
        notify(a.user_id, {
          type: "announcement",
          title: "Player flagged: repeated first-move no-shows",
          body: `${who} has been suspended (pending review) after repeated first-move no-shows.`,
          link: `/admin/users/${userId}`,
          email: true,
        }),
      ),
    );
  } catch (e) {
    console.error("[first-move-timeout] admin notify failed", e);
  }
}

/** Cron sweep: catches no-shows where neither client is present to trigger the check. */
export async function sweepFirstMoveTimeouts() {
  const { data: games } = await supabaseAdmin
    .from("games")
    .select("id")
    .eq("status", "active")
    .eq("ply", 0)
    // Lower bound of the two deadlines: a readied game can time out sooner than an
    // unreadied one, so this can't use MAX_CONNECT_WAIT_MS alone without missing some.
    .lt("created_at", new Date(Date.now() - FIRST_MOVE_GRACE_MS).toISOString());
  let aborted = 0;
  for (const g of games ?? []) {
    const { timedOut } = await checkAndAbortFirstMoveTimeout(g.id);
    if (timedOut) aborted++;
  }
  return { checked: games?.length ?? 0, aborted };
}
