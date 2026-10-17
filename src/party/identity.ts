import { CODE_ALPHABET, CODE_LENGTH } from "./protocol";

const PLAYER_KEY = "whereabouts:player";

// One player per browser tab, stable across reloads so a refresh rejoins as
// the same person. (Two tabs = two players, which is handy for testing.)
export function tabPlayerId(): string {
  try {
    const existing = sessionStorage.getItem(PLAYER_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(PLAYER_KEY, id);
    return id;
  } catch {
    // Storage blocked: still playable, just not refresh-proof.
    return crypto.randomUUID();
  }
}

export function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function partyCodeFromUrl(): string | undefined {
  const code = new URLSearchParams(window.location.search).get("party")?.toUpperCase();
  return code && new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code) ? code : undefined;
}
