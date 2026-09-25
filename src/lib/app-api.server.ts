// Shared plumbing for the mobile app API (/api/app/v1/*).
//
// The app signs in with Supabase and sends `Authorization: Bearer <access token>`. Endpoints
// reuse the website's server functions, whose auth middleware reads that same header, so the
// app and the site enforce identical rules (including two-factor sign-in).
import { ZodError } from "zod";

export const APP_API_VERSION = "1";

type Handler = (ctx: { request: Request; params: Record<string, string> }) => Promise<unknown>;

function errorResponse(e: unknown) {
  if (e instanceof Response) return e;
  if (e instanceof ZodError) {
    return Response.json(
      { error: "bad_request", message: e.issues[0]?.message ?? "Invalid input", issues: e.issues },
      { status: 400 },
    );
  }
  const message = e instanceof Error ? e.message : "Something went wrong";
  if (message.startsWith("Unauthorized")) {
    const code = message.includes("two-factor") ? "mfa_required" : "unauthorized";
    return Response.json({ error: code, message }, { status: 401 });
  }
  if (/not found/i.test(message))
    return Response.json({ error: "not_found", message }, { status: 404 });
  if (/(daily|per day|limit|too many)/i.test(message))
    return Response.json({ error: "limited", message }, { status: 429 });
  if (/(Plus|Gold|upgrade)/i.test(message))
    return Response.json({ error: "upgrade_required", message }, { status: 402 });
  // Most server-function errors are rule violations the app should show as-is.
  return Response.json({ error: "rejected", message }, { status: 400 });
}

/** Wraps an endpoint: JSON response, consistent errors, version header. */
export function appEndpoint(handler: Handler) {
  return async (ctx: { request: Request; params?: Record<string, string> }) => {
    try {
      const out = await handler({ request: ctx.request, params: ctx.params ?? {} });
      return Response.json(out ?? { ok: true }, { headers: { "x-hamduk-api": APP_API_VERSION } });
    } catch (e) {
      if (!(e instanceof Response) && !(e instanceof ZodError)) {
        const m = e instanceof Error ? e.message : String(e);
        if (!/^(Unauthorized|.*not found)/i.test(m)) console.error("[app-api]", m);
      }
      return errorResponse(e);
    }
  };
}

/** Parses the JSON body, or {} when there is none. */
export async function body(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Response.json({ error: "bad_request", message: "Invalid JSON body" }, { status: 400 });
  }
}

/** Query string as a plain object. */
export function query(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams);
}
