import { describe, expect, it } from "vitest";
import { weightedPick } from "./countries";
import { countries, seeded } from "./test/helpers";

describe("Countries.at", () => {
  it.each([
    ["Paris", 48.8566, 2.3522, "FR"],
    ["New York", 40.7128, -74.006, "US"],
    ["Tokyo", 35.6762, 139.6503, "JP"],
    ["São Paulo", -23.5505, -46.6333, "BR"],
    ["Colosseum", 41.8902, 12.4922, "IT"],
    ["Honolulu", 21.3069, -157.8583, "US"],
    // Lesotho is a hole in South Africa's polygon.
    ["Maseru", -29.31, 27.48, "LS"],
    ["Johannesburg", -26.2041, 28.0473, "ZA"],
    ["Singapore", 1.3521, 103.8198, "SG"],
    // Just off the simplified coastline; snapped to the nearest country.
    ["Battery Park", 40.7033, -74.017, "US"],
    ["Sydney Harbour", -33.8523, 151.2108, "AU"],
  ])("puts %s in %s", (_, lat, lng, iso) => {
    expect(countries.at({ lat, lng })?.iso).toBe(iso);
  });

  it("returns undefined over open ocean", () => {
    expect(countries.at({ lat: 30, lng: -40 })).toBeUndefined();
    expect(countries.at({ lat: -40, lng: -120 })).toBeUndefined();
    // ~100 km off Long Island: too far to count as the coast.
    expect(countries.at({ lat: 40.0, lng: -71.5 })).toBeUndefined();
  });

  it("has readable names", () => {
    expect(countries.get("US")?.name).toBe("United States");
    expect(countries.get("CZ")?.name).toBe("Czechia");
    expect(countries.get("BA")?.name).toBe("Bosnia and Herzegovina");
  });
});

describe("Countries.randomPoint", () => {
  it("only returns points inside the requested country", () => {
    const random = seeded(1);
    for (const iso of ["JP", "CL", "NO", "ID", "LS", "MC"]) {
      for (let i = 0; i < 25; i++) {
        const point = countries.randomPoint(iso, undefined, random);
        expect(countries.at(point!)?.iso).toBe(iso);
      }
    }
  });

  it("respects bounds, e.g. mainland France only", () => {
    const random = seeded(2);
    const europe = { south: 34, west: -25, north: 72, east: 45 };
    for (let i = 0; i < 200; i++) {
      const point = countries.randomPoint("FR", europe, random)!;
      expect(point.lat).toBeGreaterThan(34);
      expect(point.lng).toBeGreaterThan(-25);
    }
  });

  it("returns undefined when the country has no land in bounds", () => {
    expect(countries.randomPoint("US", { south: 24, west: 122, north: 46, east: 146 })).toBeUndefined();
    expect(countries.randomPoint("XX")).toBeUndefined();
  });

  it("spreads points by area rather than favoring small islands", () => {
    const random = seeded(3);
    let mainland = 0;
    for (let i = 0; i < 300; i++) {
      const p = countries.randomPoint("GB", undefined, random)!;
      // Great Britain's mainland is ~94% of the UK's area.
      if (p.lat < 58.7 && p.lat > 50 && p.lng > -6.5) mainland++;
    }
    expect(mainland / 300).toBeGreaterThan(0.75);
  });
});

describe("weightedPick", () => {
  it("picks in proportion to weight", () => {
    const random = seeded(4);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++) counts[weightedPick(["a", "b"] as const, (x) => (x === "a" ? 3 : 1), random)]++;
    expect(counts.a / 4000).toBeCloseTo(0.75, 1);
  });
});
