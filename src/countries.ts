import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import type { LatLng } from "./geo";

export type Bounds = { south: number; west: number; north: number; east: number };

type Part = { rings: Position[][]; bbox: Bounds; area: number };

const COAST_TOLERANCE_KM = 15;
const KM_PER_DEGREE = 111.32;

export type Country = {
  iso: string;
  name: string;
  feature: Feature<Polygon | MultiPolygon>;
  parts: Part[];
  bbox: Bounds;
};

export class Countries {
  readonly byIso = new Map<string, Country>();

  constructor(collection: FeatureCollection<Polygon | MultiPolygon, { name: string }>) {
    for (const f of collection.features) {
      const iso = String(f.id);
      const polygons = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      const parts = polygons.map(toPart);
      this.byIso.set(iso, { iso, name: f.properties.name, feature: f, parts, bbox: unionBounds(parts.map((p) => p.bbox)) });
    }
  }

  get(iso: string): Country | undefined {
    return this.byIso.get(iso);
  }

  // The borders are simplified 1:50m outlines, so coastal spots (Manhattan,
  // Honolulu, harbor fronts) can land just "offshore". Those count as the
  // nearest country within COAST_TOLERANCE_KM.
  at(point: LatLng): Country | undefined {
    for (const country of this.byIso.values()) {
      if (!inBounds(point, country.bbox)) continue;
      if (country.parts.some((part) => inPart(point, part))) return country;
    }

    let nearest: Country | undefined;
    let nearestKm = COAST_TOLERANCE_KM;
    const margin = COAST_TOLERANCE_KM / KM_PER_DEGREE;
    for (const country of this.byIso.values()) {
      for (const part of country.parts) {
        if (!inBounds(point, expand(part.bbox, margin / Math.cos((point.lat * Math.PI) / 180), margin))) continue;
        const km = distanceToRingKm(point, part.rings[0]);
        if (km < nearestKm) {
          nearestKm = km;
          nearest = country;
        }
      }
    }
    return nearest;
  }

  // Uniform by area over the part of the country inside `bounds`. Returns
  // undefined if the country has no land inside `bounds`.
  randomPoint(iso: string, bounds?: Bounds, random: () => number = Math.random): LatLng | undefined {
    const country = this.byIso.get(iso);
    if (!country) return undefined;

    const candidates = country.parts
      .map((part) => ({ part, box: bounds ? intersect(part.bbox, bounds) : part.bbox }))
      .filter((c): c is { part: Part; box: Bounds } => c.box !== undefined);
    if (candidates.length === 0) return undefined;

    for (let attempt = 0; attempt < 500; attempt++) {
      const { part, box } = weightedPick(candidates, (c) => c.part.area * boxShare(c.part.bbox, c.box), random);
      const point = randomPointInBox(box, random);
      if (inPart(point, part)) return point;
    }
    return undefined;
  }
}

export function parseCountries(topology: Topology): Countries {
  const object = topology.objects.countries as GeometryCollection<{ name: string }>;
  return new Countries(feature(topology, object) as FeatureCollection<Polygon | MultiPolygon, { name: string }>);
}

let countriesPromise: Promise<Countries> | undefined;

export function loadCountries(): Promise<Countries> {
  countriesPromise ??= fetch(`${import.meta.env.BASE_URL}countries.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load countries.json (${res.status})`);
      return res.json();
    })
    .then(parseCountries);
  return countriesPromise;
}

export function weightedPick<T>(items: T[], weight: (item: T) => number, random: () => number = Math.random): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let r = random() * total;
  for (const item of items) {
    r -= weight(item);
    if (r < 0) return item;
  }
  return items[items.length - 1];
}

function toPart(rings: Position[][]): Part {
  const outer = rings[0];
  const bbox: Bounds = { south: 90, west: 180, north: -90, east: -180 };
  for (const [lng, lat] of outer) {
    bbox.south = Math.min(bbox.south, lat);
    bbox.north = Math.max(bbox.north, lat);
    bbox.west = Math.min(bbox.west, lng);
    bbox.east = Math.max(bbox.east, lng);
  }
  return { rings, bbox, area: ringArea(outer) };
}

// Planar shoelace area in square degrees, scaled by cos(latitude) so parts
// near the poles aren't overweighted. Only used for relative weighting.
function ringArea(ring: Position[]): number {
  let sum = 0;
  let latSum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
    latSum += ring[i][1];
  }
  const meanLat = latSum / ring.length;
  return (Math.abs(sum) / 2) * Math.cos((meanLat * Math.PI) / 180);
}

function inPart(point: LatLng, part: Part): boolean {
  if (!inBounds(point, part.bbox)) return false;
  const [outer, ...holes] = part.rings;
  return inRing(point, outer) && !holes.some((hole) => inRing(point, hole));
}

function inRing({ lat, lng }: LatLng, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inBounds({ lat, lng }: LatLng, b: Bounds): boolean {
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}

// Distance to the closest edge of `ring`, in a local equirectangular
// projection. Accurate enough at the tens-of-km scale it's used for.
function distanceToRingKm({ lat, lng }: LatLng, ring: Position[]): number {
  const kx = Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = (ring[j][0] - lng) * kx;
    const ay = ring[j][1] - lat;
    const bx = (ring[i][0] - lng) * kx;
    const by = ring[i][1] - lat;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best * KM_PER_DEGREE;
}

function expand(b: Bounds, lngMargin: number, latMargin: number): Bounds {
  return { south: b.south - latMargin, west: b.west - lngMargin, north: b.north + latMargin, east: b.east + lngMargin };
}

function unionBounds(boxes: Bounds[]): Bounds {
  return {
    south: Math.min(...boxes.map((b) => b.south)),
    west: Math.min(...boxes.map((b) => b.west)),
    north: Math.max(...boxes.map((b) => b.north)),
    east: Math.max(...boxes.map((b) => b.east)),
  };
}

function intersect(a: Bounds, b: Bounds): Bounds | undefined {
  const box = {
    south: Math.max(a.south, b.south),
    west: Math.max(a.west, b.west),
    north: Math.min(a.north, b.north),
    east: Math.min(a.east, b.east),
  };
  return box.south < box.north && box.west < box.east ? box : undefined;
}

function boxArea(b: Bounds): number {
  const rad = Math.PI / 180;
  return (Math.sin(b.north * rad) - Math.sin(b.south * rad)) * (b.east - b.west);
}

function boxShare(full: Bounds, clipped: Bounds): number {
  const area = boxArea(full);
  return area > 0 ? boxArea(clipped) / area : 0;
}

// Sampling sin(lat) uniformly gives points uniform by area rather than
// clustering toward the poles.
function randomPointInBox(b: Bounds, random: () => number): LatLng {
  const rad = Math.PI / 180;
  const sinSouth = Math.sin(b.south * rad);
  const sinNorth = Math.sin(b.north * rad);
  return {
    lat: Math.asin(sinSouth + random() * (sinNorth - sinSouth)) / rad,
    lng: b.west + random() * (b.east - b.west),
  };
}
