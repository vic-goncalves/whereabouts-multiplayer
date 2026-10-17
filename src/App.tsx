import { useEffect, useState } from "react";
import { decodeChallenge, type Challenge } from "./challenge";
import { Game } from "./components/Game";
import { Home } from "./components/Home";
import { loadCountries, type Countries } from "./countries";
import { API_KEY, loadGoogleMaps } from "./google";
import { loadSettings, saveSettings, type Settings } from "./settings";

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

type ActiveGame = { key: number; settings: Settings; challenge?: Challenge };

function challengeFromUrl(): Challenge | undefined {
  const encoded = new URLSearchParams(window.location.search).get("c");
  return encoded ? decodeChallenge(encoded) : undefined;
}

export function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [challenge, setChallenge] = useState(challengeFromUrl);
  const [game, setGame] = useState<ActiveGame>();
  const [countries, setCountries] = useState<Countries>();
  const [fatal, setFatal] = useState<string>();

  useEffect(() => {
    if (!API_KEY) return;
    // Google calls this global when it rejects the key (bad key, referrer
    // not allowed, API not enabled, billing off).
    window.gm_authFailure = () =>
      setFatal("Google Maps rejected the API key. Check that it allows this site's URL and that the Maps JavaScript API is enabled.");
    Promise.all([loadGoogleMaps(), loadCountries()]).then(
      ([, loaded]) => setCountries(loaded),
      (e: unknown) => setFatal(e instanceof Error ? e.message : String(e)),
    );
  }, []);

  const updateSettings = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
  };

  const clearChallenge = () => {
    setChallenge(undefined);
    window.history.replaceState(null, "", window.location.pathname);
  };

  const start = (activeChallenge?: Challenge) => {
    const gameSettings: Settings = activeChallenge
      ? { ...settings, mode: "classic", mapId: activeChallenge.mapId, movement: activeChallenge.movement, timeLimit: activeChallenge.timeLimit }
      : settings;
    setGame((g) => ({ key: (g?.key ?? 0) + 1, settings: gameSettings, challenge: activeChallenge }));
    if (activeChallenge) clearChallenge();
  };

  if (!API_KEY) return <Setup />;
  if (fatal) return <Fatal message={fatal} />;

  if (game && countries) {
    return (
      <Game
        key={game.key}
        settings={game.settings}
        challenge={game.challenge}
        countries={countries}
        onExit={() => setGame(undefined)}
        onReplay={() => setGame((g) => g && { key: g.key + 1, settings: g.settings })}
      />
    );
  }

  return (
    <Home
      settings={settings}
      onChange={updateSettings}
      onPlay={() => start()}
      challenge={challenge}
      onPlayChallenge={() => start(challenge)}
      onDismissChallenge={clearChallenge}
      countries={countries}
    />
  );
}

function Setup() {
  return (
    <div className="notice">
      <div className="notice__card">
        <h1 className="logo">
          Where<span>abouts</span>
        </h1>
        <h2>Almost there: this build has no Google Maps API key.</h2>
        <ol>
          <li>Create a key with the Maps JavaScript API enabled in Google Cloud.</li>
          <li>
            Local dev: put <code>VITE_GOOGLE_MAPS_API_KEY=…</code> in <code>.env.local</code> and restart <code>npm run dev</code>.
          </li>
          <li>
            GitHub Pages: add it as the <code>GOOGLE_MAPS_API_KEY</code> repository secret and re-run the deploy workflow.
          </li>
        </ol>
      </div>
    </div>
  );
}

function Fatal({ message }: { message: string }) {
  return (
    <div className="notice">
      <div className="notice__card">
        <h2>Couldn't load the game</h2>
        <p>{message}</p>
        <button className="btn btn--primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    </div>
  );
}
