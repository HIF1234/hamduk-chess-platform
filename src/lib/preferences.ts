// Client-safe user preferences. Cached in localStorage so boards render with the
// right colours immediately, and synced to profiles.preferences for signed-in users.
import { useMemo, useSyncExternalStore } from "react";

export const BOARD_THEMES = {
  classic: { label: "Classic", light: "#f0d9b5", dark: "#b58863", gold: false },
  midnight: { label: "Midnight", light: "#6e7f99", dark: "#2c3547", gold: false },
  savanna: { label: "Savanna", light: "#e8c77a", dark: "#8f5b2e", gold: false },
  emerald: { label: "Emerald", light: "#eeeee0", dark: "#1f7a4d", gold: false },
  "lagos-night": { label: "Lagos Night", light: "#f5a623", dark: "#18171c", gold: true },
} as const;

export type BoardThemeId = keyof typeof BOARD_THEMES;

export type Preferences = {
  boardTheme: BoardThemeId;
  sound: boolean;
  showCoordinates: boolean;
  emailDigest: boolean;
  weeklySummary: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  boardTheme: "classic",
  sound: true,
  showCoordinates: true,
  emailDigest: false,
  weeklySummary: true,
};

const KEY = "hamduk:prefs";
const EVENT = "hamduk:prefs-change";

function read(): Preferences {
  if (typeof localStorage === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizePreferences(JSON.parse(raw)) : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Fills gaps and drops unknown values, e.g. from an older app version. */
export function normalizePreferences(input: unknown): Preferences {
  const p = (input && typeof input === "object" ? input : {}) as Partial<Preferences>;
  return {
    boardTheme: p.boardTheme && p.boardTheme in BOARD_THEMES ? p.boardTheme : "classic",
    sound: typeof p.sound === "boolean" ? p.sound : DEFAULT_PREFERENCES.sound,
    showCoordinates:
      typeof p.showCoordinates === "boolean"
        ? p.showCoordinates
        : DEFAULT_PREFERENCES.showCoordinates,
    emailDigest:
      typeof p.emailDigest === "boolean" ? p.emailDigest : DEFAULT_PREFERENCES.emailDigest,
    weeklySummary:
      typeof p.weeklySummary === "boolean" ? p.weeklySummary : DEFAULT_PREFERENCES.weeklySummary,
  };
}

let cache: Preferences | null = null;

export function getPreferences(): Preferences {
  if (!cache) cache = read();
  return cache;
}

export function setLocalPreferences(next: Preferences) {
  cache = normalizePreferences(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* private mode — keep the in-memory copy */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getPreferences, () => DEFAULT_PREFERENCES);
}

/** Square colours for react-chessboard, following the player's board theme. */
export function useBoardSquares() {
  const { boardTheme, showCoordinates } = usePreferences();
  return useMemo(() => {
    const t = BOARD_THEMES[boardTheme];
    return {
      lightSquareStyle: { backgroundColor: t.light },
      darkSquareStyle: { backgroundColor: t.dark },
      showNotation: showCoordinates,
    };
  }, [boardTheme, showCoordinates]);
}
