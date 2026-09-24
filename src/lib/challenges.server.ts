// Server-only: turns an open challenge into a game.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const STANDARD_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export async function acceptChallengeFor(
  challengeId: string,
  userId: string,
): Promise<{ gameId: string }> {
  const db = supabaseAdmin;
  const { data: ch } = await db
    .from("game_challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();
  if (!ch) throw new Error("This challenge doesn't exist.");
  if (ch.game_id) {
    if (ch.accepted_by === userId || ch.creator_id === userId) return { gameId: ch.game_id };
    throw new Error("Someone already accepted this challenge.");
  }
  if (new Date(ch.expires_at) < new Date()) throw new Error("This challenge has expired.");
  if (ch.creator_id === userId)
    throw new Error("Send this link to a friend — you can't accept your own challenge.");

  const creatorWhite =
    ch.creator_color === "white"
      ? true
      : ch.creator_color === "black"
        ? false
        : Math.random() < 0.5;
  const white = creatorWhite ? ch.creator_id : userId;
  const black = creatorWhite ? userId : ch.creator_id;

  const [initMin, inc] = ch.time_control.split("+").map(Number);
  const initSec = initMin * 60;
  let startFen = STANDARD_FEN;
  if (ch.variant === "chess960") {
    const { chess960StartFen } = await import("@/lib/chess960");
    startFen = chess960StartFen();
  }
  const { data: ratings } = await db
    .from("ratings")
    .select("user_id, rating")
    .in("user_id", [white, black])
    .eq("time_control", ch.time_control)
    .eq("variant", ch.variant);
  const ratingOf = (u: string) => ratings?.find((r) => r.user_id === u)?.rating ?? 1200;

  const { data: game, error } = await db
    .from("games")
    .insert({
      white_id: white,
      black_id: black,
      time_control: ch.time_control,
      variant: ch.variant,
      chess960_start_fen: ch.variant === "chess960" ? startFen : null,
      initial_sec: initSec,
      increment_sec: inc,
      time_white_ms: initSec * 1000,
      time_black_ms: initSec * 1000,
      last_clock_update: new Date().toISOString(),
      fen: startFen,
      rated: ch.rated,
      white_rating_before: ratingOf(white),
      black_rating_before: ratingOf(black),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Only the first acceptor wins; a racing second acceptor gets the error above next time.
  const { data: claimed } = await db
    .from("game_challenges")
    .update({ game_id: game.id, accepted_by: userId })
    .eq("id", ch.id)
    .is("game_id", null)
    .select("id")
    .maybeSingle();
  if (!claimed) {
    await db.from("games").delete().eq("id", game.id);
    throw new Error("Someone already accepted this challenge.");
  }
  return { gameId: game.id };
}
