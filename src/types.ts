// Types shared by the browser app and the party server (party/worker.ts).
// Keep this file free of browser APIs so the worker can typecheck it.
import type { LatLng } from "./geo";

export type Bounds = { south: number; west: number; north: number; east: number };

export type Location = LatLng & {
  panoId: string;
  heading: number;
  country?: string;
  label?: string;
};

export type Mode = "classic" | "streak";
export type Movement = "moving" | "no-move" | "nmpz";
