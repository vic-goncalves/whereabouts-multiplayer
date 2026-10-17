import { describe, expect, it } from "vitest";
import { distanceKm, formatDistance, MAX_ROUND_SCORE, roundScore, WORLD_MAX_DISTANCE_KM } from "./geo";

const PARIS = { lat: 48.8566, lng: 2.3522 };
const LONDON = { lat: 51.5074, lng: -0.1278 };
const SYDNEY = { lat: -33.8688, lng: 151.2093 };

describe("distanceKm", () => {
  it("matches known great-circle distances", () => {
    expect(distanceKm(PARIS, LONDON)).toBeCloseTo(343.5, 0);
    expect(distanceKm(PARIS, SYDNEY)).toBeCloseTo(16_960, -2);
  });

  it("is symmetric and zero for the same point", () => {
    expect(distanceKm(PARIS, PARIS)).toBe(0);
    expect(distanceKm(LONDON, SYDNEY)).toBeCloseTo(distanceKm(SYDNEY, LONDON), 9);
  });

  it("handles the antimeridian", () => {
    expect(distanceKm({ lat: 0, lng: 179.5 }, { lat: 0, lng: -179.5 })).toBeCloseTo(111.2, 0);
  });
});

describe("roundScore", () => {
  it("gives a perfect score within 25 m", () => {
    expect(roundScore(0, WORLD_MAX_DISTANCE_KM)).toBe(MAX_ROUND_SCORE);
    expect(roundScore(0.025, WORLD_MAX_DISTANCE_KM)).toBe(MAX_ROUND_SCORE);
  });

  it("decays exponentially with distance", () => {
    expect(roundScore(100, WORLD_MAX_DISTANCE_KM)).toBe(4676);
    expect(roundScore(1000, WORLD_MAX_DISTANCE_KM)).toBe(2558);
    expect(roundScore(WORLD_MAX_DISTANCE_KM, WORLD_MAX_DISTANCE_KM)).toBe(0);
  });

  it("is harsher on smaller maps", () => {
    expect(roundScore(500, 3000)).toBeLessThan(roundScore(500, WORLD_MAX_DISTANCE_KM));
  });
});

describe("formatDistance", () => {
  it("formats metric distances", () => {
    expect(formatDistance(0.42, "km")).toBe("420 m");
    expect(formatDistance(3.456, "km")).toBe("3.5 km");
    expect(formatDistance(1234.4, "km")).toBe("1,234 km");
  });

  it("formats imperial distances", () => {
    expect(formatDistance(0.5, "mi")).toBe("1,640 ft");
    expect(formatDistance(1609.344, "mi")).toBe("1,000 mi");
  });
});
