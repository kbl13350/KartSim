import { PROTOCOL_VERSION, ROOM_RULESET } from "./protocol";

export interface ServerEventValidation {
  validRoom(value: unknown): boolean;
  validChannel(channel: unknown, mode: unknown, speed: unknown): boolean;
  validGameplay(gameplay: unknown, channel: unknown, resourceVersion: unknown): boolean;
  validRandomTrackCode(code: number): boolean;
}

export type ParsedServerEvent = Record<string, unknown> & { type: string; requestId?: string };

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, min: number, max: number): value is string =>
  typeof value === "string" && [...value].length >= min && [...value].length <= max &&
  !/[\u0000-\u001f\u007f]/u.test(value);
const integer = (value: unknown, min: number, max: number): value is number =>
  Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const version = (value: unknown) => ["p3528", "p3543", "p3553"].includes(String(value));
const trackId = (value: unknown) => typeof value === "string" &&
  /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value);
const chat = (value: unknown) => record(value) &&
  integer(value.sequence, 1, Number.MAX_SAFE_INTEGER) &&
  text(value.playerId, 1, 64) && text(value.name, 1, 18) &&
  text(value.text, 1, 120) && !!value.text.trim();
const sdp = (value: unknown) => typeof value === "string" && value.length > 0 &&
  value.length <= 16_384 && /^v=0\r?\n/.test(value) &&
  /(?:^|\n)m=application /m.test(value) &&
  !/(?:^|\n)m=(?:audio|video) /m.test(value);
const giantState = (value: Record<string, unknown>) =>
  Number.isInteger(value.main) && Number(value.main) >= 0 && Number(value.main) <= 4 &&
  Number.isInteger(value.extra) && Number(value.extra) >= 0 && Number(value.extra) <= 2 &&
  (value.main === 4 || value.extra === 0) &&
  (value.status === 0 || value.status === 1);

/** Validate every observed server control envelope before it reaches game state. */
export function parseServerEvent(value: unknown,
  dependencies: ServerEventValidation): ParsedServerEvent | undefined {
  // A malformed item event never closes the connection (ITEM_MODE.md 5).
  if (record(value) && value.type === "item") {
    return (parseItemServerEvent(value) ?? invalidItemEvent(value)) as unknown as ParsedServerEvent;
  }
  if (!record(value) || (value.requestId !== undefined && !text(value.requestId, 1, 64))) {
    return undefined;
  }
  const event = value as ParsedServerEvent;
  switch (event.type) {
    case "p2p-signal":
      return text(event.roomId, 1, 64) && text(event.raceId, 1, 64) &&
        text(event.playerId, 1, 64) && text(event.generation, 1, 64) &&
        (event.kind === "offer" || event.kind === "answer") && sdp(event.sdp)
        ? event : undefined;
    case "p2p-relay":
      return text(event.roomId, 1, 64) && text(event.raceId, 1, 64) &&
        text(event.playerId, 1, 64) ? event : undefined;
    case "p2p-accepted":
      return text(event.roomId, 1, 64) && text(event.raceId, 1, 64) ? event : undefined;
    case "welcome":
      return text(event.playerId, 1, 64) && event.protocolVersion === PROTOCOL_VERSION &&
        event.ruleset === ROOM_RULESET && Array.isArray(event.capabilities) &&
        event.capabilities.length <= 32 && event.capabilities.every(item => text(item, 1, 64))
        ? event : undefined;
    case "team-gauge":
      return text(event.roomId, 1, 64) && text(event.raceId, 1, 64) &&
        (event.team === 1 || event.team === 2) &&
        integer(event.sequence, 1, Number.MAX_SAFE_INTEGER) &&
        typeof event.target === "number" && Number.isFinite(event.target) &&
        event.target >= 0 && event.target <= 1 ? event : undefined;
    case "giant-state":
      if (!text(event.roomId, 1, 64) || !text(event.raceId, 1, 64) ||
          !text(event.playerId, 1, 64) ||
          !integer(event.sequence, 1, Number.MAX_SAFE_INTEGER) ||
          !giantState(event)) return undefined;
      return { type: "giant-state", roomId: event.roomId, raceId: event.raceId,
        playerId: event.playerId, sequence: event.sequence, main: event.main,
        extra: event.extra, status: event.status,
        ...(event.requestId === undefined ? {} : { requestId: event.requestId }) };
    case "award-motion":
      return text(event.roomId, 1, 64) && text(event.raceId, 1, 64) &&
        text(event.playerId, 1, 64) && typeof event.motion === "number" &&
        [3, 4, 5, 12].includes(event.motion) ? event : undefined;
    case "latency-probe":
      return text(event.roomId, 1, 64) && text(event.raceId, 1, 64) &&
        text(event.nonce, 1, 64) ? event : undefined;
    case "latency":
      return text(event.roomId, 1, 64) && text(event.raceId, 1, 64) &&
        text(event.playerId, 1, 64) && integer(event.latencyMs, 0, 5_000)
        ? event : undefined;
    case "latency-ack":
      return event;
    case "room":
      return dependencies.validRoom(event.room) ? event : undefined;
    case "room-settings":
      return text(event.roomId, 1, 64) &&
        integer(event.revision, 1, Number.MAX_SAFE_INTEGER) &&
        text(event.name, 1, 18) && !!event.name.trim() &&
        text(event.password, 0, 12) ? event : undefined;
    case "chat":
      return text(event.roomId, 1, 64) && chat(event.message) ? event : undefined;
    case "race-chat":
      return text(event.roomId, 1, 64) && text(event.raceId, 1, 64) &&
        chat(event.message) ? event : undefined;
    case "left":
      return text(event.roomId, 1, 64) ? event : undefined;
    case "error":
      return text(event.code, 1, 64) ? event : undefined;
    case "clock":
      return typeof event.clientTick === "number" && Number.isFinite(event.clientTick) &&
        event.clientTick >= 0 && typeof event.serverTick === "number" &&
        Number.isFinite(event.serverTick) && event.serverTick >= 0 ? event : undefined;
    case "rooms":
      return integer(event.page, 0, 100_000) && integer(event.total, 0, 100_000) &&
        Array.isArray(event.rooms) && event.rooms.length <= 10 &&
        event.rooms.every(item => record(item) && text(item.roomId, 1, 64) &&
          text(item.name, 1, 18) &&
          (item.mode === "individual" || item.mode === "team") &&
          integer(item.capacity, 2, 8) && item.speedVersion === "国服" &&
          dependencies.validChannel(item.channelName, item.mode, item.speed) &&
          dependencies.validGameplay(item.gameplay, item.channelName, item.resourceVersion) &&
          integer(item.count, 0, Number(item.capacity)) &&
          typeof item.locked === "boolean" && version(item.resourceVersion) &&
          (item.trackId === undefined || trackId(item.trackId)) &&
          (item.randomTrackCode === undefined ||
            (typeof item.randomTrackCode === "number" &&
              dependencies.validRandomTrackCode(item.randomTrackCode) &&
              item.resourceVersion === "p3553" && item.trackId === undefined)) &&
          (item.trackId !== undefined || item.randomTrackCode !== undefined))
        ? event : undefined;
    default:
      return undefined;
  }
}

// ---- 道具赛 item events (ITEM_MODE.md 5) ----

/** Item indices are below 256 (the highest original index is 133, giantRobot). */
export const ITEM_ID_MAX = 255;
/** `instanceOrdinal` of a track's item cubes, 1..N with N at most 195 in p3553. */
export const ITEM_CUBE_ID_MAX = 4096;
/** Longest projectile flight the client schedules from `startAt`. */
export const ITEM_ETA_MAX_MS = 60_000;
const ITEM_COORDINATE_LIMIT = 1_000_000;
const ITEM_TARGETS_MAX = 8;

export type ItemSlots = number[];
export interface ItemPoint { x: number; y: number; z: number }
export type ItemBlocker = "shield" | "angel" | "emp" | "escape";

interface ItemEventBase { type: "item"; roomId: string; raceId: string; requestId?: string }
/** Reply to `cube`: the drawn item, or null with the reason nothing was given. */
export interface ItemGrantEvent extends ItemEventBase {
  action: "grant"; cubeId: number; itemId: number | null;
  reason?: "full" | "abusing"; slots: ItemSlots; playerId?: string;
}
/** A use: broadcast to the others, and the reply (with `slots`) to the user. */
export interface ItemUsedEvent extends ItemEventBase {
  action: "used"; playerId: string; useId: number; itemId: number; targets: string[];
  startAt: number; etaMs: number; point?: ItemPoint; slots?: ItemSlots;
}
/** The landing point of a barricade or a time bomb. */
export interface ItemPlacedEvent extends ItemEventBase {
  action: "placed"; playerId: string; useId: number; itemId: number; point: ItemPoint;
  slots?: ItemSlots;
}
/** A victim's own hit report; `useId` 0 is a hazard placed on the track. */
export interface ItemHitEvent extends ItemEventBase {
  action: "hit"; playerId: string; useId: number; itemId: number; userId?: string;
  result: "hit" | "blocked"; by?: ItemBlocker; removed?: boolean; hazardId?: number;
  slots?: ItemSlots;
}
/** Reply to `swap` / `change`. */
export interface ItemSlotsEvent extends ItemEventBase {
  action: "slots"; slots: ItemSlots; playerId?: string;
}
/** An opponent's slots while this team's 透视镜 lasts. */
export interface ItemScanEvent extends ItemEventBase {
  action: "scan"; playerId: string; slots: ItemSlots; until: number;
}
export type ItemServerEvent = ItemGrantEvent | ItemUsedEvent | ItemPlacedEvent |
  ItemHitEvent | ItemSlotsEvent | ItemScanEvent;

/** What an invalid item event becomes: it rejects its request and changes nothing else. */
export interface InvalidItemEvent { type: "error"; code: "INVALID_ITEM_EVENT"; requestId?: string }

const itemId = (value: unknown): value is number => integer(value, 0, ITEM_ID_MAX);
const useId = (value: unknown, min: number) => integer(value, min, Number.MAX_SAFE_INTEGER);
const clock = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Two or three slots of item indices; -1 (or null) is an empty slot. */
function itemSlots(value: unknown): ItemSlots | undefined {
  if (!Array.isArray(value) || value.length < 2 || value.length > 3) return undefined;
  const slots: number[] = [];
  for (const slot of value) {
    if (slot === null || slot === -1) slots.push(-1);
    else if (itemId(slot)) slots.push(slot);
    else return undefined;
  }
  return slots;
}

function itemPoint(value: unknown): ItemPoint | undefined {
  if (!record(value)) return undefined;
  const axes = [value.x, value.y, value.z];
  return axes.every(axis => typeof axis === "number" && Number.isFinite(axis) &&
    Math.abs(axis) <= ITEM_COORDINATE_LIMIT)
    ? { x: value.x as number, y: value.y as number, z: value.z as number } : undefined;
}

function itemTargets(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.length <= ITEM_TARGETS_MAX &&
    value.every(id => text(id, 1, 64)) && new Set(value).size === value.length
    ? [...value] as string[] : undefined;
}

/** Optional fields: absent, or valid. */
function optional<T>(value: unknown, parse: (input: unknown) => T | undefined):
  { ok: boolean; value?: T } {
  if (value === undefined) return { ok: true };
  const parsed = parse(value);
  return parsed === undefined ? { ok: false } : { ok: true, value: parsed };
}

const optionalText = (value: unknown) =>
  optional(value, input => text(input, 1, 64) ? input : undefined);
const optionalSlots = (value: unknown) => optional(value, itemSlots);

/**
 * Strict projection of an `item` server event onto its known fields; any
 * missing, extra-typed or out-of-range field rejects the whole event.
 */
export function parseItemServerEvent(value: Record<string, unknown>): ItemServerEvent | undefined {
  if (value.type !== "item" || !text(value.roomId, 1, 64) || !text(value.raceId, 1, 64) ||
      (value.requestId !== undefined && !text(value.requestId, 1, 64))) return undefined;
  const base = { type: "item" as const, roomId: value.roomId, raceId: value.raceId,
    ...(value.requestId === undefined ? {} : { requestId: value.requestId as string }) };
  switch (value.action) {
    case "grant": {
      const slots = itemSlots(value.slots);
      const playerId = optionalText(value.playerId);
      const granted = value.itemId !== null;
      if (!integer(value.cubeId, 1, ITEM_CUBE_ID_MAX) || !slots || !playerId.ok ||
          (granted ? !itemId(value.itemId) || value.reason !== undefined
            : value.reason !== undefined && value.reason !== "full" &&
              value.reason !== "abusing")) return undefined;
      return { ...base, action: "grant", cubeId: value.cubeId,
        itemId: granted ? value.itemId as number : null,
        ...(value.reason === undefined ? {} : { reason: value.reason as "full" | "abusing" }),
        slots, ...(playerId.value === undefined ? {} : { playerId: playerId.value }) };
    }
    case "used": {
      const targets = itemTargets(value.targets);
      const point = optional(value.point, itemPoint);
      const slots = optionalSlots(value.slots);
      if (!text(value.playerId, 1, 64) || !useId(value.useId, 1) || !itemId(value.itemId) ||
          !targets || !clock(value.startAt) || !integer(value.etaMs, 0, ITEM_ETA_MAX_MS) ||
          !point.ok || !slots.ok) return undefined;
      return { ...base, action: "used", playerId: value.playerId, useId: value.useId as number,
        itemId: value.itemId, targets, startAt: value.startAt, etaMs: value.etaMs,
        ...(point.value ? { point: point.value } : {}),
        ...(slots.value ? { slots: slots.value } : {}) };
    }
    case "placed": {
      const point = itemPoint(value.point);
      const slots = optionalSlots(value.slots);
      if (!text(value.playerId, 1, 64) || !useId(value.useId, 1) || !itemId(value.itemId) ||
          !point || !slots.ok) return undefined;
      return { ...base, action: "placed", playerId: value.playerId,
        useId: value.useId as number, itemId: value.itemId, point,
        ...(slots.value ? { slots: slots.value } : {}) };
    }
    case "hit": {
      // The game node writes `userId: null` for a track hazard (useId 0).
      const userId = optionalText(value.userId === null && value.useId === 0 ? undefined : value.userId);
      const slots = optionalSlots(value.slots);
      const hazard = value.useId === 0;
      if (!text(value.playerId, 1, 64) || !useId(value.useId, 0) || !itemId(value.itemId) ||
          !userId.ok || (!hazard && userId.value === undefined) ||
          (value.result !== "hit" && value.result !== "blocked") ||
          (value.by !== undefined && (value.result !== "blocked" ||
            !["shield", "angel", "emp", "escape"].includes(String(value.by)))) ||
          (value.removed !== undefined && typeof value.removed !== "boolean") ||
          (value.hazardId !== undefined && !integer(value.hazardId, 0, ITEM_CUBE_ID_MAX)) ||
          !slots.ok) return undefined;
      return { ...base, action: "hit", playerId: value.playerId, useId: value.useId as number,
        itemId: value.itemId, ...(userId.value === undefined ? {} : { userId: userId.value }),
        result: value.result,
        ...(value.by === undefined ? {} : { by: value.by as ItemBlocker }),
        ...(value.removed === undefined ? {} : { removed: value.removed as boolean }),
        ...(value.hazardId === undefined ? {} : { hazardId: value.hazardId as number }),
        ...(slots.value ? { slots: slots.value } : {}) };
    }
    case "slots": {
      const slots = itemSlots(value.slots);
      const playerId = optionalText(value.playerId);
      if (!slots || !playerId.ok) return undefined;
      return { ...base, action: "slots", slots,
        ...(playerId.value === undefined ? {} : { playerId: playerId.value }) };
    }
    case "scan": {
      const slots = itemSlots(value.slots);
      if (!text(value.playerId, 1, 64) || !slots || !clock(value.until)) return undefined;
      return { ...base, action: "scan", playerId: value.playerId, slots, until: value.until };
    }
    default:
      return undefined;
  }
}

/**
 * An item event that fails validation is dropped instead of closing the
 * connection like other malformed events: it becomes an error that rejects the
 * pending item request it answers (the item controller then resynchronises
 * from the next `slots`), and every listener ignores an error without one.
 */
export function invalidItemEvent(value: Record<string, unknown>): InvalidItemEvent {
  return { type: "error", code: "INVALID_ITEM_EVENT",
    ...(text(value.requestId, 1, 64) ? { requestId: value.requestId } : {}) };
}
