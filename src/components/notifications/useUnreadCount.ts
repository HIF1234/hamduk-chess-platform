import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/** Unread notification count; refreshed live by NotificationListener. */
export function useUnreadCount() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["notifications", "unread", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
  });
  return user ? (q.data ?? 0) : 0;
}
