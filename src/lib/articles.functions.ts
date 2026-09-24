import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function editor(userId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: role } = await db
    .from("admin_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  const ok = !!role && ["super_admin", "admin", "moderator"].includes(role.role);
  return { db, ok };
}

function slugify(title: string) {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 70) || "article"
  );
}

export const canWriteArticles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ ok: (await editor(context.userId)).ok }));

/** Editors: all articles including drafts. */
export const listArticlesForEditor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, ok } = await editor(context.userId);
    if (!ok) throw new Error("Editors only.");
    const { data } = await db
      .from("articles")
      .select("id, title, slug, type, published_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const getArticleForEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, ok } = await editor(context.userId);
    if (!ok) throw new Error("Editors only.");
    const { data: a } = await db.from("articles").select("*").eq("id", data.id).maybeSingle();
    if (!a) throw new Error("Article not found");
    return a;
  });

export const saveArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        type: z.enum(["news", "article", "event"]),
        title: z.string().trim().min(4).max(160),
        excerpt: z.string().trim().max(300).optional(),
        body: z.string().max(50_000),
        coverUrl: z.string().url().max(500).optional().or(z.literal("")),
        tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
        publish: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, ok } = await editor(context.userId);
    if (!ok) throw new Error("Editors only.");
    const fields = {
      type: data.type,
      title: data.title,
      excerpt: data.excerpt || null,
      body: data.body,
      cover_url: data.coverUrl || null,
      tags: data.tags,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { data: current } = await db
        .from("articles")
        .select("published_at, slug")
        .eq("id", data.id)
        .maybeSingle();
      if (!current) throw new Error("Article not found");
      const published_at = data.publish ? (current.published_at ?? new Date().toISOString()) : null;
      const { error } = await db
        .from("articles")
        .update({ ...fields, published_at })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id, slug: current.slug };
    }
    let slug = slugify(data.title);
    const { data: clash } = await db.from("articles").select("id").eq("slug", slug).maybeSingle();
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;
    const { data: row, error } = await db
      .from("articles")
      .insert({
        ...fields,
        slug,
        author_id: context.userId,
        published_at: data.publish ? new Date().toISOString() : null,
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, ok } = await editor(context.userId);
    if (!ok) throw new Error("Editors only.");
    await db.from("articles").delete().eq("id", data.id);
    return { ok: true };
  });
