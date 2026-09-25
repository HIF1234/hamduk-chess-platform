import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Enrolling = { factorId: string; qr: string; secret: string };

/** Turn two-factor sign-in (authenticator app codes) on or off. */
export function TwoFactorSettings() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactorId(data?.totp.find((f) => f.status === "verified")?.id ?? null);
    setLoading(false);
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function start() {
    setBusy(true);
    // Clear any half-finished setup first; Supabase allows only one unverified factor.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) {
      if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      issuer: "Hamduk Chess",
    });
    setBusy(false);
    if (error || !data) return toast.error(error?.message ?? "Couldn't start setup.");
    setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolling.factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (error) return toast.error("That code didn't work. Try the newest one.");
    toast.success("Two-factor sign-in is on.");
    setEnrolling(null);
    setCode("");
    void refresh();
  }

  async function turnOff() {
    if (!factorId) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Two-factor sign-in is off.");
    void refresh();
  }

  if (loading) return <Loader2 className="h-4 w-4 animate-spin" />;

  if (factorId) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm">
          <ShieldCheck className="h-5 w-5 text-primary" /> On. You'll be asked for a code each time
          you sign in.
        </p>
        <button
          onClick={() => void turnOff()}
          disabled={busy}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
        >
          Turn off
        </button>
      </div>
    );
  }

  if (enrolling) {
    return (
      <form onSubmit={confirm} className="space-y-3 text-sm">
        <p>
          1. Scan this with Google Authenticator, Microsoft Authenticator, Authy or any
          authenticator app.
        </p>
        <img
          src={enrolling.qr}
          alt="QR code for your authenticator app"
          className="h-44 w-44 rounded-lg bg-white p-2"
        />
        <p className="text-muted-foreground">
          Can't scan? Enter this key instead:{" "}
          <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            {enrolling.secret}
          </code>
        </p>
        <p>2. Type the 6-digit code the app shows.</p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="w-36 rounded-md border border-border bg-background px-3 py-2 text-center font-mono tracking-widest"
          />
          <button
            disabled={busy || code.length !== 6}
            className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
          >
            Turn on
          </button>
          <button
            type="button"
            onClick={() => setEnrolling(null)}
            className="px-2 text-muted-foreground underline"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Protect your account with a code from an authenticator app, as well as your password.
      </p>
      <button
        onClick={() => void start()}
        disabled={busy}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        Set up
      </button>
    </div>
  );
}
