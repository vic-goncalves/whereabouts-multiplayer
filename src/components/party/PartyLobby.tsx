import { useState } from "react";
import type { Countries } from "../../countries";
import { findPanorama } from "../../google";
import { findLocation } from "../../locations";
import { getMap, MAPS } from "../../maps";
import type { ClientMessage, PartySettings, PartyState } from "../../party/protocol";
import { PARTY_ROUNDS, PARTY_TIME_LIMITS } from "../../party/room";
import type { Location, Movement } from "../../types";
import { LinkIcon } from "../icons";
import { Segmented } from "../Segmented";
import { cls, MOVEMENT_LABELS } from "../ui";
import { PlayerList } from "./PlayerList";
import { partyTimeLabel } from "./partyUi";

type Props = {
  state: PartyState;
  me: string;
  countries: Countries;
  send(msg: ClientMessage): void;
  onLeave(): void;
};

export function PartyLobby({ state, me, countries, send, onLeave }: Props) {
  const isHost = state.hostId === me;
  const host = state.players.find((p) => p.id === state.hostId);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${window.location.origin}${window.location.pathname}?party=${state.code}`;
  const { settings } = state;

  const change = <K extends keyof PartySettings>(key: K, value: PartySettings[K]) =>
    send({ type: "settings", settings: { ...settings, [key]: value } });

  // The host's browser picks the locations (it has Street View loaded) and
  // hands them to the server, which reveals them one round at a time.
  const start = async () => {
    setStarting(true);
    setError(undefined);
    try {
      const map = getMap(settings.mapId);
      const used = new Set<string>();
      const locations: Location[] = [];
      for (let i = 0; i < settings.rounds; i++) {
        const location = await findLocation(map, countries, findPanorama, { exclude: used });
        used.add(location.panoId);
        locations.push(location);
      }
      send({ type: "start", locations });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link is also shown on screen.
    }
  };

  return (
    <div className="home lobby">
      <div className="home__inner">
        <header className="lobby__header">
          <div>
            <div className="lobby__label">Party code</div>
            <div className="lobby__code">{state.code}</div>
          </div>
          <div className="lobby__invite">
            <button className="btn btn--secondary" onClick={copyInvite}>
              <LinkIcon /> {copied ? "Link copied!" : "Copy invite link"}
            </button>
            <div className="lobby__url">{inviteUrl}</div>
          </div>
        </header>

        <div className="lobby__grid">
          <section className="panel">
            <h2 className="panel__title">Players ({state.players.length})</h2>
            <PlayerList state={state} me={me} />
          </section>

          <section className="panel lobby__settings">
            <h2 className="panel__title">Game settings</h2>
            {isHost ? (
              <>
                <div className="segmented">
                  <div className="segmented__label">Map</div>
                  <div className="map-chips">
                    {MAPS.map((m) => (
                      <button
                        key={m.id}
                        className={cls("map-chip", `map-card--${m.id}`, m.id === settings.mapId && "map-chip--selected")}
                        onClick={() => change("mapId", m.id)}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
                <Segmented<Movement>
                  label="Movement"
                  value={settings.movement}
                  onChange={(v) => change("movement", v)}
                  options={(["moving", "no-move", "nmpz"] as const).map((m) => ({ value: m, label: MOVEMENT_LABELS[m] }))}
                />
                <Segmented<number>
                  label="Round time"
                  value={settings.timeLimit}
                  onChange={(v) => change("timeLimit", v)}
                  options={PARTY_TIME_LIMITS.map((t) => ({ value: t, label: partyTimeLabel(t) }))}
                />
                <Segmented<number>
                  label="Rounds"
                  value={settings.rounds}
                  onChange={(v) => change("rounds", v)}
                  options={PARTY_ROUNDS.map((r) => ({ value: r, label: String(r) }))}
                />
              </>
            ) : (
              <dl className="lobby__summary">
                <dt>Map</dt>
                <dd>{getMap(settings.mapId).name}</dd>
                <dt>Movement</dt>
                <dd>{MOVEMENT_LABELS[settings.movement]}</dd>
                <dt>Round time</dt>
                <dd>{partyTimeLabel(settings.timeLimit)}</dd>
                <dt>Rounds</dt>
                <dd>{settings.rounds}</dd>
              </dl>
            )}
          </section>
        </div>

        {error && <p className="lobby__error">{error}</p>}

        <div className="lobby__actions">
          {isHost ? (
            <button className="btn btn--play" onClick={start} disabled={starting}>
              {starting ? "Finding locations…" : "Start game"}
            </button>
          ) : (
            <p className="lobby__waiting">Waiting for {host?.name ?? "the host"} to start the game…</p>
          )}
          <button className="btn btn--ghost" onClick={onLeave}>
            Leave party
          </button>
        </div>
      </div>
    </div>
  );
}
