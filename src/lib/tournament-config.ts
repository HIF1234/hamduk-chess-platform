// Client-safe tournament config (no server imports).
import { TIME_CONTROL_IDS } from "@/lib/time-controls";
export const TOURNAMENT_TYPES = [
  { value: "swiss", label: "Swiss", blurb: "Paired by score each round. Buchholz tie-break." },
  { value: "arena", label: "Arena", blurb: "Continuous games for a set duration. Most points wins." },
  { value: "round_robin", label: "Round-Robin", blurb: "Everyone plays everyone once." },
  { value: "knockout", label: "Knockout", blurb: "Seeded bracket, single elimination." },
] as const;

export type TournamentType = (typeof TOURNAMENT_TYPES)[number]["value"];

export const TOURNAMENT_TIME_CONTROLS = TIME_CONTROL_IDS;

export const CREATE_LIMITS = {
  free: 0,
  plus: 64,
  gold: 256,
} as const;

export function typeLabel(type: string) {
  return TOURNAMENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function statusLabel(status: string) {
  if (status === "scheduled") return "Upcoming";
  if (status === "live") return "Live";
  if (status === "completed") return "Finished";
  return status;
}
