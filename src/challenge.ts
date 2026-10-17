import type { Location, Movement } from "./types";

// A challenge is a whole game packed into the URL, so friends can play the
// same five locations without a server.
export type Challenge = {
  mapId: string;
  movement: Movement;
  timeLimit: number;
  locations: Location[];
};

type Packed = {
  m: string;
  v: Movement;
  t: number;
  l: [lat: number, lng: number, panoId: string, heading: number, country?: string, label?: string][];
};

const MOVEMENTS: Movement[] = ["moving", "no-move", "nmpz"];

export function encodeChallenge(c: Challenge): string {
  const packed: Packed = {
    m: c.mapId,
    v: c.movement,
    t: c.timeLimit,
    l: c.locations.map((loc) => {
      const row: Packed["l"][number] = [round(loc.lat, 6), round(loc.lng, 6), loc.panoId, Math.round(loc.heading)];
      if (loc.country || loc.label) row.push(loc.country ?? "");
      if (loc.label) row.push(loc.label);
      return row;
    }),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(packed));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeChallenge(encoded: string): Challenge | undefined {
  try {
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const packed = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)))) as Packed;
    if (typeof packed.m !== "string" || !MOVEMENTS.includes(packed.v) || typeof packed.t !== "number") return undefined;
    if (!Array.isArray(packed.l) || packed.l.length === 0) return undefined;
    const locations = packed.l.map(([lat, lng, panoId, heading, country, label]) => {
      if (typeof lat !== "number" || typeof lng !== "number" || typeof panoId !== "string") throw new Error("bad row");
      return { lat, lng, panoId, heading: Number(heading) || 0, country: country || undefined, label: label || undefined };
    });
    return { mapId: packed.m, movement: packed.v, timeLimit: packed.t, locations };
  } catch {
    // Mangled or hand-edited link: treat it as no challenge at all.
    return undefined;
  }
}

function round(n: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
