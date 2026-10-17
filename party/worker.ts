// Party server: one Durable Object per party code, holding the room in its
// own storage and talking to players over hibernatable WebSockets. All game
// rules live in src/party/room.ts.
import { DurableObject } from "cloudflare:workers";
import { CODE_ALPHABET, CODE_LENGTH, type ClientMessage, type ServerMessage } from "../src/party/protocol";
import { applyMessage, handleAlarm, handleDisconnect, nextAlarmAt, PartyError, snapshot, type Room } from "../src/party/room";

interface Env {
  PARTY_ROOM: DurableObjectNamespace<PartyRoom>;
  ALLOWED_ORIGINS: string;
}

type Attachment = { code: string; playerId?: string };

// Once nobody is connected for this long, the room deletes itself.
const IDLE_MS = 10 * 60 * 1000;
const MAX_MESSAGE_BYTES = 16 * 1024;
const ROOM_PATH = new RegExp(`^/rooms/([${CODE_ALPHABET}]{${CODE_LENGTH}})$`);

export default {
  async fetch(request, env) {
    const code = new URL(request.url).pathname.match(ROOM_PATH)?.[1];
    if (!code) return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    if (!env.ALLOWED_ORIGINS.split(",").includes(request.headers.get("Origin") ?? "")) {
      return new Response("Origin not allowed", { status: 403 });
    }
    return env.PARTY_ROOM.getByName(code).fetch(request);
  },
} satisfies ExportedHandler<Env>;

export class PartyRoom extends DurableObject<Env> {
  private room: Room | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.room = await ctx.storage.get<Room>("room");
    });
  }

  async fetch(request: Request): Promise<Response> {
    const code = new URL(request.url).pathname.match(ROOM_PATH)![1];
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ code } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    if (typeof data !== "string" || data.length > MAX_MESSAGE_BYTES) return ws.close(1009, "Message too large");
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      return send(ws, { type: "error", reason: "invalid", message: "Couldn't read that message." });
    }

    const attachment = ws.deserializeAttachment() as Attachment;
    if (msg.type === "join") {
      attachment.playerId = String(msg.playerId);
      ws.serializeAttachment(attachment);
    }
    if (!attachment.playerId) return send(ws, { type: "error", reason: "invalid", message: "Join the party first." });

    try {
      this.room = applyMessage(this.room, attachment.code, attachment.playerId, msg, this.connected(), Date.now());
    } catch (error) {
      if (!(error instanceof PartyError)) throw error;
      send(ws, { type: "error", reason: error.reason, message: error.message });
      if (msg.type === "join") ws.close(4000, error.reason);
      return;
    }
    await this.commit();
  }

  async webSocketClose(ws: WebSocket) {
    await this.dropped(ws);
  }

  async webSocketError(ws: WebSocket) {
    await this.dropped(ws);
  }

  async alarm() {
    if (!this.room) return;
    if (this.connected().size === 0) {
      this.room = undefined;
      await this.ctx.storage.deleteAll();
      return;
    }
    this.room = handleAlarm(this.room, Date.now());
    await this.commit();
  }

  private async dropped(ws: WebSocket) {
    if (!this.room) return;
    this.room = handleDisconnect(this.room, this.connected(ws));
    await this.commit();
  }

  // Player ids with an open socket, optionally ignoring one that's closing.
  private connected(except?: WebSocket): Set<string> {
    const ids = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except || ws.readyState !== WebSocket.OPEN) continue;
      const { playerId } = ws.deserializeAttachment() as Attachment;
      if (playerId) ids.add(playerId);
    }
    return ids;
  }

  private async commit() {
    const room = this.room!;
    const now = Date.now();
    await this.ctx.storage.put("room", room);
    await this.ctx.storage.setAlarm(nextAlarmAt(room, now, IDLE_MS));
    const connected = this.connected();
    const message = JSON.stringify({ type: "state", state: snapshot(room, connected), serverNow: now } satisfies ServerMessage);
    for (const ws of this.ctx.getWebSockets()) {
      const { playerId } = ws.deserializeAttachment() as Attachment;
      if (playerId && ws.readyState === WebSocket.OPEN) ws.send(message);
    }
  }
}

function send(ws: WebSocket, msg: ServerMessage) {
  ws.send(JSON.stringify(msg));
}
