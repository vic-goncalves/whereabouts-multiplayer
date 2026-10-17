import type { Topology } from "topojson-specification";
import topology from "../../public/countries.json";
import { parseCountries } from "../countries";

export const countries = parseCountries(topology as unknown as Topology);

// Deterministic PRNG so sampling tests are reproducible.
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
