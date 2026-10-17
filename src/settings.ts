import type { Units } from "./geo";

export type Mode = "classic" | "streak";
export type Movement = "moving" | "no-move" | "nmpz";

export type Settings = {
  mapId: string;
  mode: Mode;
  movement: Movement;
  timeLimit: number; // seconds per round, 0 = unlimited
  units: Units;
};

export const ROUNDS_PER_GAME = 5;

export const DEFAULT_SETTINGS: Settings = {
  mapId: "world",
  mode: "classic",
  movement: "moving",
  timeLimit: 0,
  units: "km",
};

const SETTINGS_KEY = "whereabouts:settings";

// localStorage can be missing or throw (private windows, blocked storage).
// Settings and best scores are a convenience, so fall back silently.
function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // See read().
  }
}

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(SETTINGS_KEY) };
}

export function saveSettings(settings: Settings) {
  write(SETTINGS_KEY, settings);
}

const bestKey = (s: Pick<Settings, "mapId" | "mode" | "movement">) => `whereabouts:best:${s.mapId}:${s.mode}:${s.movement}`;

export function loadBest(s: Pick<Settings, "mapId" | "mode" | "movement">): number | undefined {
  return read<number>(bestKey(s));
}

// Returns true if `score` is a new personal best.
export function recordBest(s: Pick<Settings, "mapId" | "mode" | "movement">, score: number): boolean {
  const best = loadBest(s);
  if (best !== undefined && best >= score) return false;
  write(bestKey(s), score);
  return true;
}
