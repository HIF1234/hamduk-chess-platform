import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type Tier = "free" | "plus" | "gold";

/** The signed-in player's membership tier; "free" for guests and signed-out visitors.
 *  `undefined` while it's loading, so callers can avoid flashing tier-specific UI. */
export function useTier(): Tier | undefined {
  const { user, loading } = useAuth();
  const q = useQuery({
    queryKey: ["my-tier", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user!.id)
        .maybeSingle();
      return (data?.subscription_tier ?? "free") as Tier;
    },
  });
  if (loading) return undefined;
  if (!user) return "free";
  return q.data;
}
