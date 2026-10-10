/** 40 since motion frames name racers by room slot (motion.ts); the release is 39. */
export const PROTOCOL_VERSION = 40;
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
  "latency-ack", "p2p-signal", "p2p-relay", "p2p-accepted", "item",
] as const;

export type ServerEventType = (typeof SERVER_EVENT_TYPES)[number];
export type OtherServerMessage = { type: Exclude<ServerEventType,
  "welcome" | "clock" | "error" | "room" | "rooms">; requestId?: string; [key: string]: unknown };
export type ServerMessage = WelcomeMessage | ClockMessage | ErrorMessage |
  RoomMessage | RoomsMessage | OtherServerMessage;

/** Requests are extensible as new lobby/gameplay modules are implemented. */
export interface ClientRequest { type: string; requestId?: never; [key: string]: unknown }

/**
 * 道具赛 requests (ITEM_MODE.md 5): one `item` type, told apart by `action`.
 * `sequence` rises by exactly one per racer and race. Points are in the
 * original client's z-up coordinates (three.js (x, y, z) is client (x, -z, y)).
 */
interface ItemRequestBase { type: "item"; roomId: string; raceId: string; sequence: number }
export type ItemRequest = ItemRequestBase & (
  | { action: "cube"; cubeId: number; capacity: 2 | 3 }
  | { action: "use"; itemId: number; targetId?: string;
    point?: { x: number; y: number; z: number } }
  | { action: "place"; useId: number; point: { x: number; y: number; z: number } }
  | { action: "hit"; useId: number; itemId: number; result: "hit" | "blocked";
    by?: "shield" | "angel" | "emp" | "escape" | "kart" | "pet" | "eat"; hazardId?: number;
    /** How the hit differs from the plain effect (ITEM_MODE.md C.2, C.7). */
    variant?: "small" | "headband" | "bonus" | "quick" | "balloon";
    /** Which missile of a double-rocket use (used.count 2). */
    shot?: 0 | 1 }
  | { action: "swap" }
  | { action: "change" }
  /** A trapped racer left its bubble early (useId 0: a track water mine, with hazardId). */
  | { action: "escape"; useId: number; hazardId?: number }
  /** The racer's authoritative slots again, after a rejection left them in doubt. */
  | { action: "slots" });

/** Defences a blocked item hit may name (ITEM_MODE.md 5, C.7). */
export type ItemBlocker = "shield" | "angel" | "emp" | "escape" | "kart" | "pet" | "eat";
/** How a landed (or eaten) hit differs from the item's plain effect (ITEM_MODE.md C.2, C.7). */
export type ItemHitVariant = "small" | "headband" | "bonus" | "quick" | "balloon";
export const ITEM_HIT_BLOCKERS: readonly ItemBlocker[] =
  Object.freeze(["shield", "angel", "emp", "escape", "kart", "pet", "eat"]);
export const ITEM_HIT_VARIANTS: readonly ItemHitVariant[] =
  Object.freeze(["small", "headband", "bonus", "quick", "balloon"]);
/**
 * `by` names a defence of a blocked hit; a variant goes with a landed hit,
 * except the lucci bonus of a mine the kart ate (`by:"eat"`, `variant:"bonus"`).
 */
export function validHitOutcome(result: unknown, by: unknown, variant: unknown, shot: unknown): boolean {
  if (result !== "hit" && result !== "blocked") return false;
  if (by !== undefined && (result !== "blocked" || !ITEM_HIT_BLOCKERS.includes(by as ItemBlocker)))
    return false;
  if (variant !== undefined) {
    if (!ITEM_HIT_VARIANTS.includes(variant as ItemHitVariant)) return false;
    if (result === "blocked" && !(by === "eat" && variant === "bonus")) return false;
  }
  return shot === undefined || shot === 0 || shot === 1;
}

/**
 * The finish report. In item races it may say the racer's start boost
 * succeeded (完美起步 title, ITEM_MODE.md C.9).
 */
export interface FinishRequest { type: "finish"; elapsedMs: number; perfectStart?: boolean }

/** Server error codes of rejected item requests; none of them fails the race. */
export const ITEM_ERROR_CODES = [
  "ITEM_UNAVAILABLE", "ITEM_NOT_HELD", "ITEM_LOCKED", "INVALID_SEQUENCE",
  "INVALID_USE", "INVALID_TARGET",
] as const;

function point(value: unknown): boolean {
  return record(value) && [value.x, value.y, value.z].every(axis =>
    typeof axis === "number" && Number.isFinite(axis) && Math.abs(axis) <= 1_000_000);
}

/** Check an item request before it is sent; the bounds match the server event parser. */
export function isValidItemRequest(value: unknown): value is ItemRequest {
  if (!record(value) || value.type !== "item" || !boundedString(value.roomId, 1, 64) ||
      !boundedString(value.raceId, 1, 64) ||
      !safeInteger(value.sequence, 1, Number.MAX_SAFE_INTEGER)) return false;
  const item = (id: unknown) => safeInteger(id, 0, 255);
  switch (value.action) {
    case "cube":
      return safeInteger(value.cubeId, 1, 4096) && (value.capacity === 2 || value.capacity === 3);
    case "use":
      return item(value.itemId) &&
        (value.targetId === undefined || boundedString(value.targetId, 1, 64)) &&
        (value.point === undefined || point(value.point));
    case "place":
      return safeInteger(value.useId, 1, Number.MAX_SAFE_INTEGER) && point(value.point);
    case "hit":
      return safeInteger(value.useId, 0, Number.MAX_SAFE_INTEGER) && item(value.itemId) &&
        validHitOutcome(value.result, value.by, value.variant, value.shot) &&
        (value.useId !== 0 || value.shot === undefined) &&
        (value.hazardId === undefined || safeInteger(value.hazardId, 0, 4096));
    case "escape":
      return safeInteger(value.useId, 0, Number.MAX_SAFE_INTEGER) &&
        (value.useId === 0 ? safeInteger(value.hazardId, 1, 4096) : value.hazardId === undefined);
    case "swap":
    case "change":
    case "slots":
      return true;
    default:
      return false;
  }
}

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
