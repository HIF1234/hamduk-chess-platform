import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AnalysisApp, type SavedAnalysis } from "@/components/chess/AnalysisApp";

export const Route = createFileRoute("/analysis/$id")({
  head: () => ({
    meta: [
      { title: "Shared analysis — Hamduk Chess" },
      {
        name: "description",
        content: "A chess analysis shared from Hamduk Chess. Open it and explore the position.",
      },
    ],
  }),
  component: SavedAnalysisPage,
});

function SavedAnalysisPage() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["saved-analysis", id],
    queryFn: async (): Promise<SavedAnalysis | null> => {
      const { data, error } = await supabase
        .from("saved_analyses")
        .select("*, profiles!saved_analyses_owner_id_fkey(username)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { profiles, ...row } = data as typeof data & { profiles: { username: string } | null };
      return {
        ...row,
        headers: (row.headers ?? {}) as Record<string, string>,
        orientation: row.orientation as "white" | "black",
        author: profiles?.username ?? null,
      };
    },
  });

  if (q.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!q.data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-muted-foreground">This analysis doesn't exist or was deleted.</p>
        <Link to="/analysis" className="mt-4 inline-block text-primary underline">
          Open the analysis board
        </Link>
      </div>
    );
  }
  return <AnalysisApp saved={q.data} />;
}
