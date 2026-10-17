export type LatLng = { lat: number; lng: number };

export type Units = "km" | "mi";

const EARTH_RADIUS_KM = 6371.0088;
const KM_PER_MILE = 1.609344;

// GeoGuessr's world map uses this as its scoring scale. Regional maps use the
// diagonal of their bounds instead, so a 500 km miss in Japan hurts more than
// a 500 km miss on the world map.
export const WORLD_MAX_DISTANCE_KM = 14916.862;

export const MAX_ROUND_SCORE = 5000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function roundScore(distance: number, maxDistanceKm: number): number {
  if (distance <= 0.025) return MAX_ROUND_SCORE;
  return Math.round(MAX_ROUND_SCORE * Math.exp((-10 * distance) / maxDistanceKm));
}

export function formatDistance(distance: number, units: Units): string {
  if (units === "mi") {
    const miles = distance / KM_PER_MILE;
    if (miles < 1) return `${Math.round(miles * 5280).toLocaleString()} ft`;
    return `${formatNumber(miles)} mi`;
  }
  if (distance < 1) return `${Math.round(distance * 1000).toLocaleString()} m`;
  return `${formatNumber(distance)} km`;
}

function formatNumber(n: number): string {
  return n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString();
}
