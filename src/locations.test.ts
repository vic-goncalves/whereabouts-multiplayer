import { describe, expect, it } from "vitest";
import type { LatLng } from "./geo";
import { findLocation, type FindPanorama, type Panorama } from "./locations";
import { getMap, MAPS } from "./maps";
import { countries, seeded } from "./test/helpers";

const official = (p: LatLng, panoId: string, linkHeadings = [90, 270]): Panorama => ({
  ...p,
  panoId,
  copyright: "© 2025 Google",
  linkHeadings,
});

// A fake Street View that has coverage exactly where you ask.
const everywhere: FindPanorama = async (location) => official(location, `pano-${location.lat.toFixed(5)},${location.lng.toFixed(5)}`);

// Replays `responses` in order, then behaves like `everywhere`.
function scripted(responses: (Panorama | null)[]): FindPanorama & { calls: number } {
  const fn = Object.assign(
    async (location: LatLng, radius: number) => {
      fn.calls++;
      return responses.length ? responses.shift()! : everywhere(location, radius);
    },
    { calls: 0 },
  );
  return fn;
}

describe("findLocation", () => {
  it("returns a panorama inside the map's countries, facing down the road", async () => {
    const loc = await findLocation(getMap("japan"), countries, everywhere, { random: seeded(1) });
    expect(loc.country).toBe("JP");
    expect([90, 270]).toContain(loc.heading);
  });

  it("skips user photospheres, dead ends and already-used panoramas", async () => {
    const tokyo = { lat: 35.68, lng: 139.76 };
    const find = scripted([
      { ...official(tokyo, "user"), copyright: "© Some Photographer" },
      official(tokyo, "dead-end", []),
      official(tokyo, "used"),
      official(tokyo, "good"),
    ]);
    const loc = await findLocation(getMap("japan"), countries, find, { exclude: new Set(["used"]), random: seeded(2) });
    expect(loc.panoId).toBe("good");
    expect(find.calls).toBe(4);
  });

  it("rejects panoramas that snapped across the border on regional maps", async () => {
    const montreal = { lat: 45.5, lng: -73.57 };
    const denver = { lat: 39.74, lng: -104.99 };
    const find = scripted([official(montreal, "canada"), official(denver, "usa")]);
    const loc = await findLocation(getMap("usa"), countries, find, { random: seeded(3) });
    expect(loc.panoId).toBe("usa");
    expect(loc.country).toBe("US");
  });

  it("keeps cross-border panoramas on the world map", async () => {
    const montreal = { lat: 45.5, lng: -73.57 };
    const loc = await findLocation(getMap("world"), countries, scripted([official(montreal, "canada")]), { random: seeded(4) });
    expect(loc.country).toBe("CA");
  });

  it("requires a known country in streak mode", async () => {
    const atSea = { lat: 30, lng: -40 };
    const lisbon = { lat: 38.72, lng: -9.14 };
    const find = scripted([official(atSea, "sea"), official(lisbon, "lisbon")]);
    const loc = await findLocation(getMap("world"), countries, find, { requireCountry: true, random: seeded(5) });
    expect(loc.panoId).toBe("lisbon");
    expect(loc.country).toBe("PT");
  });

  it("labels landmark rounds and searches close to the landmark", async () => {
    const radii: number[] = [];
    const find: FindPanorama = async (location, radius) => {
      radii.push(radius);
      return official(location, "landmark");
    };
    const loc = await findLocation(getMap("landmarks"), countries, find, { random: seeded(6) });
    expect(loc.label).toBeTruthy();
    expect(radii).toEqual([500]);
  });

  it("gives up with a clear error when there is no coverage", async () => {
    await expect(findLocation(getMap("europe"), countries, async () => null, { random: seeded(7) })).rejects.toThrow(
      /Couldn't find Street View coverage on "Europe"/,
    );
  });

  it("can find a location on every map", async () => {
    for (const map of MAPS) {
      const loc = await findLocation(map, countries, everywhere, { random: seeded(8) });
      expect(loc.panoId).toBeTruthy();
    }
  });
});
