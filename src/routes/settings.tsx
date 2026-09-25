import { useEffect, useState, type ReactNode } from "react";
import { TwoFactorSettings } from "@/components/auth/TwoFactorSettings";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Crown, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signOut, useAuth } from "@/lib/auth";
import { getStoredTheme, setTheme, type Theme } from "@/lib/theme";
import {
  BOARD_THEMES,
  setLocalPreferences,
  usePreferences,
  type BoardThemeId,
  type Preferences,
} from "@/lib/preferences";
import { getMySettings, updateMyAccount, updateMyPreferences } from "@/lib/preferences.functions";
import { setVacationMode } from "@/lib/correspondence.functions";
import { LEGAL } from "@/components/LegalPage";
import { StaffLink } from "@/components/StaffLink";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Hamduk Chess" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading, isGuest } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getMySettings);
  const savePrefs = useServerFn(updateMyPreferences);
  const saveAccount = useServerFn(updateMyAccount);
  const saveVacation = useServerFn(setVacationMode);
  const prefs = usePreferences();
  const [uiTheme, setUiTheme] = useState<Theme>("system");

  useEffect(() => setUiTheme(getStoredTheme()), []);

  const settings = useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user,
    queryFn: () => fetchSettings(),
  });

  useEffect(() => {
    if (settings.data) setLocalPreferences(settings.data.preferences);
  }, [settings.data]);

  if (loading)
    return (
      <Centered>
        <Loader2 className="h-6 w-6 animate-spin" />
      </Centered>
    );
  if (!user) {
    return (
      <Centered>
        <p className="text-muted-foreground">Sign in to manage your settings.</p>
        <Link
          to="/login"
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Sign in
        </Link>
      </Centered>
    );
  }

  const s = settings.data;
  const isGold = s?.tier === "gold";

  async function updatePrefs(patch: Partial<Preferences>) {
    const next = { ...prefs, ...patch };
    const previous = prefs;
    setLocalPreferences(next); // instant feedback on every board
    try {
      await savePrefs({ data: next });
    } catch (e) {
      setLocalPreferences(previous);
      toast.error((e as Error).message);
    }
  }

  async function updateAccount(patch: { country?: string; emailOnMoves?: boolean }, ok: string) {
    try {
      await saveAccount({ data: patch });
      toast.success(ok);
      void qc.invalidateQueries({ queryKey: ["settings"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-4xl font-bold tracking-tight">Settings</h1>
          <StaffLink className="rounded-md border border-gold/40 px-3 py-1.5 text-sm font-medium text-gold hover:bg-gold/10" />
        </div>
        <p className="mt-1 text-muted-foreground">
          {s ? (
            <>
              Signed in as <span className="font-medium text-foreground">{s.username}</span>
              {isGuest && " (guest)"}
            </>
          ) : (
            " "
          )}
        </p>

        <Section title="Appearance">
          <Row label="App theme">
            <Segmented
              value={uiTheme}
              options={[
                ["light", "Light"],
                ["dark", "Dark"],
                ["system", "Auto"],
              ]}
              onChange={(t) => {
                setUiTheme(t);
                setTheme(t);
              }}
            />
          </Row>
          <div className="pt-2">
            <p className="mb-3 text-sm font-medium">Board</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(Object.keys(BOARD_THEMES) as BoardThemeId[]).map((id) => {
                const t = BOARD_THEMES[id];
                const locked = t.gold && !isGold;
                const active = prefs.boardTheme === id;
                return (
                  <button
                    key={id}
                    onClick={() =>
                      locked
                        ? toast.info(`${t.label} is a Hamduk Gold board.`)
                        : void updatePrefs({ boardTheme: id })
                    }
                    className={`rounded-lg border p-2 text-left transition ${
                      active
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-border hover:border-primary/50"
                    }`}
                    aria-pressed={active}
                  >
                    <MiniBoard light={t.light} dark={t.dark} />
                    <span className="mt-2 flex items-center justify-between text-xs font-medium">
                      {t.label}
                      {active && <Check className="h-3.5 w-3.5 text-primary" />}
                      {locked && <Lock className="h-3.5 w-3.5 text-gold" />}
                      {t.gold && !locked && !active && <Crown className="h-3.5 w-3.5 text-gold" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <Row label="Show board coordinates">
            <Toggle
              checked={prefs.showCoordinates}
              onChange={(v) => void updatePrefs({ showCoordinates: v })}
            />
          </Row>
        </Section>

        <Section title="Sound">
          <Row label="Move, capture and check sounds">
            <Toggle checked={prefs.sound} onChange={(v) => void updatePrefs({ sound: v })} />
          </Row>
        </Section>

        <Section title="Notifications">
          <Row label="Email me when a correspondence opponent moves">
            <Toggle
              checked={!!s?.emailOnMoves}
              disabled={!s || isGuest}
              onChange={(v) =>
                void updateAccount({ emailOnMoves: v }, v ? "Move emails on" : "Move emails off")
              }
            />
          </Row>
          <Row label="Weekly summary email" hint="Games, rating change, puzzles and streak.">
            <Toggle
              checked={prefs.weeklySummary}
              disabled={isGuest}
              onChange={(v) => void updatePrefs({ weeklySummary: v })}
            />
          </Row>
          <Row label="Daily puzzle email" hint="Plus and Gold.">
            <Toggle
              checked={prefs.emailDigest}
              disabled={isGuest || s?.tier === "free"}
              onChange={(v) => void updatePrefs({ emailDigest: v })}
            />
          </Row>
        </Section>

        <Section title="Correspondence">
          <Row
            label="Vacation mode"
            hint={
              s?.vacationUntil && new Date(s.vacationUntil) > new Date()
                ? `Clocks paused until ${new Date(s.vacationUntil).toLocaleDateString()}.`
                : "Pause all your correspondence clocks (up to 14 days a year)."
            }
          >
            <VacationControl
              active={!!s?.vacationUntil && new Date(s.vacationUntil) > new Date()}
              onSet={async (days) => {
                try {
                  await saveVacation({ data: { days } });
                  toast.success(
                    days === 0
                      ? "Vacation ended"
                      : `Vacation on for ${days} day${days === 1 ? "" : "s"}`,
                  );
                  void qc.invalidateQueries({ queryKey: ["settings"] });
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            />
          </Row>
        </Section>

        <Section title="Account">
          <Row label="Country">
            <select
              value={s?.country ?? "NG"}
              disabled={!s}
              onChange={(e) => void updateAccount({ country: e.target.value }, "Country updated")}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            >
              {COUNTRIES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </Row>
          {!isGuest && <PasswordChange />}
          {isGuest && (
            <p className="rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm">
              You're playing as a guest. Create a free account from the sign-in page to keep your
              games and ratings.
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Sign out
            </button>
            <a
              href={`mailto:${LEGAL.email}?subject=${encodeURIComponent("Delete my Hamduk Chess account")}&body=${encodeURIComponent(`Username: ${s?.username ?? ""}`)}`}
              className="rounded-md border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/5"
            >
              Request account deletion
            </a>
          </div>
        </Section>

        {!isGuest && (
          <Section title="Two-factor sign-in">
            <TwoFactorSettings />
          </Section>
        )}

        <Section title="Membership">
          <Row
            label={
              <span className="capitalize">
                {s ? (s.tier === "free" ? "Free" : `Hamduk ${s.tier}`) : "—"}
              </span>
            }
            hint={
              s?.renewsAt && s.tier !== "free"
                ? `Access until ${new Date(s.renewsAt).toLocaleDateString()}. Memberships don't renew automatically.`
                : "Unlock every bot, unlimited puzzles, full game review and more."
            }
          >
            <Link
              to="/billing"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              {s?.tier === "free" ? "Upgrade" : "Manage"}
            </Link>
          </Row>
        </Section>

        <Section title="Privacy">
          <p className="text-sm text-muted-foreground">
            Read our{" "}
            <Link to="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link to="/terms" className="text-primary hover:underline">
              Terms
            </Link>
            . To get a copy of your data, email{" "}
            <a href={`mailto:${LEGAL.email}`} className="text-primary hover:underline">
              {LEGAL.email}
            </a>
            .
          </p>
        </Section>
      </main>
    </div>
  );
}

function PasswordChange() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Row label="Change password">
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const { error } = await supabase.auth.updateUser({ password: pw });
          setBusy(false);
          if (error) toast.error(error.message);
          else {
            toast.success("Password updated");
            setPw("");
          }
        }}
      >
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          minLength={8}
          placeholder="New password"
          autoComplete="new-password"
          className="w-40 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
        <button
          disabled={busy || pw.length < 8}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Save
        </button>
      </form>
    </Row>
  );
}

function VacationControl({ active, onSet }: { active: boolean; onSet: (days: number) => void }) {
  const [days, setDays] = useState(3);
  if (active) {
    return (
      <button
        onClick={() => onSet(0)}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
      >
        End vacation
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <select
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      >
        {[1, 3, 7, 14].map((d) => (
          <option key={d} value={d}>
            {d} day{d === 1 ? "" : "s"}
          </option>
        ))}
      </select>
      <button
        onClick={() => onSet(days)}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
      >
        Start
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 font-serif text-xl font-semibold">{title}</h2>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-40 motion-reduce:transition-none ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border text-sm">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3 py-1.5 ${value === v ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MiniBoard({ light, dark }: { light: string; dark: string }) {
  return (
    <div className="grid aspect-square grid-cols-4 overflow-hidden rounded">
      {Array.from({ length: 16 }, (_, i) => (
        <div
          key={i}
          style={{ backgroundColor: (Math.floor(i / 4) + i) % 2 === 0 ? light : dark }}
        />
      ))}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">{children}</div>
  );
}

// Africa first, then the most common other countries of our players.
const COUNTRIES: [string, string][] = [
  ["NG", "Nigeria"],
  ["GH", "Ghana"],
  ["KE", "Kenya"],
  ["ZA", "South Africa"],
  ["EG", "Egypt"],
  ["UG", "Uganda"],
  ["TZ", "Tanzania"],
  ["ET", "Ethiopia"],
  ["RW", "Rwanda"],
  ["SN", "Senegal"],
  ["CI", "Côte d'Ivoire"],
  ["CM", "Cameroon"],
  ["BJ", "Benin"],
  ["TG", "Togo"],
  ["NE", "Niger"],
  ["ZM", "Zambia"],
  ["ZW", "Zimbabwe"],
  ["MA", "Morocco"],
  ["DZ", "Algeria"],
  ["TN", "Tunisia"],
  ["GB", "United Kingdom"],
  ["US", "United States"],
  ["CA", "Canada"],
  ["IN", "India"],
  ["AE", "United Arab Emirates"],
];
