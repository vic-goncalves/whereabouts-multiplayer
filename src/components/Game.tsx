import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { Challenge } from "../challenge";
import type { Countries } from "../countries";
import { distanceKm, roundScore, type LatLng } from "../geo";
import { findPanorama } from "../google";
import { findLocation } from "../locations";
import type { Location } from "../types";
import { getMap } from "../maps";
import { recordBest, ROUNDS_PER_GAME, type Settings } from "../settings";
import { GuessPanel } from "./GuessPanel";
import { CloseIcon } from "./icons";
import { actualPin, type CountryShade, type Pin, type Scene } from "./MapView";
import { RoundResult } from "./RoundResult";
import { StreetView } from "./StreetView";
import { Summary } from "./Summary";
import { cls, formatClock, MOVEMENT_LABELS } from "./ui";

export type Round = {
  location: Location;
  guess?: LatLng;
  guessCountry?: string;
  distance?: number;
  score: number;
  correct: boolean;
  timeMs: number;
};

type Phase = "loading" | "playing" | "result" | "summary";

type Props = {
  settings: Settings;
  challenge?: Challenge;
  countries: Countries;
  onExit(): void;
  onReplay(): void;
};

export function Game({ settings, challenge, countries, onExit, onReplay }: Props) {
  const gameMap = getMap(settings.mapId);
  const streak = settings.mode === "streak";
  const totalRounds = challenge ? challenge.locations.length : streak ? Infinity : ROUNDS_PER_GAME;
  const limitMs = settings.timeLimit * 1000;

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string>();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [location, setLocation] = useState<Location>();
  const [guess, setGuess] = useState<{ position: LatLng; country?: string }>();
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [newBest, setNewBest] = useState(false);

  // Locations are found one after another so each search can skip panoramas
  // already used this game. The next round's search starts as soon as a round
  // begins, which hides most of the latency.
  const queue = useRef<Promise<Location>[]>([]);
  const used = useRef(new Set<string>());
  const locationAt = (i: number): Promise<Location> => {
    if (challenge) return Promise.resolve(challenge.locations[i]);
    queue.current[i] ??= (i === 0 ? Promise.resolve() : locationAt(i - 1))
      .then(() => findLocation(gameMap, countries, findPanorama, { exclude: used.current, requireCountry: streak }))
      .then((loc) => {
        used.current.add(loc.panoId);
        return loc;
      });
    return queue.current[i];
  };

  const startRound = useEffectEvent((isCancelled: () => boolean) => {
    setPhase("loading");
    setGuess(undefined);
    locationAt(index).then(
      (loc) => {
        if (isCancelled()) return;
        setLocation(loc);
        setStartedAt(Date.now());
        setNow(Date.now());
        setPhase("playing");
        // Errors from the prefetch resurface when that round starts.
        if (index + 1 < totalRounds) locationAt(index + 1).catch(() => {});
      },
      (e: unknown) => {
        if (!isCancelled()) setError(e instanceof Error ? e.message : String(e));
      },
    );
  });

  useEffect(() => {
    let cancelled = false;
    startRound(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [index]);

  useEffect(() => {
    if (phase !== "playing" || !limitMs) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase, limitMs]);
  const remainingMs = limitMs ? Math.max(0, limitMs - (now - startedAt)) : undefined;

  const submit = () => {
    if (phase !== "playing" || !location) return;
    const distance = guess ? distanceKm(guess.position, location) : undefined;
    setRounds((rs) => [
      ...rs,
      {
        location,
        guess: guess?.position,
        guessCountry: guess?.country,
        distance,
        score: !streak && distance !== undefined ? roundScore(distance, gameMap.maxDistanceKm) : 0,
        correct: streak && guess?.country !== undefined && guess.country === location.country,
        timeMs: Math.min(Date.now() - startedAt, limitMs || Infinity),
      },
    ]);
    setPhase("result");
  };

  const onTimeUp = useEffectEvent(submit);
  useEffect(() => {
    if (phase === "playing" && remainingMs === 0) onTimeUp();
  }, [phase, remainingMs]);

  const lastRound = rounds.at(-1);
  const totalScore = rounds.reduce((sum, r) => sum + r.score, 0);
  const streakCount = rounds.filter((r) => r.correct).length;
  const isLastRound = streak ? !lastRound?.correct : index + 1 >= totalRounds;

  const next = () => {
    if (phase !== "result") return;
    if (isLastRound) {
      setNewBest(recordBest(settings, streak ? streakCount : totalScore));
      setPhase("summary");
    } else {
      setIndex(index + 1);
    }
  };

  const onSpace = useEffectEvent(() => {
    if (phase === "playing" && guess) submit();
    else if (phase === "result") next();
  });
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || e.target instanceof HTMLInputElement) return;
      // Also stops a focused button from treating Space as a click.
      e.preventDefault();
      onSpace();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const placeGuess = useCallback(
    (position: LatLng) => {
      if (!streak) return setGuess({ position });
      const country = countries.at(position);
      if (country) setGuess({ position, country: country.iso });
    },
    [streak, countries],
  );

  const scene = useMemo<Scene>(() => {
    if (phase === "summary") {
      const pins: Pin[] = [];
      const lines: Scene["lines"] = [];
      rounds.forEach((r, i) => {
        pins.push(actualPin(r.location, String(i + 1)));
        if (r.guess) {
          pins.push({ position: r.guess, kind: "guess" });
          lines.push([r.guess, r.location]);
        }
      });
      const points = rounds.flatMap((r) => (r.guess ? [r.guess, r.location] : [r.location]));
      return { pins, lines, shades: [], fit: { key: "summary", points } };
    }
    if (phase === "result" && lastRound) {
      const r = lastRound;
      const pins: Pin[] = [actualPin(r.location)];
      if (r.guess) pins.push({ position: r.guess, kind: "guess" });
      const shades: CountryShade[] = [];
      if (streak && r.location.country) shades.push({ iso: r.location.country, kind: "correct" });
      if (streak && r.guessCountry && !r.correct) shades.push({ iso: r.guessCountry, kind: "wrong" });
      return {
        pins,
        lines: r.guess ? [[r.guess, r.location]] : [],
        shades,
        fit: { key: `result-${index}`, points: r.guess ? [r.guess, r.location] : [r.location] },
      };
    }
    return {
      pins: guess ? [{ position: guess.position, kind: "guess" }] : [],
      lines: [],
      shades: guess?.country ? [{ iso: guess.country, kind: "selected" }] : [],
      fit: { key: `round-${index}`, bounds: gameMap.bounds },
    };
  }, [phase, rounds, lastRound, guess, index, streak, gameMap]);

  const guessLabel = streak
    ? guess?.country
      ? `Guess ${countries.get(guess.country)?.name}`
      : "Click a country"
    : guess
      ? "Guess"
      : "Place your pin on the map";

  const showResults = phase === "result" || phase === "summary";

  return (
    <div className={`game game--${phase}`}>
      {location && <StreetView location={location} movement={settings.movement} interactive={phase === "playing"} />}

      {(phase === "loading" || error) && (
        <div className="loading">
          {error ? (
            <div className="loading__error">
              <h2>Something went wrong</h2>
              <p>{error}</p>
              <button className="btn btn--primary" onClick={onExit}>
                Back to menu
              </button>
            </div>
          ) : (
            <>
              <div className="spinner" />
              <p>{index === 0 ? "Dropping you somewhere…" : "Finding the next spot…"}</p>
            </>
          )}
        </div>
      )}

      {phase === "playing" && (
        <>
          <div className="top-left">
            <button className="icon-btn" onClick={onExit} title="Quit to menu" aria-label="Quit to menu">
              <CloseIcon />
            </button>
            <div className="rule-badges">
              <span className="badge">{MOVEMENT_LABELS[settings.movement]}</span>
              {challenge && <span className="badge badge--accent">Challenge</span>}
            </div>
          </div>

          {remainingMs !== undefined && (
            <div className={cls("timer", remainingMs <= 10_000 && "timer--low")}>{formatClock(remainingMs)}</div>
          )}

          <div className="hud">
            <div className="hud__item">
              <span className="hud__label">Map</span>
              <span className="hud__value">{gameMap.name}</span>
            </div>
            {streak ? (
              <div className="hud__item">
                <span className="hud__label">Streak</span>
                <span className="hud__value">{streakCount}</span>
              </div>
            ) : (
              <>
                <div className="hud__item">
                  <span className="hud__label">Round</span>
                  <span className="hud__value">
                    {index + 1} / {totalRounds}
                  </span>
                </div>
                <div className="hud__item">
                  <span className="hud__label">Score</span>
                  <span className="hud__value">{totalScore.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>

        </>
      )}

      <GuessPanel
        mode={showResults ? "full" : phase === "loading" ? "hidden" : "guessing"}
        scene={scene}
        countries={countries}
        onPlace={placeGuess}
        guessLabel={guessLabel}
        canGuess={guess !== undefined}
        onGuess={submit}
      />

      {phase === "result" && lastRound && (
        <RoundResult
          key={index}
          round={lastRound}
          roundNumber={index + 1}
          streak={streak ? streakCount : undefined}
          countries={countries}
          units={settings.units}
          isLastRound={isLastRound}
          onNext={next}
        />
      )}

      {phase === "summary" && (
        <Summary
          rounds={rounds}
          settings={settings}
          mapName={gameMap.name}
          countries={countries}
          newBest={newBest}
          onReplay={onReplay}
          onExit={onExit}
        />
      )}
    </div>
  );
}

