import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, PartyErrorReason, PartyState, ServerMessage } from "./protocol";

export const PARTY_URL: string = import.meta.env.VITE_PARTY_URL ?? "";

export type PartyConnection = {
  state?: PartyState;
  connected: boolean;
  // Ends the session: no such party, code taken, party full.
  fatal?: { reason: PartyErrorReason; message: string };
  // The server's last complaint that didn't end the session.
  notice?: string;
  send(msg: ClientMessage): void;
  // Current time on the server's clock, for round timers.
  serverNow(): number;
};

const MAX_RETRY_MS = 5000;

export function usePartyRoom(code: string, playerId: string, name: string, create: boolean): PartyConnection {
  const [state, setState] = useState<PartyState>();
  const [connected, setConnected] = useState(false);
  const [fatal, setFatal] = useState<PartyConnection["fatal"]>();
  const [notice, setNotice] = useState<string>();
  const socket = useRef<WebSocket>(null);
  const clockOffset = useRef(0);

  useEffect(() => {
    let stopped = false;
    let joined = false;
    let attempts = 0;
    let retry: number | undefined;

    const connect = () => {
      const ws = new WebSocket(`${PARTY_URL}/rooms/${code}`);
      socket.current = ws;
      ws.onopen = () => {
        attempts = 0;
        setConnected(true);
        // Only the first join may create the room. Rejoining after a dropped
        // connection must not wipe a party that's in progress.
        ws.send(JSON.stringify({ type: "join", playerId, name, create: create && !joined } satisfies ClientMessage));
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data) as ServerMessage;
        if (msg.type === "state") {
          joined = true;
          clockOffset.current = msg.serverNow - Date.now();
          setState(msg.state);
          setNotice(undefined);
        } else if (msg.reason === "invalid") {
          setNotice(msg.message);
        } else {
          stopped = true;
          setFatal({ reason: msg.reason, message: msg.message });
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (stopped) return;
        attempts++;
        retry = window.setTimeout(connect, Math.min(MAX_RETRY_MS, 500 * attempts));
      };
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      socket.current?.close();
    };
  }, [code, playerId, name, create]);

  const send = useCallback((msg: ClientMessage) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(msg));
  }, []);
  const serverNow = useCallback(() => Date.now() + clockOffset.current, []);

  return { state, connected, fatal, notice, send, serverNow };
}
