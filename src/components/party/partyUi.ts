import type { PartyState } from "../../party/protocol";

export function initial(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

export function partyTimeLabel(seconds: number): string {
  if (seconds === 0) return "Until all guess";
  return seconds < 60 ? `${seconds}s` : `${seconds / 60} min`;
}

export type Standing = { id: string; name: string; color: string; total: number };

// Players ranked by total score across every revealed round.
export function standings(state: PartyState): Standing[] {
  return state.players
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      total: state.guesses.reduce((sum, round) => sum + (round[p.id]?.score ?? 0), 0),
    }))
    .sort((a, b) => b.total - a.total);
}
