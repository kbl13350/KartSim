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
