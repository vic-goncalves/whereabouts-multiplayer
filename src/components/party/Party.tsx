import { useEffect } from "react";
import type { Countries } from "../../countries";
import type { Units } from "../../geo";
import { usePartyRoom } from "../../party/usePartyRoom";
import { PartyGame } from "./PartyGame";
import { PartyLobby } from "./PartyLobby";

type Props = {
  code: string;
  create: boolean;
  name: string;
  playerId: string;
  countries: Countries;
  units: Units;
  onCodeTaken(): void;
  onLeave(): void;
};

export function Party({ code, create, name, playerId, countries, units, onCodeTaken, onLeave }: Props) {
  const { state, connected, fatal, notice, send, serverNow } = usePartyRoom(code, playerId, name, create);
  const codeTaken = create && fatal?.reason === "taken";

  useEffect(() => {
    if (codeTaken) onCodeTaken();
  }, [codeTaken, onCodeTaken]);

  if (fatal && !codeTaken) {
    return (
      <div className="notice">
        <div className="notice__card">
          <h2>Couldn't join party {code}</h2>
          <p>{fatal.message}</p>
          <button className="btn btn--primary" onClick={onLeave}>
            Back to menu
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="game">
        <div className="loading">
          <div className="spinner" />
          <p>{create ? "Setting up your party…" : `Joining party ${code}…`}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {state.phase === "lobby" ? (
        <PartyLobby state={state} me={playerId} countries={countries} send={send} onLeave={onLeave} />
      ) : (
        <PartyGame state={state} me={playerId} countries={countries} units={units} send={send} serverNow={serverNow} onLeave={onLeave} />
      )}
      {!connected && <div className="party-banner">Connection lost. Reconnecting…</div>}
      {connected && notice && <div className="party-banner party-banner--notice">{notice}</div>}
    </>
  );
}
