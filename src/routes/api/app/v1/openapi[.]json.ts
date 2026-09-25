import { createFileRoute } from "@tanstack/react-router";

const bearer = [{ bearer: [] }];
const idParam = { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } };
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
      "unauthorized or mfa_required (401), upgrade_required (402), not_found (404), limited (429), " +
      "bad_request or rejected (400). Live game updates: subscribe with Supabase Realtime to changes on the " +
      "`games` row (filter id=eq.<game id>).",
  },
  servers: [{ url: "https://play.chess.hamduk.com.ng/api/app/v1" }],
  components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
  paths: {
    "/config": { get: { summary: "Backend details, minimum app version, time controls, bots", responses: ok } },
    "/me": { get: op("My account, tier, ratings and puzzle stats") },
    "/seek": {
      post: op("Join or open a matchmaking seek", {
        requestBody: json(
          { timeControl: { type: "string", example: "5+0" }, variant: { enum: ["standard", "chess960"] } },
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
    "/games/{id}": { get: op("One game with players and the server time", { parameters: [idParam] }) },
    "/games/{id}/move": {
      post: op("Play a move", {
        parameters: [idParam],
        requestBody: json({ uci: { type: "string", example: "e2e4" }, elapsedMs: { type: "integer" } }, ["uci"]),
      }),
    },
    "/games/{id}/resign": { post: op("Resign", { parameters: [idParam] }) },
    "/games/{id}/abort": { post: op("Abort before enough moves are played", { parameters: [idParam] }) },
    "/games/{id}/flag": { post: op("End the game if a clock has run out", { parameters: [idParam] }) },
    "/games/{id}/draw": {
      post: op("Offer a draw, or answer one with { accept }", { parameters: [idParam], requestBody: optionalJson(accept) }),
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
      get: op("The next rated puzzle", { parameters: [{ name: "theme", in: "query", schema: { type: "string" } }] }),
    },
    "/puzzles/daily": {
      get: op("The daily puzzle", {
        parameters: [{ name: "date", in: "query", schema: { type: "string", format: "date" } }],
      }),
    },
    "/puzzles/{id}/attempt": {
      post: op("Record a puzzle attempt", {
        parameters: [idParam],
        requestBody: json({ success: { type: "boolean" } }, ["success"]),
      }),
    },
    "/puzzles/pack": {
      get: op("Unseen puzzles near my rating for offline play", {
        parameters: [{ name: "count", in: "query", schema: { type: "integer", maximum: 500 } }],
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
                properties: { puzzleId: { type: "string", format: "uuid" }, success: { type: "boolean" } },
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
        requestBody: optionalJson({ ids: { type: "array", items: { type: "string", format: "uuid" } } }),
      }),
    },
  },
};

export const Route = createFileRoute("/api/app/v1/openapi.json")({
  server: {
    handlers: {
      GET: async () => Response.json(SPEC, { headers: { "cache-control": "public, max-age=3600" } }),
    },
  },
});
