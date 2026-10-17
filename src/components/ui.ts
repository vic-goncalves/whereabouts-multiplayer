import type { Movement } from "../settings";

export function cls(...names: (string | false | undefined | null)[]): string {
  return names.filter(Boolean).join(" ");
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export const MOVEMENT_LABELS: Record<Movement, string> = {
  moving: "Moving",
  "no-move": "No Move",
  nmpz: "NMPZ",
};

export const TIME_LIMITS = [0, 10, 30, 60, 120, 180, 300];

export function timeLimitLabel(seconds: number): string {
  if (seconds === 0) return "No limit";
  return seconds < 60 ? `${seconds}s` : `${seconds / 60} min`;
}

export function flagUrl(iso: string): string {
  return `https://flagcdn.com/w40/${iso.toLowerCase()}.png`;
}
