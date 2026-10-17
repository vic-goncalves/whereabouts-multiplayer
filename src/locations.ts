import { inBounds, weightedPick, type Countries } from "./countries";
import type { LatLng } from "./geo";
import type { GameMap } from "./maps";
import type { Location } from "./types";

export type Panorama = LatLng & { panoId: string; copyright: string; linkHeadings: number[] };

// Finds the nearest official outdoor Street View panorama within `radius`
// meters, or null if there is none.
export type FindPanorama = (location: LatLng, radius: number) => Promise<Panorama | null>;

const MAX_ATTEMPTS = 60;
const REGION_RADIUS_M = 50_000;
const LANDMARK_RADIUS_M = 500;

export async function findLocation(
  map: GameMap,
  countries: Countries,
  findPanorama: FindPanorama,
  { exclude = new Set<string>(), requireCountry = false, random = Math.random } = {},
): Promise<Location> {
  const weights = Object.entries(map.countries ?? {});

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let target: LatLng | undefined;
    let label: string | undefined;
    let radius = REGION_RADIUS_M;
    if (map.landmarks) {
      const landmark = map.landmarks[Math.floor(random() * map.landmarks.length)];
      target = landmark;
      label = landmark.name;
      radius = LANDMARK_RADIUS_M;
    } else {
      const [iso] = weightedPick(weights, ([, w]) => w, random);
      target = countries.randomPoint(iso, map.bounds, random);
    }
    if (!target) continue;

    const pano = await findPanorama(target, radius);
    // Photospheres and dead-end panoramas have no links, and anything not
    // credited to Google is user-contributed imagery.
    if (!pano || pano.linkHeadings.length === 0 || !pano.copyright.includes("Google")) continue;
    if (exclude.has(pano.panoId)) continue;

    const country = countries.at(pano)?.iso;
    if (requireCountry && !country) continue;
    if (map.bounds && !(country && map.countries?.[country] && inBounds(pano, map.bounds))) continue;

    return {
      lat: pano.lat,
      lng: pano.lng,
      panoId: pano.panoId,
      // Face down the road, like the Street View car did.
      heading: pano.linkHeadings[Math.floor(random() * pano.linkHeadings.length)],
      country,
      label,
    };
  }
  throw new Error(`Couldn't find Street View coverage on "${map.name}" after ${MAX_ATTEMPTS} tries.`);
}

