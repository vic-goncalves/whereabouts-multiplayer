import type { Bounds } from "./types";
import { distanceKm, WORLD_MAX_DISTANCE_KM } from "./geo";
import { LANDMARKS, type Landmark } from "./landmarks";

export type GameMap = {
  id: string;
  name: string;
  description: string;
  // Region maps sample random points inside these countries (ISO 3166-1
  // alpha-2 -> relative weight), clipped to `bounds`. Landmark maps pick from
  // a fixed list instead.
  countries?: Record<string, number>;
  landmarks?: Landmark[];
  bounds?: Bounds;
  maxDistanceKm: number;
};

// Countries with official Google Street View car coverage, weighted roughly by
// how much road coverage they have.
const EUROPE: Record<string, number> = {
  FR: 3, ES: 2.5, GB: 2, DE: 2, IT: 2, PL: 1.5, SE: 1.5, NO: 1.5, FI: 1.5, UA: 1, RO: 1,
  GR: 1, PT: 1, CZ: 0.7, HU: 0.6, AT: 0.6, DK: 0.6, IE: 0.6, NL: 0.6, BG: 0.6, BE: 0.5,
  CH: 0.5, HR: 0.5, RS: 0.5, IS: 0.5, LT: 0.4, SK: 0.4, EE: 0.3, LV: 0.3, SI: 0.3, AL: 0.3,
  MK: 0.3, ME: 0.2, BA: 0.3, LU: 0.1, MT: 0.1, FO: 0.1, AD: 0.05, MC: 0.03, SM: 0.03, LI: 0.03,
};

const AMERICAS_SOUTH: Record<string, number> = {
  BR: 6, AR: 3, MX: 3.5, CL: 2, PE: 1.5, CO: 1.5, BO: 1, EC: 0.8, UY: 0.6, GT: 0.5,
  DO: 0.4, PA: 0.3, CR: 0.3, PR: 0.2, CW: 0.05,
};

const ASIA: Record<string, number> = {
  JP: 4, IN: 3, ID: 2.5, TH: 2, TR: 2, PH: 1.5, KZ: 1, MY: 1, MN: 1, VN: 1, TW: 0.6,
  KR: 0.6, KH: 0.5, LA: 0.4, LK: 0.4, BD: 0.4, KG: 0.4, IL: 0.4, JO: 0.3, AE: 0.3,
  BT: 0.2, SG: 0.1, QA: 0.1, HK: 0.1, MO: 0.05,
};

const AFRICA: Record<string, number> = {
  ZA: 2.5, KE: 1, NG: 0.8, BW: 0.8, GH: 0.5, UG: 0.5, SN: 0.4, TN: 0.4, NA: 0.4, RW: 0.2,
  LS: 0.2, SZ: 0.2,
};

const WORLD: Record<string, number> = {
  US: 12, RU: 7, CA: 5, AU: 5, NZ: 1.5,
  ...EUROPE, ...AMERICAS_SOUTH, ...ASIA, ...AFRICA,
};

const boundsDiagonal = (b: Bounds) =>
  distanceKm({ lat: b.south, lng: b.west }, { lat: b.north, lng: b.east });

const region = (map: Omit<GameMap, "maxDistanceKm"> & { bounds: Bounds }): GameMap => ({
  ...map,
  maxDistanceKm: boundsDiagonal(map.bounds),
});

export const MAPS: GameMap[] = [
  {
    id: "world",
    name: "World",
    description: "Anywhere Street View has been. The classic.",
    countries: WORLD,
    maxDistanceKm: WORLD_MAX_DISTANCE_KM,
  },
  {
    id: "landmarks",
    name: "Famous Places",
    description: "Iconic landmarks and the streets around them.",
    landmarks: LANDMARKS,
    maxDistanceKm: WORLD_MAX_DISTANCE_KM,
  },
  region({
    id: "europe",
    name: "Europe",
    description: "From the fjords to the Mediterranean.",
    countries: EUROPE,
    bounds: { south: 34, west: -25, north: 72, east: 45 },
  }),
  region({
    id: "usa",
    name: "United States",
    description: "The lower 48, coast to coast.",
    countries: { US: 1 },
    bounds: { south: 24.4, west: -124.8, north: 49.4, east: -66.9 },
  }),
  region({
    id: "latam",
    name: "Latin America",
    description: "Mexico to Tierra del Fuego.",
    countries: AMERICAS_SOUTH,
    bounds: { south: -56, west: -118, north: 33, east: -34 },
  }),
  region({
    id: "asia",
    name: "Asia",
    description: "Megacities, rice terraces and the steppe.",
    countries: ASIA,
    bounds: { south: -11, west: 25, north: 56, east: 146 },
  }),
  region({
    id: "japan",
    name: "Japan",
    description: "Hokkaido to Okinawa.",
    countries: { JP: 1 },
    bounds: { south: 24, west: 122.9, north: 45.6, east: 146 },
  }),
  region({
    id: "africa",
    name: "Africa",
    description: "Every African country with Street View.",
    countries: AFRICA,
    bounds: { south: -35, west: -18, north: 38, east: 42 },
  }),
  region({
    id: "oceania",
    name: "Australia & NZ",
    description: "Outback highways and Kiwi backroads.",
    countries: { AU: 4, NZ: 1.5 },
    bounds: { south: -47.5, west: 112, north: -10, east: 179 },
  }),
];

export function getMap(id: string): GameMap {
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}
