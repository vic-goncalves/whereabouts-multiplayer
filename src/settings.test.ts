import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, loadBest, loadSettings, recordBest, saveSettings } from "./settings";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

const game = { mapId: "world", mode: "classic", movement: "moving" } as const;

describe("settings and personal bests", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("only records a best when the score improves", () => {
    expect(recordBest(game, 12_000)).toBe(true);
    expect(recordBest(game, 9_000)).toBe(false);
    expect(recordBest(game, 12_000)).toBe(false);
    expect(recordBest(game, 18_500)).toBe(true);
    expect(loadBest(game)).toBe(18_500);
  });

  it("tracks bests separately per map, mode and movement", () => {
    recordBest(game, 20_000);
    expect(loadBest({ ...game, movement: "nmpz" })).toBeUndefined();
    expect(loadBest({ ...game, mode: "streak" })).toBeUndefined();
  });

  it("round-trips settings and fills in new defaults", () => {
    saveSettings({ ...DEFAULT_SETTINGS, mapId: "japan", timeLimit: 30 });
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, mapId: "japan", timeLimit: 30 });
    localStorage.setItem("whereabouts:settings", JSON.stringify({ mapId: "usa" }));
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, mapId: "usa" });
  });

  it("works when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(recordBest(game, 100)).toBe(true);
    expect(loadBest(game)).toBeUndefined();
  });
});
