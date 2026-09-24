import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Hamduk Chess" }] }),
  component: ResetPassword,
});

/** Landing page for the password-reset email link. */
function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase signs the user in from the link and emits PASSWORD_RECOVERY.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) setReady(true);
    });
    void supabase.auth.getSession().then(({ data: s }) => s.session && setReady(true));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <KeyRound className="h-8 w-8 text-primary" />
        <h1 className="mt-3 font-serif text-2xl font-bold">Choose a new password</h1>
        {!ready ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Open this page from the link in your reset email. Links expire after an hour —{" "}
            <Link to="/login" className="text-primary underline">
              request a new one
            </Link>
            .
          </p>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const { error } = await supabase.auth.updateUser({ password });
              setBusy(false);
              if (error) return toast.error(error.message);
              toast.success("Password updated. You're signed in.");
              navigate({ to: "/play" });
            }}
          >
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              disabled={busy || password.length < 8}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
