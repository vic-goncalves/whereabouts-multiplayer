import { useState } from "react";
import { encodeChallenge } from "../challenge";
import type { Countries } from "../countries";
import { formatDistance, MAX_ROUND_SCORE } from "../geo";
import { loadBest, type Settings } from "../settings";
import type { Round } from "./Game";
import { LinkIcon } from "./icons";
import { flagUrl, formatDuration, MOVEMENT_LABELS, timeLimitLabel } from "./ui";
import { useCountUp } from "./useCountUp";

type Props = {
  rounds: Round[];
  settings: Settings;
  mapName: string;
  countries: Countries;
  newBest: boolean;
  onReplay(): void;
  onExit(): void;
};

export function Summary({ rounds, settings, mapName, countries, newBest, onReplay, onExit }: Props) {
  const streak = settings.mode === "streak";
  const total = streak ? rounds.filter((r) => r.correct).length : rounds.reduce((sum, r) => sum + r.score, 0);
  const max = rounds.length * MAX_ROUND_SCORE;
  const shown = useCountUp(total, 1400);
  const best = loadBest(settings);

  return (
    <div className="summary">
      <div className="summary__card">
        <div className="summary__main">
          <div className="summary__meta">
            {mapName} · {MOVEMENT_LABELS[settings.movement]} · {timeLimitLabel(settings.timeLimit)}
          </div>
          {streak ? (
            <>
              <h2 className="summary__title">Streak over</h2>
              <div className="summary__total">
                {shown} <span>{total === 1 ? "country" : "countries"} in a row</span>
              </div>
            </>
          ) : (
            <>
              <h2 className="summary__title">Game complete</h2>
              <div className="summary__total">
                {shown.toLocaleString()} <span>/ {max.toLocaleString()}</span>
              </div>
              <div className="score-bar score-bar--big">
                <div className="score-bar__fill" style={{ width: `${(shown / max) * 100}%` }} />
              </div>
            </>
          )}
          <div className="summary__best">
            {newBest ? (
              <span className="badge badge--gold">New personal best!</span>
            ) : (
              best !== undefined && <span className="badge">Personal best: {best.toLocaleString()}</span>
            )}
          </div>
          <div className="summary__actions">
            <button className="btn btn--primary" onClick={onReplay}>
              Play again
            </button>
            {!streak && <ChallengeButton rounds={rounds} settings={settings} />}
            <button className="btn btn--ghost" onClick={onExit}>
              Main menu
            </button>
          </div>
        </div>

        <div className="summary__detail">
          {streak ? (
            <ul className="streak-list">
              {rounds.map((r, i) => {
                const country = r.location.country ? countries.get(r.location.country) : undefined;
                return (
                  <li key={i} className={r.correct ? "good" : "bad"}>
                    {country && <img src={flagUrl(country.iso)} alt="" />}
                    {country?.name ?? "Unknown"}
                  </li>
                );
              })}
            </ul>
          ) : (
            <table className="rounds-table">
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Distance</th>
                  <th>Time</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <span className="round-dot">{i + 1}</span>
                      {r.location.label && <span className="rounds-table__label">{r.location.label}</span>}
                    </td>
                    <td>{r.distance !== undefined ? formatDistance(r.distance, settings.units) : "No guess"}</td>
                    <td>{formatDuration(r.timeMs)}</td>
                    <td className="rounds-table__points">{r.score.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function ChallengeButton({ rounds, settings }: { rounds: Round[]; settings: Settings }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const url = `${window.location.origin}${window.location.pathname}?c=${encodeChallenge({
    mapId: settings.mapId,
    movement: settings.movement,
    timeLimit: settings.timeLimit,
    locations: rounds.map((r) => r.location),
  })}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      // Clipboard access can be denied; show the link to copy by hand.
      setState("manual");
    }
  };

  return (
    <>
      <button className="btn btn--secondary" onClick={copy}>
        <LinkIcon /> {state === "copied" ? "Link copied!" : "Challenge a friend"}
      </button>
      {state === "manual" && <input className="challenge-url" readOnly value={url} onFocus={(e) => e.target.select()} autoFocus />}
    </>
  );
}
