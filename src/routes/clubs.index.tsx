import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck, Loader2, Lock, Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { createClub } from "@/lib/clubs.functions";

export const Route = createFileRoute("/clubs/")({
  head: () => ({
    meta: [
      { title: "Chess Clubs — Hamduk Chess" },
      {
        name: "description",
        content: "Join public chess clubs or start your own with a forum, study boards and club events.",
      },
      { property: "og:title", content: "Chess Clubs — Hamduk Chess" },
      {
        property: "og:description",
        content: "Join public chess clubs or start your own with a forum, study boards and club events.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClubsIndex,
});

function ClubsIndex() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const create = useServerFn(createClub);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    visibility: "public" as "public" | "private",
    minTier: "free" as "free" | "plus" | "gold",
  });

  const clubsQuery = useQuery({
    queryKey: ["clubs", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("id, slug, name, description, visibility, min_tier, is_official, member_count")
        .order("is_official", { ascending: false })
        .order("member_count", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function submit() {
    setBusy(true);
    try {
      const res = await create({
        data: {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          visibility: form.visibility,
          minTier: form.minTier,
        },
      });
      toast.success("Club created");
      navigate({ to: "/clubs/$slug", params: { slug: res.slug } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl font-bold tracking-tight">Clubs</h1>
            <p className="mt-1 text-muted-foreground">
              Communities with their own forum, study boards, events and game feed.
            </p>
          </div>
          {user && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Create club
            </button>
          )}
        </header>

        {showCreate && (
          <section className="mb-10 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Club name</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={60}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Who can join</span>
              <select
                value={form.visibility}
                onChange={(e) => setForm({ ...form, visibility: e.target.value as "public" })}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              >
                <option value="public">Public — anyone can join</option>
                <option value="private">Private — approval required</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Minimum membership</span>
              <select
                value={form.minTier}
                onChange={(e) => setForm({ ...form, minTier: e.target.value as "free" })}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              >
                <option value="free">Anyone</option>
                <option value="plus">Plus and above</option>
                <option value="gold">Gold only</option>
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-muted-foreground">Description</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={1000}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <button
              onClick={() => void submit()}
              disabled={busy || form.name.trim().length < 3}
              className="inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create
            </button>
          </section>
        )}

        {clubsQuery.isLoading && <Loader2 className="h-6 w-6 animate-spin" />}

        <div className="grid gap-3 sm:grid-cols-2">
          {(clubsQuery.data ?? []).map((c) => (
            <Link
              key={c.id}
              to="/clubs/$slug"
              params={{ slug: c.slug }}
              className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/60"
            >
              <p className="flex items-center gap-2 font-semibold">
                {c.name}
                {c.is_official && <BadgeCheck className="h-4 w-4 text-primary" />}
                {c.visibility === "private" && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description ?? "—"}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> {c.member_count} member{c.member_count === 1 ? "" : "s"}
                {c.min_tier !== "free" && ` · ${c.min_tier}+`}
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
