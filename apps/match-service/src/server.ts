import { createServer, type IncomingMessage } from "node:http";

import { jwtVerify } from "jose";
import { WebSocketServer, type WebSocket } from "ws";

import { fighterRoster } from "@battleborn/content";
import { DEFAULT_CONFIG, createMatchState, decodeInput, stepMatch, type InputState, type MatchState } from "@battleborn/game-core";

interface SessionTokenPayload {
  roomCode: string;
  role: "host" | "guest";
  playerName: string;
  fighterId: string;
}

interface ConnectionState {
  socket: WebSocket | null;
  playerName: string;
  fighterId: string;
  ready: boolean;
  latestInput: InputState;
}

interface RoomState {
  code: string;
  host: ConnectionState;
  guest: ConnectionState;
  match: MatchState | null;
  interval: NodeJS.Timeout;
  idleSince: number | null;
}

const encoder = new TextEncoder();
const rooms = new Map<string, RoomState>();
const port = Number(process.env.PORT ?? 8787);

function createEmptyConnection(): ConnectionState {
  return {
    socket: null,
    playerName: "",
    fighterId: "morana",
    ready: false,
    latestInput: { left: false, right: false, up: false, guard: false, punch: false, kick: false, special: false },
  };
}

function getRoom(code: string) {
  let room = rooms.get(code);
  if (room) {
    return room;
  }

  room = {
    code,
    host: createEmptyConnection(),
    guest: createEmptyConnection(),
    match: null,
    idleSince: null,
    interval: setInterval(() => tickRoom(code), 1000 / 60),
  };
  rooms.set(code, room);
  return room;
}

async function verifyToken(token: string) {
  const secret = process.env.SESSION_TOKEN_SECRET;
  if (!secret) {
    throw new Error("SESSION_TOKEN_SECRET is required.");
  }

  const result = await jwtVerify(token, encoder.encode(secret));
  return result.payload as unknown as SessionTokenPayload;
}

function toRoomStateMessage(room: RoomState) {
  return {
    type: "room_state",
    roomCode: room.code,
    readySlots: [room.host.ready ? 1 : null, room.guest.ready ? 2 : null].filter((slot): slot is 1 | 2 => slot !== null),
    connectedSlots: [room.host.socket ? 1 : null, room.guest.socket ? 2 : null].filter((slot): slot is 1 | 2 => slot !== null),
    selections: {
      host: room.host.fighterId,
      guest: room.guest.fighterId,
    },
  };
}

function broadcast(room: RoomState, payload: unknown) {
  const message = JSON.stringify(payload);
  room.host.socket?.send(message);
  room.guest.socket?.send(message);
}

function tickRoom(code: string) {
  const room = rooms.get(code);
  if (!room) {
    return;
  }

  const bothConnected = room.host.socket && room.guest.socket;
  if (!bothConnected) {
    if (!room.idleSince) {
      room.idleSince = Date.now();
    } else if (Date.now() - room.idleSince > 120_000) {
      clearInterval(room.interval);
      rooms.delete(code);
    }
    return;
  }

  room.idleSince = null;

  if (!room.match && room.host.ready && room.guest.ready) {
    room.match = createMatchState(
      fighterRoster,
      room.host.fighterId,
      room.guest.fighterId,
      room.host.playerName || "Host",
      room.guest.playerName || "Guest",
      DEFAULT_CONFIG,
    );
    room.match.roomCode = room.code;
    broadcast(room, { type: "info", slot: 1, message: `Match started in room ${room.code}` });
    broadcast(room, { type: "info", slot: 2, message: `Match started in room ${room.code}` });
  }

  if (!room.match) {
    broadcast(room, toRoomStateMessage(room));
    return;
  }

  room.match = stepMatch(room.match, fighterRoster, room.host.latestInput, room.guest.latestInput, DEFAULT_CONFIG);
  broadcast(room, { type: "snapshot", state: room.match });
}

const server = createServer((request, response) => {
  if (request.url === "/healthz") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }

  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({
    service: "battleborn-match-service",
    websocketPath: "/match?token=...",
    rooms: rooms.size,
  }));
});

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (socket: WebSocket, request: UpgradeRequest) => {
  const payload = (request as UpgradeRequest).sessionPayload;
  if (!payload) {
    socket.close();
    return;
  }
  const room = getRoom(payload.roomCode);
  const slot = payload.role === "host" ? 1 : 2;
  const connection = slot === 1 ? room.host : room.guest;
  connection.socket = socket;
  connection.playerName = payload.playerName;
  connection.fighterId = fighterRoster[payload.fighterId] ? payload.fighterId : connection.fighterId;
  connection.ready = false;

  socket.send(JSON.stringify({ type: "info", slot, message: `Connected as ${payload.role} in room ${payload.roomCode}` }));
  broadcast(room, toRoomStateMessage(room));

  socket.on("message", (chunk: Buffer) => {
    const message = JSON.parse(chunk.toString());

    if (message.type === "select_fighter" && typeof message.fighterId === "string" && fighterRoster[message.fighterId]) {
      connection.fighterId = message.fighterId;
      connection.playerName = typeof message.playerName === "string" ? message.playerName.slice(0, 20) : connection.playerName;
      broadcast(room, toRoomStateMessage(room));
    }

    if (message.type === "ready") {
      connection.ready = true;
      broadcast(room, toRoomStateMessage(room));
    }

    if (message.type === "input" && typeof message.input === "number") {
      connection.latestInput = decodeInput(message.input);
    }
  });

  socket.on("close", () => {
    connection.socket = null;
    connection.ready = false;
    broadcast(room, toRoomStateMessage(room));
  });
});

server.on("upgrade", async (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  if (url.pathname !== "/match") {
    socket.destroy();
    return;
  }

  try {
    const token = url.searchParams.get("token");
    if (!token) {
      throw new Error("Missing token");
    }

    const payload = await verifyToken(token);
    const upgradedRequest = request as UpgradeRequest;
    upgradedRequest.sessionPayload = payload;
    wss.handleUpgrade(upgradedRequest, socket, head, (websocket: WebSocket) => {
      wss.emit("connection", websocket, upgradedRequest);
    });
  } catch {
    socket.destroy();
  }
});

server.listen(port, () => {
  console.log(`battleborn match service listening on :${port}`);
});
type UpgradeRequest = IncomingMessage & {
  sessionPayload?: SessionTokenPayload;
};
