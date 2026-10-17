import { describe, expect, it } from "vitest";
import { decodeChallenge, encodeChallenge, type Challenge } from "./challenge";

const challenge: Challenge = {
  mapId: "landmarks",
  movement: "nmpz",
  timeLimit: 60,
  locations: [
    { lat: 48.858412, lng: 2.294491, panoId: "AF1QipN-abc_123", heading: 123, country: "FR", label: "Eiffel Tower, Paris" },
    { lat: -22.951916, lng: -43.210487, panoId: "xyz", heading: 0, country: "BR", label: "Christ the Redeemer, Rio de Janeiro" },
    { lat: 64.141706, lng: -21.926638, panoId: "q", heading: 359, label: "Hallgrímskirkja, Reykjavík" },
    { lat: 35.6595, lng: 139.7005, panoId: "plain", heading: 10 },
  ],
};

describe("challenge links", () => {
  it("round-trips a game, including non-ASCII labels", () => {
    expect(decodeChallenge(encodeChallenge(challenge))).toEqual(challenge);
  });

  it("is URL-safe", () => {
    expect(encodeChallenge(challenge)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects garbage instead of throwing", () => {
    expect(decodeChallenge("not-a-challenge")).toBeUndefined();
    expect(decodeChallenge("")).toBeUndefined();
    const bad = btoa(JSON.stringify({ m: "world", v: "teleport", t: 0, l: [[1, 2, "p", 0]] }));
    expect(decodeChallenge(bad)).toBeUndefined();
    const empty = btoa(JSON.stringify({ m: "world", v: "moving", t: 0, l: [] }));
    expect(decodeChallenge(empty)).toBeUndefined();
  });
});
