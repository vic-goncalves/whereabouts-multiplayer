import type { PartyState } from "../../party/protocol";
import { cls } from "../ui";
import { initial } from "./partyUi";

type Props = {
  state: PartyState;
  me: string;
  // Show a check next to players who've locked in this round.
  showGuessed?: boolean;
  compact?: boolean;
};

export function PlayerList({ state, me, showGuessed = false, compact = false }: Props) {
  return (
    <ul className={cls("player-list", compact && "player-list--compact")}>
      {state.players.map((p) => {
        const guessed = showGuessed && state.guessed.includes(p.id);
        return (
          <li key={p.id} className={cls("player", !p.connected && "player--away", guessed && "player--guessed")} title={p.name}>
            <span className="player__avatar" style={{ background: p.color }}>
              {initial(p.name)}
              {guessed && <span className="player__check">✓</span>}
            </span>
            {!compact && (
              <span className="player__name">
                {p.name}
                {p.id === me && <span className="player__tag">you</span>}
                {p.id === state.hostId && <span className="player__tag player__tag--host">host</span>}
                {!p.connected && <span className="player__tag">away</span>}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
