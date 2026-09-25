import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/auth";

/** After any sign-in, asks for the authenticator code when the account has two-factor
 *  sign-in on. Until then the rest of the site isn't shown (and RLS refuses the session). */
export function MfaGate() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (data?.currentLevel === "aal1" && data.nextLevel === "aal2") {
        const { data: f } = await supabase.auth.mfa.listFactors();
        setFactorId(f?.totp.find((x) => x.status === "verified")?.id ?? null);
      } else {
        setFactorId(null);
      }
    }
    void check();
    const { data } = supabase.auth.onAuthStateChange(() => void check());
    return () => data.subscription.unsubscribe();
  }, []);

  if (!factorId) return null;

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factorId!,
      code: code.trim(),
    });
    setBusy(false);
    if (err) {
      setError("That code didn't work. Check the time on your phone and try the newest code.");
      setCode("");
    } else {
      setFactorId(null);
      window.location.reload();
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-4">
      <form
        onSubmit={verify}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center"
      >
        <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-3 font-serif text-2xl font-bold">Two-factor sign-in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app.
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder="123456"
          className="mt-5 w-full rounded-lg border border-border bg-background px-3 py-3 text-center font-mono text-2xl tracking-[0.4em]"
        />
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <button
          disabled={busy || code.length !== 6}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify
        </button>
        <button
          type="button"
          onClick={() => void signOut().then(() => window.location.assign("/login"))}
          className="mt-3 text-sm text-muted-foreground underline"
        >
          Sign out
        </button>
        <p className="mt-4 text-xs text-muted-foreground">
          Lost your phone? Sign out, then contact us from the Help page and we'll help you back in.
        </p>
      </form>
    </div>
  );
}
