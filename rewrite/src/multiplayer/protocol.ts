export const PROTOCOL_VERSION = 39;
export const ROOM_RULESET = "launcher-room-v1";

export type ResourceVersion = "p3528" | "p3543" | "p3553";
export type RoomPhase = "open" | "loading" | "countdown" | "racing" | "finished";

export interface RoomMember {
  playerId: string;
  name: string;
  slot: number;
  ready: boolean;
  team: 1 | 2 | null;
  equipment?: unknown;
  initial?: string;
  changing?: boolean;
}

/** Deliberately partial: gameplay-specific room/race schemas still need a full rewrite. */
export interface RoomSnapshot {
  roomId: string;
  revision: number;
  name: string;
  phase: RoomPhase;
  members: RoomMember[];
  race?: { raceId: string; loadedIds: string[]; [key: string]: unknown };
  [key: string]: unknown;
}

export interface HelloRequest {
  type: "hello";
  protocolVersion: typeof PROTOCOL_VERSION;
  ruleset: typeof ROOM_RULESET;
  resourceVersion: ResourceVersion;
  name: string;
  equipment: unknown;
  initial: string;
  raceRuntime: boolean;
  /** One-time entry ticket from the data service, required by game servers. */
  ticket?: string;
}

export interface WelcomeMessage {
  type: "welcome";
  playerId: string;
  protocolVersion: typeof PROTOCOL_VERSION;
  ruleset: typeof ROOM_RULESET;
  capabilities: string[];
  requestId?: string;
}

export interface ClockMessage {
  type: "clock";
  clientTick: number;
  serverTick: number;
  requestId?: string;
}

export interface ErrorMessage {
  type: "error";
  code: string;
  requestId?: string;
}

export interface RoomMessage {
  type: "room";
  room: RoomSnapshot;
  requestId?: string;
}

export interface RoomsMessage {
  type: "rooms";
  page: number;
  total: number;
  rooms: Record<string, unknown>[];
  requestId?: string;
}

/** All observed server event names. Payloads beyond the core messages remain unknown. */
export const SERVER_EVENT_TYPES = [
  "welcome", "clock", "rooms", "room", "room-settings", "chat", "race-chat", "left",
  "error", "team-gauge", "giant-state", "award-motion", "latency-probe", "latency",
  "latency-ack", "p2p-signal", "p2p-relay", "p2p-accepted",
] as const;

export type ServerEventType = (typeof SERVER_EVENT_TYPES)[number];
export type OtherServerMessage = { type: Exclude<ServerEventType,
  "welcome" | "clock" | "error" | "room" | "rooms">; requestId?: string; [key: string]: unknown };
export type ServerMessage = WelcomeMessage | ClockMessage | ErrorMessage |
  RoomMessage | RoomsMessage | OtherServerMessage;

/** Requests are extensible as new lobby/gameplay modules are implemented. */
export interface ClientRequest { type: string; requestId?: never; [key: string]: unknown }

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && [...value].length >= min && [...value].length <= max &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

function safeInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function roomShape(value: unknown): value is RoomSnapshot {
  if (!record(value) || !boundedString(value.roomId, 1, 64) ||
      !safeInteger(value.revision, 1, Number.MAX_SAFE_INTEGER) ||
      !boundedString(value.name, 1, 18) ||
      !["open", "loading", "countdown", "racing", "finished"].includes(String(value.phase)) ||
      !Array.isArray(value.members) || value.members.length < 1 || value.members.length > 8) return false;
  if (value.race !== undefined && (!record(value.race) ||
      !boundedString(value.race.raceId, 1, 64) ||
      !Array.isArray(value.race.loadedIds) ||
      !value.race.loadedIds.every((id: unknown) => boundedString(id, 1, 64)))) return false;
  return value.members.every((member: unknown) => record(member) &&
    boundedString(member.playerId, 1, 64) && boundedString(member.name, 1, 18) &&
    safeInteger(member.slot, 0, 7) && typeof member.ready === "boolean" &&
    (member.team === null || member.team === 1 || member.team === 2));
}

/**
 * Checks the core envelope and important handshake/state fields. For other event
 * types, callers must validate feature-specific fields before using them.
 */
export function parseServerMessage(raw: unknown): ServerMessage {
  if (!record(raw) || typeof raw.type !== "string" ||
      !SERVER_EVENT_TYPES.includes(raw.type as ServerEventType) ||
      (raw.requestId !== undefined && !boundedString(raw.requestId, 1, 64))) {
    throw new Error("Invalid multiplayer control message");
  }
  switch (raw.type) {
    case "welcome":
      if (!boundedString(raw.playerId, 1, 64) || raw.protocolVersion !== PROTOCOL_VERSION ||
          raw.ruleset !== ROOM_RULESET || !Array.isArray(raw.capabilities) ||
          raw.capabilities.length > 32 || !raw.capabilities.every((x: unknown) => boundedString(x, 1, 64))) {
        throw new Error("Invalid multiplayer welcome");
      }
      break;
    case "clock":
      if (typeof raw.clientTick !== "number" || !Number.isFinite(raw.clientTick) || raw.clientTick < 0 ||
          typeof raw.serverTick !== "number" || !Number.isFinite(raw.serverTick) || raw.serverTick < 0) {
        throw new Error("Invalid multiplayer clock response");
      }
      break;
    case "error":
      if (!boundedString(raw.code, 1, 64)) throw new Error("Invalid multiplayer error");
      break;
    case "room":
      if (!roomShape(raw.room)) throw new Error("Invalid multiplayer room");
      break;
    case "rooms":
      if (!safeInteger(raw.page, 0, 100_000) || !safeInteger(raw.total, 0, 100_000) ||
          !Array.isArray(raw.rooms) || raw.rooms.length > 10 || !raw.rooms.every(record)) {
        throw new Error("Invalid multiplayer room list");
      }
      break;
  }
  return raw as unknown as ServerMessage;
}
