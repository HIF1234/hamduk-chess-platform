import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing you in — Hamduk Chess" }] }),
  component: AuthCallback,
});

/**
 * Landing page for the mobile app's email confirmation link. On a phone with the app
 * installed, Android's verified App Link opens the app directly here and
 * supabase_flutter's own deep-link handling signs it in — this page is never actually
 * seen. This is the fallback for everyone else (no app installed, a desktop browser, or
 * the App Link hasn't finished verifying yet): the browser lands here instead, Supabase's
 * JS client picks up the session from the same URL, and we forward to the board.
 */
function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate({ to: "/play" });
    });
    // Session may already have been parsed from the URL by the time this mounts.
    void supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) navigate({ to: "/play" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Confirming your account…</p>
        <p className="text-sm text-muted-foreground">
          Taking too long?{" "}
          <Link to="/login" className="text-primary underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
