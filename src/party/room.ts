// The rules of a party, kept free of Cloudflare APIs so they can be unit
// tested. party/worker.ts stores a Room, feeds it messages, and broadcasts
// snapshot() after every change.
import { distanceKm, roundScore, type LatLng } from "../geo";
import type { Location } from "../types";
import { MAPS, getMap } from "../maps";
import type {
  ClientMessage,
  PartyErrorReason,
  PartyGuess,
  PartyPhase,
  PartySettings,
  PartyState,
} from "./protocol";

export type Room = {
  code: string;
  hostId: string;
  phase: PartyPhase;
  settings: PartySettings;
  players: { id: string; name: string; color: string }[];
  round: number;
  locations: Location[];
  roundEndsAt?: number;
  guesses: Record<string, PartyGuess>[];
};

export class PartyError extends Error {
  constructor(
    readonly reason: PartyErrorReason,
    message: string,
  ) {
    super(message);
  }
}

export const DEFAULT_PARTY_SETTINGS: PartySettings = { mapId: "world", movement: "moving", timeLimit: 60, rounds: 5 };
export const PARTY_TIME_LIMITS = [0, 30, 60, 120, 180];
export const PARTY_ROUNDS = [3, 5, 10];
export const MAX_PLAYERS = 12;
// Clients submit their pin when their timer hits zero; give those a moment
// to arrive before the server closes the round.
export const ROUND_GRACE_MS = 1500;
export const PLAYER_COLORS = [
  "#7c5cff", "#ff4d6d", "#3ecf6e", "#ffb020", "#22b8f0", "#ff7ad9",
  "#a3e635", "#f97316", "#14b8a6", "#e879f9", "#facc15", "#94a3b8",
];

const MOVEMENTS = ["moving", "no-move", "nmpz"];

// `connected` is everyone with an open socket, including the sender.
export function applyMessage(
  current: Room | undefined,
  code: string,
  playerId: string,
  msg: ClientMessage,
  connected: Set<string>,
  now: number,
): Room {
  if (msg.type === "join") return join(current, code, playerId, msg, connected);
  if (!current) throw new PartyError("missing", `There's no party ${code}.`);

  const room = structuredClone(current);
  const isHost = room.hostId === playerId;
  if (!room.players.some((p) => p.id === playerId)) throw new PartyError("invalid", "Join the party first.");

  switch (msg.type) {
    case "settings":
      requireHost(isHost);
      requirePhase(room, "lobby");
      room.settings = validSettings(msg.settings);
      return room;

    case "start": {
      requireHost(isHost);
      requirePhase(room, "lobby");
      if (!Array.isArray(msg.locations) || msg.locations.length < 1 || msg.locations.length > 10 || !msg.locations.every(isLocation)) {
        throw new PartyError("invalid", "Those locations don't look right.");
      }
      room.locations = msg.locations.map(cleanLocation);
      room.settings.rounds = room.locations.length;
      room.round = 0;
      room.guesses = [];
      startRound(room, now);
      return room;
    }

    case "guess": {
      if (room.phase !== "playing" || msg.round !== room.round) return current; // late or stale; ignore
      const guesses = room.guesses[room.round];
      if (guesses[playerId]) return current;
      if (msg.position !== null && !isLatLng(msg.position)) throw new PartyError("invalid", "That guess isn't on the map.");
      guesses[playerId] = score(room, msg.position);
      if (everyoneGuessed(room, connected)) endRound(room);
      return room;
    }

    case "endRound":
      requireHost(isHost);
      requirePhase(room, "playing");
      endRound(room);
      return room;

    case "next":
      requireHost(isHost);
      requirePhase(room, "results");
      if (room.round + 1 < room.locations.length) {
        room.round++;
        startRound(room, now);
      } else {
        room.phase = "final";
      }
      return room;

    case "lobby":
      requireHost(isHost);
      requirePhase(room, "final");
      room.phase = "lobby";
      room.round = 0;
      room.locations = [];
      room.guesses = [];
      delete room.roundEndsAt;
      return room;
  }
}

export function handleDisconnect(current: Room, connected: Set<string>): Room {
  const room = structuredClone(current);
  // In the lobby, leaving means leaving. Mid-game, keep their scores.
  if (room.phase === "lobby") room.players = room.players.filter((p) => connected.has(p.id));
  if (!connected.has(room.hostId)) {
    const next = room.players.find((p) => connected.has(p.id));
    if (next) room.hostId = next.id;
  }
  if (room.phase === "playing" && everyoneGuessed(room, connected)) endRound(room);
  return room;
}

export function handleAlarm(current: Room, now: number): Room {
  if (current.phase !== "playing" || current.roundEndsAt === undefined || now < current.roundEndsAt + ROUND_GRACE_MS) return current;
  const room = structuredClone(current);
  endRound(room);
  return room;
}

// When the server should next wake up on its own: to close a timed round, or
// to check whether everyone has gone home.
export function nextAlarmAt(room: Room, now: number, idleMs: number): number {
  if (room.phase === "playing" && room.roundEndsAt !== undefined) return room.roundEndsAt + ROUND_GRACE_MS;
  return now + idleMs;
}

export function snapshot(room: Room, connected: Set<string>): PartyState {
  const revealed = room.phase === "lobby" ? 0 : room.round + 1;
  const playing = room.phase === "playing";
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    settings: room.settings,
    players: room.players.map((p) => ({ ...p, connected: connected.has(p.id) })),
    round: room.round,
    locations: room.locations.slice(0, revealed),
    roundEndsAt: playing ? room.roundEndsAt : undefined,
    guesses: room.guesses.slice(0, playing ? room.round : revealed),
    guessed: playing ? Object.keys(room.guesses[room.round] ?? {}) : [],
  };
}

function join(
  current: Room | undefined,
  code: string,
  playerId: string,
  msg: Extract<ClientMessage, { type: "join" }>,
  connected: Set<string>,
): Room {
  if (typeof msg.playerId !== "string" || !msg.playerId || msg.playerId.length > 64) {
    throw new PartyError("invalid", "Missing player id.");
  }
  const othersHere = current?.players.some((p) => p.id !== playerId && connected.has(p.id)) ?? false;
  if (msg.create && othersHere) throw new PartyError("taken", `Party code ${code} is already in use.`);
  if (!current && !msg.create) throw new PartyError("missing", `There's no party ${code}. Check the code?`);

  // Creating over an abandoned room starts fresh.
  const room: Room =
    current && !(msg.create && !othersHere)
      ? structuredClone(current)
      : { code, hostId: playerId, phase: "lobby", settings: DEFAULT_PARTY_SETTINGS, players: [], round: 0, locations: [], guesses: [] };

  const name = cleanName(msg.name) || `Player ${room.players.length + 1}`;
  const existing = room.players.find((p) => p.id === playerId);
  if (existing) {
    existing.name = name;
  } else {
    if (room.players.length >= MAX_PLAYERS) throw new PartyError("full", `Party ${code} is full.`);
    const color = PLAYER_COLORS.find((c) => !room.players.some((p) => p.color === c)) ?? PLAYER_COLORS[0];
    room.players.push({ id: playerId, name, color });
  }
  if (!room.players.some((p) => p.id === room.hostId && connected.has(p.id))) room.hostId = playerId;
  return room;
}

function startRound(room: Room, now: number) {
  room.phase = "playing";
  room.guesses[room.round] = {};
  if (room.settings.timeLimit > 0) room.roundEndsAt = now + room.settings.timeLimit * 1000;
  else delete room.roundEndsAt;
}

function endRound(room: Room) {
  room.phase = "results";
  delete room.roundEndsAt;
}

function everyoneGuessed(room: Room, connected: Set<string>): boolean {
  const guesses = room.guesses[room.round] ?? {};
  const active = room.players.filter((p) => connected.has(p.id));
  return active.length > 0 && active.every((p) => guesses[p.id]);
}

function score(room: Room, position: LatLng | null): PartyGuess {
  if (!position) return { score: 0 };
  const distance = distanceKm(position, room.locations[room.round]);
  return { position, distance, score: roundScore(distance, getMap(room.settings.mapId).maxDistanceKm) };
}

function requireHost(isHost: boolean) {
  if (!isHost) throw new PartyError("invalid", "Only the host can do that.");
}

function requirePhase(room: Room, phase: PartyPhase) {
  if (room.phase !== phase) throw new PartyError("invalid", `Can't do that during ${room.phase}.`);
}

function validSettings(s: PartySettings): PartySettings {
  if (
    !s ||
    !MAPS.some((m) => m.id === s.mapId) ||
    !MOVEMENTS.includes(s.movement) ||
    !PARTY_TIME_LIMITS.includes(s.timeLimit) ||
    !PARTY_ROUNDS.includes(s.rounds)
  ) {
    throw new PartyError("invalid", "Those settings aren't allowed.");
  }
  return { mapId: s.mapId, movement: s.movement, timeLimit: s.timeLimit, rounds: s.rounds };
}

function cleanName(name: unknown): string {
  // Strip control characters and cap length; names are shown to everyone.
  return typeof name === "string" ? name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 20) : "";
}

function isLatLng(p: unknown): p is LatLng {
  const { lat, lng } = (p ?? {}) as Partial<LatLng>;
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat!) <= 90 && Math.abs(lng!) <= 180;
}

function cleanLocation({ lat, lng, panoId, heading, country, label }: Location): Location {
  return {
    lat,
    lng,
    panoId,
    heading,
    country: typeof country === "string" ? country.slice(0, 2) : undefined,
    label: typeof label === "string" ? label.slice(0, 80) : undefined,
  };
}

function isLocation(l: unknown): l is Location {
  const { panoId, heading } = (l ?? {}) as Partial<Location>;
  return isLatLng(l) && typeof panoId === "string" && panoId.length > 0 && panoId.length < 200 && Number.isFinite(heading);
}
