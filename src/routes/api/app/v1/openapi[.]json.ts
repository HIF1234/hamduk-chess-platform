import { createFileRoute } from "@tanstack/react-router";

const bearer = [{ bearer: [] }];
const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const ok = { "200": { description: "OK" } };
const json = (props: Record<string, unknown>, required: string[] = []) => ({
  required: true,
  content: { "application/json": { schema: { type: "object", properties: props, required } } },
});
const optionalJson = (props: Record<string, unknown>) => ({ ...json(props), required: false });
const op = (summary: string, extra: Record<string, unknown> = {}) => ({
  summary,
  security: bearer,
  responses: ok,
  ...extra,
});
const accept = { accept: { type: "boolean" } };

/** OpenAPI description of the app API, for generating the Flutter client. */
const SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Hamduk Chess app API",
    version: "1",
    description:
      "Send `Authorization: Bearer <Supabase access token>`. Errors are JSON `{ error, message }` where error is " +
      "unauthorized or mfa_required (401), upgrade_required (402), not_found (404), stale (409), limited (429), " +
      "bad_request or rejected (400). Live game updates: subscribe with Supabase Realtime to changes on the " +
      "`games` row (filter id=eq.<game id>).",
  },
  servers: [{ url: "https://play.chess.hamduk.com.ng/api/app/v1" }],
  components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
  paths: {
    "/config": {
      get: { summary: "Backend details, minimum app version, time controls, bots", responses: ok },
    },
    "/me": { get: op("My account, tier, ratings and puzzle stats") },
    "/seek": {
      post: op("Join or open a matchmaking seek", {
        requestBody: json(
          {
            timeControl: { type: "string", example: "5+0" },
            variant: { enum: ["standard", "chess960"] },
          },
          ["timeControl"],
        ),
      }),
      delete: op("Leave the matchmaking queue"),
    },
    "/games": {
      get: op("My games in progress and recent ones", {
        parameters: [{ name: "limit", in: "query", schema: { type: "integer", maximum: 50 } }],
      }),
    },
    "/games/{id}": {
      get: op("One game with players and the server time", { parameters: [idParam] }),
    },
    "/leaderboard": {
      get: op("Top players by rating", {
        parameters: [
          { name: "category", in: "query", schema: { enum: ["bullet", "blitz", "rapid", "classical"] } },
          { name: "variant", in: "query", schema: { enum: ["standard", "chess960"] } },
          { name: "country", in: "query", schema: { type: "string" } },
          { name: "month", in: "query", schema: { type: "boolean" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
        ],
      }),
    },
    "/subscription/checkout": {
      post: op("Start a Plus/Gold Paystack checkout", {
        description:
          "Open the returned `authorization_url` in the device's browser. callback_url is the website's own " +
          "/billing page, which verifies the transaction and applies the upgrade on return -- the app's next " +
          "GET /me reflects the new tier, since both share one database. No in-app payment SDK.",
        requestBody: json({ tier: { enum: ["plus", "gold"] } }, ["tier"]),
      }),
    },
    "/tournaments": {
      get: op("Public tournaments (not club-scoped), with entrant counts"),
    },
    "/tournaments/{id}": {
      get: op("Tournament detail: standings, this round's pairings/live boards, your own entry", {
        parameters: [idParam],
      }),
    },
    "/tournaments/{id}/join": {
      post: op("Join a tournament", {
        parameters: [idParam],
        description:
          "Fails if registration is closed, the tournament is full, or your membership tier doesn't meet " +
          "min_tier. A successful response may include `requiresPayment: true` for a paid entry -- send the " +
          "player to the website to complete checkout; there's no in-app payment flow yet.",
      }),
    },
    "/tournaments/{id}/withdraw": {
      post: op("Withdraw from a tournament", { parameters: [idParam] }),
    },
    "/coaches": {
      get: { summary: "Browse active human coaches (FIDE title, rate, specialties, rating)", responses: ok },
    },
    "/coaches/{id}": {
      get: op("Coach detail: profile, weekly availability, reviews", { security: [], parameters: [idParam] }),
    },
    "/coaches/{id}/book": {
      post: op("Book a coaching session (Gold only) -- returns a Paystack authorization_url", {
        parameters: [idParam],
        description:
          "Open authorization_url in the device's browser; callback_url is fixed to the coach's own " +
          "website page, which verifies the transaction on return -- the app's next GET /coaching/sessions " +
          "reflects the confirmed status. No in-app payment SDK.",
        requestBody: json(
          { scheduled_at: { type: "string", format: "date-time" }, duration_min: { type: "integer", minimum: 15, maximum: 240 } },
          ["scheduled_at", "duration_min"],
        ),
      }),
    },
    "/coaching/sessions": {
      get: op("My coaching sessions, as student and (if I coach) as coach"),
    },
    "/coaching/sessions/{id}/review": {
      post: op("Leave a 1-5 star review on a completed session", {
        parameters: [idParam],
        requestBody: json(
          { rating: { type: "integer", minimum: 1, maximum: 5 }, comment: { type: "string", maxLength: 1000 } },
          ["rating"],
        ),
      }),
    },
    "/tutorials": {
      get: op("Interactive board tutorials (no video) -- basics and middlegame, static content"),
    },
    "/tutorials/{id}": {
      get: op("One tutorial's steps (observe/move positions to play through)", { parameters: [idParam] }),
    },
    "/videos": {
      get: op("Published video lessons (YouTube/Vimeo/cloud)", {
        description:
          "Gold-only lessons (`is_premium`) are listed too -- gate playback client-side using /me's " +
          "billing tier, the same way the website does.",
      }),
    },
    "/videos/progress": {
      get: op("My watch progress for every video lesson"),
      post: op("Record watch progress (position, completed)", {
        requestBody: json(
          { videoId: { type: "string", format: "uuid" }, positionSec: { type: "integer" }, completed: { type: "boolean" } },
          ["videoId", "positionSec", "completed"],
        ),
      }),
    },
    "/videos/{id}/url": {
      post: op("Signed playback URL for a cloud-hosted lesson", {
        parameters: [idParam],
        description:
          "Only for `source: \"cloud\"` lessons. YouTube/Vimeo lessons embed directly with their " +
          "external_id and never call this. Rejects with upgrade_required if the lesson is Gold-only " +
          "and the caller isn't Gold.",
      }),
    },
    "/spectate": {
      get: op("Public games open to spectate right now"),
    },
    "/profile/{username}": {
      get: op("A player's public profile: ratings, rank and recent games", {
        parameters: [{ name: "username", in: "path", required: true, schema: { type: "string" } }],
      }),
    },
    "/games/{id}/move": {
      post: op("Play a move", {
        parameters: [idParam],
        description:
          "Send `ply` (the number this move will have: current ply + 1) so retries are safe. Repeating a move that " +
          "already landed returns 200 with `duplicate: true` and the current position; a move for a position that " +
          "has moved on returns 409 `stale`, and the app should reload the game.",
        requestBody: json(
          {
            uci: { type: "string", example: "e2e4" },
            ply: { type: "integer" },
            elapsedMs: { type: "integer" },
          },
          ["uci"],
        ),
      }),
    },
    "/games/{id}/resign": { post: op("Resign", { parameters: [idParam] }) },
    "/games/{id}/abort": {
      post: op("Abort before enough moves are played", { parameters: [idParam] }),
    },
    "/games/{id}/flag": {
      post: op("End the game if a clock has run out", { parameters: [idParam] }),
    },
    "/games/{id}/ready": {
      post: op("White confirms the game screen has loaded; starts the first-move no-show clock", {
        parameters: [idParam],
      }),
    },
    "/games/{id}/first-move-timeout": {
      post: op("Abort the game if White never made a first move in time", {
        parameters: [idParam],
      }),
    },
    "/games/{id}/draw": {
      post: op("Offer a draw, or answer one with { accept }", {
        parameters: [idParam],
        requestBody: optionalJson(accept),
      }),
    },
    "/games/{id}/takeback": {
      post: op("Ask for a takeback, or answer one with { accept }", {
        parameters: [idParam],
        requestBody: optionalJson(accept),
      }),
    },
    "/games/{id}/rematch": {
      post: op("Offer a rematch, or accept one with { accept: true }", {
        parameters: [idParam],
        requestBody: optionalJson(accept),
      }),
    },
    "/puzzles/next": {
      get: op("The next rated puzzle", {
        parameters: [{ name: "theme", in: "query", schema: { type: "string" } }],
      }),
    },
    "/puzzles/daily": {
      get: op("The daily puzzle", {
        parameters: [{ name: "date", in: "query", schema: { type: "string", format: "date" } }],
      }),
    },
    "/puzzles/{id}/attempt": {
      post: op("Record a puzzle attempt", {
        parameters: [idParam],
        requestBody: json(
          {
            success: { type: "boolean" },
            hintsUsed: {
              type: "integer",
              minimum: 0,
              maximum: 2,
              description:
                "Highest hint level reached (0 none, 1 square shown, 2 move shown). Dampens the rating gain on solve.",
            },
          },
          ["success"],
        ),
      }),
    },
    "/puzzles/pack": {
      get: op("Unseen puzzles near my rating for offline play", {
        parameters: [
          { name: "count", in: "query", schema: { type: "integer", maximum: 500 } },
          { name: "theme", in: "query", schema: { type: "string", example: "fork" } },
        ],
      }),
    },
    "/puzzles/sync": {
      post: op("Upload offline puzzle attempts, oldest first", {
        requestBody: json(
          {
            attempts: {
              type: "array",
              maxItems: 200,
              items: {
                type: "object",
                properties: {
                  puzzleId: { type: "string", format: "uuid" },
                  success: { type: "boolean" },
                  hintsUsed: { type: "integer", minimum: 0, maximum: 2 },
                },
                required: ["puzzleId", "success"],
              },
            },
          },
          ["attempts"],
        ),
      }),
    },
    "/bot-games": {
      post: op("Record a finished on-device bot game", {
        requestBody: json(
          {
            timeControl: { type: "string" },
            variant: { enum: ["standard", "chess960"] },
            botId: { type: "string" },
            result: { enum: ["win", "loss", "draw"] },
            playerColor: { enum: ["white", "black"] },
            endReason: { type: "string" },
            ply: { type: "integer" },
          },
          ["timeControl", "botId", "result"],
        ),
      }),
    },
    "/notifications": {
      get: op("My notifications, newest first", {
        parameters: [{ name: "limit", in: "query", schema: { type: "integer", maximum: 100 } }],
      }),
    },
    "/notifications/read": {
      post: op("Mark notifications read (all when ids is omitted)", {
        requestBody: optionalJson({
          ids: { type: "array", items: { type: "string", format: "uuid" } },
        }),
      }),
    },
    "/social/friends": { get: op("My friends: accepted, incoming and outgoing requests") },
    "/social/friends/request": {
      post: op("Send a friend request (auto-accepts a reverse pending request)", {
        requestBody: json({ userId: { type: "string", format: "uuid" } }, ["userId"]),
      }),
    },
    "/social/friends/respond": {
      post: op("Accept or decline an incoming friend request", {
        requestBody: json(
          { requestId: { type: "string", format: "uuid" }, accept: { type: "boolean" } },
          ["requestId", "accept"],
        ),
      }),
    },
    "/social/friends/remove": {
      post: op("Remove a friend or cancel a pending request either way", {
        requestBody: json({ userId: { type: "string", format: "uuid" } }, ["userId"]),
      }),
    },
    "/social/follow": {
      post: op("Follow a player", {
        requestBody: json({ userId: { type: "string", format: "uuid" } }, ["userId"]),
      }),
      delete: op("Unfollow a player", {
        requestBody: json({ userId: { type: "string", format: "uuid" } }, ["userId"]),
      }),
    },
    "/social/relation/{userId}": {
      get: op("My follow/friend state with another player", {
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      }),
    },
    "/social/feed": { get: op("Recent activity from players I follow") },
    "/social/messages": { get: op("My conversations, most recent first") },
    "/social/messages/{username}": {
      get: op("My conversation with one player; marks their messages read", {
        parameters: [{ name: "username", in: "path", required: true, schema: { type: "string" } }],
      }),
    },
    "/social/messages/send": {
      post: op("Send a direct message", {
        requestBody: json(
          { recipientId: { type: "string", format: "uuid" }, content: { type: "string", maxLength: 2000 } },
          ["recipientId", "content"],
        ),
      }),
    },
    "/social/block": {
      post: op("Block a player -- they can no longer message, follow or friend-request you", {
        requestBody: json({ userId: { type: "string", format: "uuid" } }, ["userId"]),
      }),
    },
    "/social/unblock": {
      post: op("Lift a block you placed (only the blocker can unblock)", {
        requestBody: json({ userId: { type: "string", format: "uuid" } }, ["userId"]),
      }),
    },
    "/report": {
      post: op("File a report into the moderation queue (max 5/day)", {
        requestBody: json(
          {
            targetType: { enum: ["user", "game", "club_post", "message", "forum_post", "game_comment"] },
            targetId: { type: "string", format: "uuid" },
            reason: { enum: ["cheating", "abuse", "username", "sandbagging", "spam", "other"] },
            details: { type: "string", maxLength: 1000 },
          },
          ["targetType", "targetId", "reason"],
        ),
      }),
    },
    "/report/reasons": { get: op("Valid `reason` values for POST /report, with display labels") },
  },
};

export const Route = createFileRoute("/api/app/v1/openapi.json")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(SPEC, { headers: { "cache-control": "public, max-age=3600" } }),
    },
  },
});
