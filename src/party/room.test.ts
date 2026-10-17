import { describe, expect, it } from "vitest";
import type { Location } from "../types";
import type { ClientMessage } from "./protocol";
import {
  applyMessage,
  handleAlarm,
  handleDisconnect,
  MAX_PLAYERS,
  nextAlarmAt,
  PartyError,
  ROUND_GRACE_MS,
  snapshot,
  type Room,
} from "./room";

const PARIS: Location = { lat: 48.8584, lng: 2.2945, panoId: "paris", heading: 90, country: "FR" };
const TOKYO: Location = { lat: 35.6595, lng: 139.7005, panoId: "tokyo", heading: 0, country: "JP" };
const T0 = 1_000_000;

const join = (playerId: string, name = playerId, create = false): ClientMessage => ({ type: "join", playerId, name, create });

// Drives a room the way the worker does: every message comes from a player
// whose socket is open, tracked in `connected`.
function party(...ids: string[]) {
  const connected = new Set<string>();
  let room: Room | undefined;
  const send = (playerId: string, msg: ClientMessage, now = T0) => {
    connected.add(playerId);
    room = applyMessage(room, "ABCD", playerId, msg, connected, now);
    return room;
  };
  ids.forEach((id, i) => send(id, join(id, id, i === 0)));
  return {
    send,
    connected,
    get room() {
      return room!;
    },
    leave(playerId: string) {
      connected.delete(playerId);
      room = handleDisconnect(room!, connected);
      return room;
    },
    start(locations = [PARIS, TOKYO], now = T0) {
      return send(ids[0], { type: "start", locations }, now);
    },
  };
}

const errorReason = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof PartyError) return e.reason;
    throw e;
  }
  return undefined;
};

describe("joining", () => {
  it("makes the creator host and gives everyone a distinct color", () => {
    const p = party("ann", "bob", "cat");
    expect(p.room.hostId).toBe("ann");
    expect(p.room.players.map((x) => x.name)).toEqual(["ann", "bob", "cat"]);
    expect(new Set(p.room.players.map((x) => x.color)).size).toBe(3);
  });

  it("rejects joining a party that doesn't exist", () => {
    expect(errorReason(() => applyMessage(undefined, "ZZZZ", "ann", join("ann"), new Set(["ann"]), T0))).toBe("missing");
  });

  it("refuses to create over a party someone is in, but reuses an abandoned one", () => {
    const p = party("ann");
    expect(errorReason(() => applyMessage(p.room, "ABCD", "bob", join("bob", "bob", true), new Set(["ann", "bob"]), T0))).toBe("taken");
    const fresh = applyMessage(p.room, "ABCD", "bob", join("bob", "bob", true), new Set(["bob"]), T0);
    expect(fresh.hostId).toBe("bob");
    expect(fresh.players.map((x) => x.id)).toEqual(["bob"]);
  });

  it("lets a player rejoin under the same id without duplicating them", () => {
    const p = party("ann", "bob");
    p.send("bob", join("bob", "Bobby"));
    expect(p.room.players.map((x) => x.name)).toEqual(["ann", "Bobby"]);
  });

  it("cleans up names and caps the party size", () => {
    const p = party("ann");
    p.send("x", join("x", "  \u0007Zed the Destroyer of Worlds  "));
    expect(p.room.players[1].name).toBe("Zed the Destroyer of");
    p.send("y", join("y", "   "));
    expect(p.room.players[2].name).toBe("Player 3");
    for (let i = p.room.players.length; i < MAX_PLAYERS; i++) p.send(`p${i}`, join(`p${i}`));
    expect(errorReason(() => p.send("late", join("late")))).toBe("full");
  });
});

describe("host controls", () => {
  it("only lets the host change settings and start", () => {
    const p = party("ann", "bob");
    expect(errorReason(() => p.send("bob", { type: "settings", changes: { mapId: "japan" } }))).toBe("invalid");
    p.send("ann", { type: "settings", changes: { mapId: "japan" } });
    p.send("ann", { type: "settings", changes: { rounds: 3 } });
    p.send("ann", { type: "settings", changes: { timeLimit: 30 } });
    expect(p.room.settings).toEqual({ mapId: "japan", movement: "moving", timeLimit: 30, rounds: 3 });
    expect(errorReason(() => p.send("bob", { type: "start", locations: [PARIS] }))).toBe("invalid");
  });

  it("rejects settings outside the allowed options", () => {
    const p = party("ann");
    expect(errorReason(() => p.send("ann", { type: "settings", changes: { mapId: "mars" } }))).toBe("invalid");
    expect(errorReason(() => p.send("ann", { type: "settings", changes: { timeLimit: 7 } }))).toBe("invalid");
    expect(p.room.settings.mapId).toBe("world");
  });

  it("validates and sanitizes the host's locations", () => {
    const p = party("ann");
    expect(errorReason(() => p.start([]))).toBe("invalid");
    expect(errorReason(() => p.start([{ ...PARIS, lat: 200 }]))).toBe("invalid");
    p.start([{ ...PARIS, label: "x".repeat(500) }]);
    expect(p.room.locations[0].label).toHaveLength(80);
    expect(p.room.settings.rounds).toBe(1);
  });

  it("hands host to someone still here when the host leaves", () => {
    const p = party("ann", "bob", "cat");
    p.leave("ann");
    expect(p.room.hostId).toBe("bob");
    expect(p.room.players.map((x) => x.id)).toEqual(["bob", "cat"]);
  });
});

describe("rounds", () => {
  it("scores guesses and ends the round once everyone has guessed", () => {
    const p = party("ann", "bob");
    p.start();
    expect(p.room.phase).toBe("playing");
    expect(p.room.roundEndsAt).toBe(T0 + 60_000);

    p.send("ann", { type: "guess", round: 0, position: { lat: 48.86, lng: 2.35 } });
    expect(p.room.phase).toBe("playing");
    p.send("bob", { type: "guess", round: 0, position: null });
    expect(p.room.phase).toBe("results");

    const [ann, bob] = [p.room.guesses[0].ann, p.room.guesses[0].bob];
    expect(ann.distance).toBeCloseTo(4.1, 0);
    expect(ann.score).toBeGreaterThan(4900);
    expect(bob).toEqual({ score: 0 });
  });

  it("ignores repeat, stale and out-of-phase guesses", () => {
    const p = party("ann", "bob");
    p.start();
    p.send("ann", { type: "guess", round: 0, position: { lat: 0, lng: 0 } });
    p.send("ann", { type: "guess", round: 0, position: { lat: 48.86, lng: 2.35 } });
    expect(p.room.guesses[0].ann.position).toEqual({ lat: 0, lng: 0 });
    p.send("bob", { type: "guess", round: 3, position: null });
    expect(p.room.guesses[0].bob).toBeUndefined();
    expect(errorReason(() => p.send("bob", { type: "guess", round: 0, position: { lat: 99, lng: 0 } }))).toBe("invalid");
  });

  it("doesn't wait for players who left mid-round", () => {
    const p = party("ann", "bob");
    p.start();
    p.send("ann", { type: "guess", round: 0, position: null });
    p.leave("bob");
    expect(p.room.phase).toBe("results");
    expect(p.room.players).toHaveLength(2);
  });

  it("closes a timed round after the grace period", () => {
    const p = party("ann", "bob");
    p.start();
    const endsAt = p.room.roundEndsAt!;
    expect(nextAlarmAt(p.room, T0, 600_000)).toBe(endsAt + ROUND_GRACE_MS);
    expect(handleAlarm(p.room, endsAt).phase).toBe("playing");
    expect(handleAlarm(p.room, endsAt + ROUND_GRACE_MS).phase).toBe("results");
  });

  it("lets the host end a round early, and advances to the final standings", () => {
    const p = party("ann", "bob");
    p.start();
    expect(errorReason(() => p.send("bob", { type: "endRound" }))).toBe("invalid");
    p.send("ann", { type: "endRound" });
    expect(p.room.phase).toBe("results");
    p.send("ann", { type: "next" }, T0 + 5000);
    expect(p.room).toMatchObject({ phase: "playing", round: 1, roundEndsAt: T0 + 5000 + 60_000 });
    p.send("ann", { type: "endRound" });
    p.send("ann", { type: "next" });
    expect(p.room.phase).toBe("final");
    p.send("ann", { type: "lobby" });
    expect(p.room).toMatchObject({ phase: "lobby", round: 0, locations: [], guesses: [] });
    expect(p.room.players).toHaveLength(2);
  });

  it("has no deadline when the time limit is off", () => {
    const p = party("ann");
    p.send("ann", { type: "settings", changes: { timeLimit: 0 } });
    p.start();
    expect(p.room.roundEndsAt).toBeUndefined();
    expect(nextAlarmAt(p.room, T0, 600_000)).toBe(T0 + 600_000);
  });
});

describe("snapshot", () => {
  it("hides future locations and in-progress guesses", () => {
    const p = party("ann", "bob");
    p.start();
    p.send("ann", { type: "guess", round: 0, position: { lat: 1, lng: 1 } });
    const during = snapshot(p.room, p.connected);
    expect(during.locations.map((l) => l.panoId)).toEqual(["paris"]);
    expect(during.guesses).toEqual([]);
    expect(during.guessed).toEqual(["ann"]);

    p.send("bob", { type: "guess", round: 0, position: null });
    const after = snapshot(p.room, p.connected);
    expect(after.guesses[0].ann.position).toEqual({ lat: 1, lng: 1 });
    expect(after.guessed).toEqual([]);
  });

  it("marks who is connected", () => {
    const p = party("ann", "bob");
    p.start();
    p.leave("bob");
    expect(snapshot(p.room, p.connected).players.map((x) => [x.id, x.connected])).toEqual([
      ["ann", true],
      ["bob", false],
    ]);
  });
});
