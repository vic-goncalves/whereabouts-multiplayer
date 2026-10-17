// Messages between party clients and the party server (party/worker.ts).
import type { LatLng } from "../geo";
import type { Location, Movement } from "../types";

export type PartySettings = {
  mapId: string;
  movement: Movement;
  timeLimit: number; // seconds per round, 0 = until everyone has guessed
  rounds: number;
};

export type PartyPlayer = { id: string; name: string; color: string; connected: boolean };

export type PartyGuess = { position?: LatLng; distance?: number; score: number };

export type PartyPhase = "lobby" | "playing" | "results" | "final";

// What every client sees. Locations for future rounds and other players'
// guesses for the round in progress are withheld until they're revealed.
export type PartyState = {
  code: string;
  hostId: string;
  phase: PartyPhase;
  settings: PartySettings;
  players: PartyPlayer[];
  round: number;
  locations: Location[];
  roundEndsAt?: number; // server clock, ms since epoch
  guesses: Record<string, PartyGuess>[]; // per revealed round, keyed by player id
  guessed: string[]; // players who have locked in the current round
};

export type ClientMessage =
  | { type: "join"; playerId: string; name: string; create: boolean }
  | { type: "settings"; settings: PartySettings }
  | { type: "start"; locations: Location[] }
  | { type: "guess"; round: number; position: LatLng | null }
  | { type: "endRound" }
  | { type: "next" }
  | { type: "lobby" };

export type PartyErrorReason = "taken" | "missing" | "full" | "invalid";

export type ServerMessage =
  | { type: "state"; state: PartyState; serverNow: number }
  | { type: "error"; reason: PartyErrorReason; message: string };

// Unambiguous letters only: no I/O to confuse with 1/0.
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODE_LENGTH = 4;
