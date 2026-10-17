import { useEffect, useEffectEvent, useMemo, useState } from "react";
import type { Countries } from "../../countries";
import { formatDistance, type LatLng, type Units } from "../../geo";
import { getMap } from "../../maps";
import type { ClientMessage, PartyState } from "../../party/protocol";
import { GuessPanel } from "../GuessPanel";
import { CloseIcon } from "../icons";
import { actualPin, type Pin, type Scene } from "../MapView";
import { StreetView } from "../StreetView";
import { cls, formatClock, MOVEMENT_LABELS } from "../ui";
import { useCountUp } from "../useCountUp";
import { PlayerList } from "./PlayerList";
import { initial, standings } from "./partyUi";

type Props = {
  state: PartyState;
  me: string;
  countries: Countries;
  units: Units;
  send(msg: ClientMessage): void;
  serverNow(): number;
  onLeave(): void;
};

export function PartyGame({ state, me, countries, units, send, serverNow, onLeave }: Props) {
  const gameMap = getMap(state.settings.mapId);
  const { phase, round } = state;
  const isHost = state.hostId === me;
  const host = state.players.find((p) => p.id === state.hostId);
  const self = state.players.find((p) => p.id === me);
  const myColor = self?.color;
  const myName = self?.name ?? "";
  const location = state.locations[round];
  const playing = phase === "playing";

  const [guess, setGuess] = useState<LatLng>();
  const [submittedRound, setSubmittedRound] = useState<number>();
  const [guessRound, setGuessRound] = useState(round);
  if (guessRound !== round) {
    setGuessRound(round);
    setGuess(undefined);
  }
  const locked = playing && (submittedRound === round || state.guessed.includes(me));

  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    if (!playing || state.roundEndsAt === undefined) return;
    setNow(serverNow());
    const id = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(id);
  }, [playing, state.roundEndsAt, serverNow]);
  const remainingMs = playing && state.roundEndsAt !== undefined ? Math.max(0, state.roundEndsAt - now) : undefined;

  const submit = () => {
    if (!playing || locked) return;
    setSubmittedRound(round);
    send({ type: "guess", round, position: guess ?? null });
  };

  // Out of time: lock in whatever is on the map (or nothing).
  const onTimeUp = useEffectEvent(submit);
  useEffect(() => {
    if (remainingMs === 0) onTimeUp();
  }, [remainingMs]);

  const onSpace = useEffectEvent(() => {
    if (playing && guess) submit();
    else if (phase === "results" && isHost) send({ type: "next" });
  });
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      onSpace();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const scene = useMemo<Scene>(() => {
    if (phase === "results") {
      const roundGuesses = state.guesses[round] ?? {};
      const pins: Pin[] = [actualPin(location)];
      const lines: Scene["lines"] = [];
      const points: LatLng[] = [location];
      for (const p of state.players) {
        const position = roundGuesses[p.id]?.position;
        if (!position) continue;
        pins.push({ position, kind: "guess", color: p.color, label: initial(p.name), title: p.name });
        lines.push([position, location]);
        points.push(position);
      }
      return { pins, lines, shades: [], fit: { key: `results-${round}`, points } };
    }
    if (phase === "final") {
      const pins = state.locations.map((loc, i) => actualPin(loc, String(i + 1)));
      return { pins, lines: [], shades: [], fit: { key: "final", points: state.locations } };
    }
    return {
      pins: guess ? [{ position: guess, kind: "guess", color: myColor, label: initial(myName) }] : [],
      lines: [],
      shades: [],
      fit: { key: `round-${round}`, bounds: gameMap.bounds },
    };
  }, [phase, round, state, location, guess, myColor, myName, gameMap]);

  const waitingOn = state.players.filter((p) => p.connected && !state.guessed.includes(p.id)).length;
  const myTotal = standings(state).find((s) => s.id === me)?.total ?? 0;

  return (
    <div className={`game game--${phase} game--party`}>
      {location && <StreetView location={location} movement={state.settings.movement} interactive={playing} />}

      {playing && (
        <>
          <div className="top-left">
            <button className="icon-btn" onClick={onLeave} title="Leave party" aria-label="Leave party">
              <CloseIcon />
            </button>
            <div className="rule-badges">
              <span className="badge badge--accent">Party {state.code}</span>
              <span className="badge">{MOVEMENT_LABELS[state.settings.movement]}</span>
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
            <div className="hud__item">
              <span className="hud__label">Round</span>
              <span className="hud__value">
                {round + 1} / {state.settings.rounds}
              </span>
            </div>
            <div className="hud__item">
              <span className="hud__label">Score</span>
              <span className="hud__value">{myTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="party-status">
            <PlayerList state={state} me={me} showGuessed compact />
            {locked && (
              <div className="party-status__waiting">
                {waitingOn > 0 ? `Locked in. Waiting for ${waitingOn} more…` : "Locked in."}
                {isHost && waitingOn > 0 && (
                  <button className="btn btn--secondary btn--small" onClick={() => send({ type: "endRound" })}>
                    End round now
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <GuessPanel
        mode={playing ? "guessing" : "full"}
        scene={scene}
        countries={countries}
        onPlace={locked ? undefined : setGuess}
        guessLabel={locked ? "Locked in" : guess ? "Guess" : "Place your pin on the map"}
        canGuess={guess !== undefined && !locked}
        onGuess={submit}
      />

      {phase === "results" && (
        <PartyRoundResults key={round} state={state} me={me} units={units} isHost={isHost} hostName={host?.name} send={send} />
      )}
      {phase === "final" && <PartyFinal state={state} me={me} isHost={isHost} hostName={host?.name} send={send} onLeave={onLeave} />}
    </div>
  );
}

function PartyRoundResults({
  state,
  me,
  units,
  isHost,
  hostName,
  send,
}: {
  state: PartyState;
  me: string;
  units: Units;
  isHost: boolean;
  hostName?: string;
  send(msg: ClientMessage): void;
}) {
  const roundGuesses = state.guesses[state.round] ?? {};
  const totals = new Map(standings(state).map((s) => [s.id, s.total]));
  const rows = [...state.players].sort((a, b) => (roundGuesses[b.id]?.score ?? 0) - (roundGuesses[a.id]?.score ?? 0));
  const last = state.round + 1 >= state.settings.rounds;
  const label = state.locations[state.round]?.label;

  return (
    <div className="summary party-results">
      <div className="party-results__card">
        <div className="summary__meta">
          Round {state.round + 1} of {state.settings.rounds}
          {label && ` · ${label}`}
        </div>
        <table className="rounds-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Distance</th>
              <th>Round</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const g = roundGuesses[p.id];
              return (
                <tr key={p.id} className={cls(p.id === me && "is-me")}>
                  <td>
                    <span className="rank">{i + 1}</span>
                    <span className="round-dot" style={{ background: p.color, borderColor: p.color }}>
                      {initial(p.name)}
                    </span>
                    {p.name}
                  </td>
                  <td>{g?.distance !== undefined ? formatDistance(g.distance, units) : "No guess"}</td>
                  <td className="rounds-table__points">+{(g?.score ?? 0).toLocaleString()}</td>
                  <td className="rounds-table__total">{(totals.get(p.id) ?? 0).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="summary__actions">
          {isHost ? (
            <button className="btn btn--primary btn--wide" onClick={() => send({ type: "next" })}>
              {last ? "Final standings" : "Next round"}
            </button>
          ) : (
            <p className="lobby__waiting">Waiting for {hostName ?? "the host"} to continue…</p>
          )}
        </div>
      </div>
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

function PartyFinal({
  state,
  me,
  isHost,
  hostName,
  send,
  onLeave,
}: {
  state: PartyState;
  me: string;
  isHost: boolean;
  hostName?: string;
  send(msg: ClientMessage): void;
  onLeave(): void;
}) {
  const ranked = standings(state);
  const winner = ranked[0];
  const winnerTotal = useCountUp(winner?.total ?? 0, 1400);

  return (
    <div className="summary party-results">
      <div className="party-results__card">
        <div className="summary__meta">
          {getMap(state.settings.mapId).name} · {state.settings.rounds} rounds
        </div>
        {winner && (
          <h2 className="summary__title">
            {winner.id === me ? "You win!" : `${winner.name} wins!`}{" "}
            <span className="party-results__winner-score">{winnerTotal.toLocaleString()}</span>
          </h2>
        )}
        <ol className="standings">
          {ranked.map((s, i) => (
            <li key={s.id} className={cls(s.id === me && "is-me")}>
              <span className="standings__place">{MEDALS[i] ?? i + 1}</span>
              <span className="round-dot" style={{ background: s.color, borderColor: s.color }}>
                {initial(s.name)}
              </span>
              <span className="standings__name">{s.name}</span>
              <span className="standings__total">{s.total.toLocaleString()}</span>
            </li>
          ))}
        </ol>
        <div className="summary__actions">
          {isHost ? (
            <button className="btn btn--primary" onClick={() => send({ type: "lobby" })}>
              Play again
            </button>
          ) : (
            <p className="lobby__waiting">{hostName ?? "The host"} can start another game.</p>
          )}
          <button className="btn btn--ghost" onClick={onLeave}>
            Leave party
          </button>
        </div>
      </div>
    </div>
  );
}

