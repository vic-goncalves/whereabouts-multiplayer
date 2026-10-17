import { useMemo } from "react";
import type { Challenge } from "../challenge";
import type { Countries } from "../countries";
import { getMap, MAPS } from "../maps";
import { loadBest, type Settings } from "../settings";
import type { Mode, Movement } from "../types";
import { PartyEntry, type PartyEntryProps } from "./party/PartyEntry";
import { Segmented } from "./Segmented";
import { cls, MOVEMENT_LABELS, TIME_LIMITS, timeLimitLabel } from "./ui";

type Props = {
  settings: Settings;
  onChange(settings: Settings): void;
  onPlay(): void;
  challenge?: Challenge;
  onPlayChallenge(): void;
  onDismissChallenge(): void;
  countries?: Countries;
  // Absent when this build has no party server configured.
  party?: PartyEntryProps;
};

const MAP_ICONS: Record<string, string> = {
  world: "🗺️",
  landmarks: "🏛️",
  europe: "🏰",
  usa: "🗽",
  latam: "🌎",
  asia: "🌏",
  japan: "🗻",
  africa: "🌍",
  oceania: "🦘",
};

const MOVEMENT_HINTS: Record<Movement, string> = {
  moving: "Walk the roads freely",
  "no-move": "Look around, but stay put",
  nmpz: "No moving, panning or zooming",
};

export function Home({ settings, onChange, onPlay, challenge, onPlayChallenge, onDismissChallenge, countries, party }: Props) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  const ready = countries !== undefined;

  return (
    <div className="home">
      <WorldBackdrop countries={countries} />
      <div className="home__inner">
        <header className="home__header">
          <h1 className="logo">
            John<span>goncalves</span>
          </h1>
          <p className="tagline">You're dropped on a random street somewhere on Earth. Look around, read the clues, and pin where you think you are.</p>
        </header>

        {challenge && (
          <section className="challenge-banner">
            <div>
              <div className="challenge-banner__title">You've been challenged!</div>
              <div className="challenge-banner__meta">
                {getMap(challenge.mapId).name} · {MOVEMENT_LABELS[challenge.movement]} · {timeLimitLabel(challenge.timeLimit)} ·{" "}
                {challenge.locations.length} rounds
              </div>
            </div>
            <div className="challenge-banner__actions">
              <button className="btn btn--primary" onClick={onPlayChallenge} disabled={!ready}>
                Play challenge
              </button>
              <button className="btn btn--ghost" onClick={onDismissChallenge}>
                Dismiss
              </button>
            </div>
          </section>
        )}

        {party && <PartyEntry {...party} ready={ready} />}

        <section className="panel">
          <h2 className="panel__title">{party ? "Play solo: choose a map" : "Choose a map"}</h2>
          <div className="map-grid">
            {MAPS.map((m) => {
              const best = loadBest({ mapId: m.id, mode: settings.mode, movement: settings.movement });
              return (
                <button
                  key={m.id}
                  className={cls("map-card", `map-card--${m.id}`, settings.mapId === m.id && "map-card--selected")}
                  onClick={() => set("mapId", m.id)}
                >
                  <span className="map-card__icon">{MAP_ICONS[m.id]}</span>
                  <span className="map-card__name">{m.name}</span>
                  <span className="map-card__desc">{m.description}</span>
                  {best !== undefined && (
                    <span className="map-card__best">
                      Best: {best.toLocaleString()}
                      {settings.mode === "streak" ? " streak" : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel settings">
          <Segmented<Mode>
            label="Game mode"
            value={settings.mode}
            onChange={(v) => set("mode", v)}
            options={[
              { value: "classic", label: "Classic", hint: "5 rounds, up to 25,000 points" },
              { value: "streak", label: "Country Streak", hint: "Name the country until you miss" },
            ]}
          />
          <Segmented<Movement>
            label="Movement"
            value={settings.movement}
            onChange={(v) => set("movement", v)}
            options={(["moving", "no-move", "nmpz"] as const).map((m) => ({ value: m, label: MOVEMENT_LABELS[m], hint: MOVEMENT_HINTS[m] }))}
          />
          <Segmented<number>
            label="Round time"
            value={settings.timeLimit}
            onChange={(v) => set("timeLimit", v)}
            options={TIME_LIMITS.map((t) => ({ value: t, label: timeLimitLabel(t) }))}
          />
          <Segmented<Settings["units"]>
            label="Units"
            value={settings.units}
            onChange={(v) => set("units", v)}
            options={[
              { value: "km", label: "Kilometers" },
              { value: "mi", label: "Miles" },
            ]}
          />
        </section>

        <button className="btn btn--play" onClick={onPlay} disabled={!ready}>
          {ready ? "Play" : "Loading…"}
        </button>

        <footer className="home__footer">
          A fan-made geography game. Not affiliated with GeoGuessr. Street View imagery © Google.
        </footer>
      </div>
    </div>
  );
}

// Equirectangular outline of the world, drawn from the same country data the
// game uses, as a faint backdrop.
function WorldBackdrop({ countries }: { countries?: Countries }) {
  const path = useMemo(() => {
    if (!countries) return "";
    const segments: string[] = [];
    for (const country of countries.byIso.values()) {
      for (const part of country.parts) {
        const ring = part.rings[0];
        if (part.area < 0.5) continue;
        const step = ring.length > 60 ? 2 : 1;
        let d = "";
        for (let i = 0; i < ring.length; i += step) {
          const [lng, lat] = ring[i];
          d += `${i === 0 ? "M" : "L"}${(lng + 180).toFixed(1)} ${(90 - lat).toFixed(1)}`;
        }
        segments.push(`${d}Z`);
      }
    }
    return segments.join("");
  }, [countries]);

  return (
    <svg className="world-backdrop" viewBox="0 8 360 150" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <path d={path} />
    </svg>
  );
}
