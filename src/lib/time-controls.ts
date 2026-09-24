// Single source of truth for live time controls ("minutes+increment").
// Correspondence (days per move) is separate.
export const TIME_CONTROLS = [
  { id: "1+0", category: "bullet", label: "1 min" },
  { id: "2+1", category: "bullet", label: "2 | +1" },
  { id: "3+0", category: "blitz", label: "3 min" },
  { id: "3+2", category: "blitz", label: "3 | +2" },
  { id: "5+0", category: "blitz", label: "5 min" },
  { id: "10+0", category: "rapid", label: "10 min" },
  { id: "15+10", category: "rapid", label: "15 | +10" },
  { id: "30+0", category: "classical", label: "30 min" },
] as const;

export type TimeControlId = (typeof TIME_CONTROLS)[number]["id"];
export type TimeControlCategory = (typeof TIME_CONTROLS)[number]["category"];

export const TIME_CONTROL_IDS = TIME_CONTROLS.map((t) => t.id) as [
  TimeControlId,
  ...TimeControlId[],
];

export const CATEGORY_LABEL: Record<TimeControlCategory, string> = {
  bullet: "Bullet",
  blitz: "Blitz",
  rapid: "Rapid",
  classical: "Classical",
};

export function categoryOf(id: string): TimeControlCategory | null {
  return TIME_CONTROLS.find((t) => t.id === id)?.category ?? null;
}

export function idsIn(category: TimeControlCategory): TimeControlId[] {
  return TIME_CONTROLS.filter((t) => t.category === category).map((t) => t.id);
}
