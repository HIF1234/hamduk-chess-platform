import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ConfettiBurst } from "./Confetti";

type Row = { id: string; type: string; title: string; body: string | null; link: string | null };

/** Delivers notifications live: a toast for each, plus confetti for achievements. */
export function NotificationListener() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [celebrate, setCelebrate] = useState(false);
  const done = useCallback(() => setCelebrate(false), []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as Row;
          void qc.invalidateQueries({ queryKey: ["notifications"] });
          if (n.type === "achievement") setCelebrate(true);
          toast(n.title, {
            description: n.body ?? undefined,
            duration: n.type === "achievement" ? 7000 : 5000,
            action: n.link
              ? { label: "View", onClick: () => navigate({ to: n.link! }) }
              : undefined,
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, qc, navigate]);

  return celebrate ? <ConfettiBurst onDone={done} /> : null;
}
