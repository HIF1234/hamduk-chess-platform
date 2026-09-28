import { createFileRoute } from "@tanstack/react-router";

const SITE = "https://play.chess.hamduk.com.ng";

// Only genuinely public, indexable pages. Everything else (games, profiles behind auth,
// dashboards) either needs a signed-in user or isn't something we want ranked on its own.
const staticRoutes = [
  "",
  "/lobby",
  "/leaderboard",
  "/puzzles",
  "/openings",
  "/tv",
  "/spectate",
  "/news",
  "/about",
  "/fair-play",
  "/billing",
  "/support",
  "/terms",
  "/privacy",
];

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = staticRoutes.map((path) => ({ loc: `${SITE}${path}`, priority: path === "" ? "1.0" : "0.7" }));

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: articles } = await supabaseAdmin
            .from("articles")
            .select("slug, published_at")
            .not("published_at", "is", null)
            .order("published_at", { ascending: false })
            .limit(500);
          for (const a of articles ?? []) {
            urls.push({ loc: `${SITE}/news/${a.slug}`, priority: "0.5" });
          }
        } catch {
          // Articles are a bonus in the sitemap; never fail the whole thing over it.
        }

        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${xmlEscape(u.loc)}</loc><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>`;

        return new Response(body, { headers: { "Content-Type": "application/xml" } });
      },
    },
  },
});
