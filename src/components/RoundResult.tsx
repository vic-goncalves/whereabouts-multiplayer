import type { Countries } from "../countries";
import { formatDistance, MAX_ROUND_SCORE, type Units } from "../geo";
import type { Round } from "./Game";
import { cls, flagUrl } from "./ui";
import { useCountUp } from "./useCountUp";

type Props = {
  round: Round;
  roundNumber: number;
  // Defined in Country Streak mode: the streak so far.
  streak?: number;
  countries: Countries;
  units: Units;
  isLastRound: boolean;
  onNext(): void;
};

export function RoundResult({ round, roundNumber, streak, countries, units, isLastRound, onNext }: Props) {
  const shown = useCountUp(round.score);
  const actual = round.location.country ? countries.get(round.location.country) : undefined;
  const guessed = round.guessCountry ? countries.get(round.guessCountry) : undefined;

  return (
    <div className="result">
      <div className="result__card">
        <div className="result__round">Round {roundNumber}</div>
        {streak === undefined ? (
          <>
            <div className="result__score">
              {shown.toLocaleString()} <span>points</span>
            </div>
            <div className="score-bar">
              <div className="score-bar__fill" style={{ width: `${(shown / MAX_ROUND_SCORE) * 100}%` }} />
            </div>
            <p className="result__text">
              {round.distance !== undefined ? (
                <>
                  Your guess was <strong>{formatDistance(round.distance, units)}</strong> from the correct location.
                </>
              ) : (
                "Time ran out before you placed a pin."
              )}
            </p>
          </>
        ) : (
          <>
            <div className={cls("result__verdict", round.correct ? "result__verdict--good" : "result__verdict--bad")}>
              {round.correct ? "Correct!" : guessed ? "Wrong country" : "Out of time"}
            </div>
            <p className="result__text">
              It was{" "}
              <strong className="country">
                {actual && <img src={flagUrl(actual.iso)} alt="" />}
                {actual?.name ?? "somewhere unknown"}
              </strong>
              {!round.correct && guessed && <>, not {guessed.name}</>}.
            </p>
            <p className="result__text">
              {round.correct ? `Streak: ${streak}` : `Final streak: ${streak}`}
            </p>
          </>
        )}
        {round.location.label && <p className="result__place">{round.location.label}</p>}
        <button className="btn btn--primary btn--wide" onClick={onNext}>
          {isLastRound ? "View results" : "Next round"}
        </button>
        <p className="hint">
          Press <kbd>Space</kbd> to continue
        </p>
      </div>
    </div>
  );
}
