import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { heartbeat } from "@/lib/home.functions";

/** Marks the signed-in player as active while the tab is visible. */
export function Heartbeat() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const beat = () => {
      if (document.visibilityState === "visible") void heartbeat().catch(() => {});
    };
    beat();
    const id = setInterval(beat, 120_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [user]);
  return null;
}
