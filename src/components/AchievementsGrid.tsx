import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Bot,
  Brain,
  CalendarCheck,
  Castle,
  Crown,
  Flag,
  Flame,
  Footprints,
  Gauge,
  Gem,
  Hash,
  Layers,
  Medal,
  Puzzle,
  Rocket,
  RotateCcw,
  Sparkles,
  Star,
  Swords,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  Zap,
  Award,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Only the icons the seeded achievements use (keeps the bundle small).
const ICONS: Record<string, LucideIcon> = {
  BookOpen,
  Bot,
  Brain,
  CalendarCheck,
  Castle,
  Crown,
  Flag,
  Flame,
  Footprints,
  Gauge,
  Gem,
  Hash,
  Layers,
  Medal,
  Puzzle,
  Rocket,
  RotateCcw,
  Sparkles,
  Star,
  Swords,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  Zap,
};

const TIER_STYLE: Record<string, string> = {
  bronze: "from-amber-700/30 to-amber-900/10 text-amber-700 dark:text-amber-500",
  silver: "from-slate-300/40 to-slate-500/10 text-slate-500 dark:text-slate-300",
  gold: "from-gold/40 to-gold/10 text-gold",
  platinum: "from-cyan-300/40 to-violet-400/20 text-cyan-600 dark:text-cyan-300",
};

/** All 25 achievements, with the player's unlocked ones highlighted. */
export function AchievementsGrid({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["achievements", userId],
    queryFn: async () => {
      const [{ data: all }, { data: mine }] = await Promise.all([
        supabase
          .from("achievements")
          .select("slug, name, description, tier, icon, sort")
          .order("sort"),
        supabase
          .from("user_achievements")
          .select("achievement_slug, unlocked_at")
          .eq("user_id", userId),
      ]);
      const got = new Map((mine ?? []).map((m) => [m.achievement_slug, m.unlocked_at]));
      return (all ?? []).map((a) => ({ ...a, unlockedAt: got.get(a.slug) ?? null }));
    },
  });
  if (!data) return null;
  const count = data.filter((a) => a.unlockedAt).length;

  return (
    <section id="achievements" className="mt-8 scroll-mt-20">
      <h2 className="mb-3 flex items-baseline gap-2 font-serif text-xl font-bold">
        Achievements
        <span className="font-sans text-sm font-normal text-muted-foreground">
          {count} / {data.length}
        </span>
      </h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {data.map((a) => {
          const Icon = ICONS[a.icon] ?? Award;
          const on = !!a.unlockedAt;
          return (
            <div
              key={a.slug}
              title={`${a.name} — ${a.description}${on ? ` (unlocked ${new Date(a.unlockedAt!).toLocaleDateString()})` : ""}`}
              className={`flex flex-col items-center rounded-xl border p-3 text-center ${
                on
                  ? `border-transparent bg-gradient-to-br ${TIER_STYLE[a.tier]}`
                  : "border-dashed border-border opacity-45 grayscale"
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="mt-1.5 text-[11px] font-semibold leading-tight text-foreground">
                {a.name}
              </span>
              <span className="mt-0.5 text-[10px] uppercase tracking-wide opacity-80">
                {a.tier}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
