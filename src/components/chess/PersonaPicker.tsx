import { Lock } from "lucide-react";
import { BOT_PERSONAS, type BotPersona } from "@/lib/bot-personas";

type Tier = "free" | "plus" | "gold";

export function PersonaPicker({
  value,
  onChange,
  userTier = "free",
  onLockedClick,
}: {
  value: string;
  onChange: (id: string) => void;
  userTier?: Tier;
  onLockedClick?: (persona: BotPersona) => void;
}) {
  const brackets = groupByBracket(BOT_PERSONAS);
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Choose your opponent
      </p>
      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {brackets.map(({ label, items }) => (
          <div key={label} className="space-y-1">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {items.map((p) => {
                const locked = p.tier === "plus" && userTier === "free";
                return (
                  <PersonaRow
                    key={p.id}
                    persona={p}
                    selected={p.id === value}
                    locked={locked}
                    onClick={() => (locked ? onLockedClick?.(p) : onChange(p.id))}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupByBracket(list: BotPersona[]) {
  const buckets: { label: string; items: BotPersona[] }[] = [
    { label: "Beginner · 500–1000", items: [] },
    { label: "Club · 1200–1600", items: [] },
    { label: "Expert · 1800–2200", items: [] },
    { label: "Master · 2400+", items: [] },
  ];
  for (const p of list) {
    if (p.rating <= 1000) buckets[0].items.push(p);
    else if (p.rating <= 1600) buckets[1].items.push(p);
    else if (p.rating <= 2200) buckets[2].items.push(p);
    else buckets[3].items.push(p);
  }
  return buckets.filter((b) => b.items.length > 0);
}

function PersonaRow({
  persona,
  selected,
  locked,
  onClick,
}: {
  persona: BotPersona;
  selected: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center gap-3 rounded p-2 text-left transition-colors cursor-pointer ring-1 " +
        (selected
          ? "bg-primary text-primary-foreground ring-primary"
          : locked
            ? "bg-card ring-border opacity-60 hover:opacity-80"
            : "bg-card ring-border hover:bg-accent")
      }
    >
      <div
        className={
          "size-10 shrink-0 overflow-hidden rounded-sm ring-1 " +
          (selected ? "ring-primary-foreground" : "ring-border")
        }
      >
        <img
          src={persona.portrait}
          alt={persona.name}
          loading="lazy"
          width={40}
          height={40}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate flex items-center gap-1.5">
          {persona.name}
          {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
        </p>
        <p
          className={
            "text-[11px] truncate " +
            (selected ? "text-primary-foreground/75" : "text-muted-foreground")
          }
        >
          {persona.hometown} · {persona.catchphrase}
        </p>
      </div>
      <span
        className={
          "font-mono text-xs font-bold tabular-nums " +
          (selected ? "text-primary-foreground" : "text-primary")
        }
      >
        {persona.rating}
      </span>
    </button>
  );
}
