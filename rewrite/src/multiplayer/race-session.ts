import type { DecodedGameMotion } from "./payload";
import { isValidItemRequest, type RoomMember, type RoomPhase } from "./protocol";
import type { ItemServerEvent } from "./server-events";

export interface RaceScope {
  roomId: string;
  raceId: string;
  members: Set<string>;
  sequence: number;
  received: Map<string, number>;
  enabled: boolean;
  recipientMask: number;
  encoder?: unknown;
}

export interface PodiumScope {
  roomId: string;
  raceId: string;
  members: Set<string>;
}

export interface SessionRoom {
  roomId: string;
  phase: RoomPhase;
  members: RoomMember[];
  race?: { raceId: string; loadedIds: string[]; results?: unknown;
    roster?: Array<{ playerId: string }>; returnedIds?: string[] };
  raceError?: unknown;
}

type RaceEvent = { type: string; roomId?: string; raceId?: string;
  playerId?: string; message?: string; [key: string]: unknown };

export interface RaceSessionHost {
  playerId?: string;
  motionScope?: RaceScope;
  podiumScope?: PodiumScope;
  raceLatencies: Map<string, number>;
  echoRtt: { milliseconds?: number; reportAndReset(): void };
  peerTransport?: {
    bind(room?: SessionRoom): void;
    directAvailable(slot: number): boolean;
    latency(playerId: string): number | undefined;
  };
  request(message: { type: string; [key: string]: unknown }): Promise<unknown>;
  subscribe(listener: (message: RaceEvent) => void): () => void;
  subscribeMotion(listener: (message: DecodedGameMotion) => void): () => void;
  sendMotion(payload: unknown, mask?: number): boolean;
}

/** Update race and podium permissions from a validated room snapshot. */
export function bindRaceScope(host: RaceSessionHost, room?: SessionRoom): void {
  host.peerTransport?.bind(room);
  const playerId = host.playerId;
  const isMember = !!room && !!playerId &&
    room.members.some(member => member.playerId === playerId);

  if (!isMember) {
    host.podiumScope = undefined;
  } else if (room!.phase === "finished" && room!.race?.results) {
    const race = room!.race!;
    host.podiumScope = {
      roomId: room!.roomId,
      raceId: race.raceId,
      members: new Set(room!.members
        .filter(member => race.roster!.some(entry => entry.playerId === member.playerId) &&
          !race.returnedIds?.includes(member.playerId))
        .map(member => member.playerId)),
    };
  } else if (room!.phase === "open" && !room!.race && !room!.raceError &&
      host.podiumScope?.roomId === room!.roomId) {
    const present = new Set(room!.members.map(member => member.playerId));
    const podium = host.podiumScope!;
    for (const id of podium.members) {
      if (!present.has(id)) podium.members.delete(id);
    }
  } else {
    host.podiumScope = undefined;
  }

  if (!room?.race || !isMember || !playerId) {
    host.motionScope = undefined;
    host.raceLatencies.clear();
    return;
  }

  const race = room.race;
  const enabled = (room.phase === "loading" && race.loadedIds.includes(playerId)) ||
    room.phase === "countdown" || room.phase === "racing";
  let recipientMask = 0;
  for (const member of room.members) {
    if (member.playerId !== playerId && race.loadedIds.includes(member.playerId)) {
      recipientMask |= 1 << member.slot;
    }
  }

  const current = host.motionScope;
  if (current?.roomId === room.roomId && current.raceId === race.raceId) {
    current.enabled = enabled;
    current.members = new Set(room.members.map(member => member.playerId));
    current.recipientMask = recipientMask;
    return;
  }

  host.raceLatencies.clear();
  host.motionScope = {
    roomId: room.roomId, raceId: race.raceId,
    members: new Set(room.members.map(member => member.playerId)),
    sequence: 0, received: new Map(), enabled, recipientMask,
  };
}

/** Item request actions (ITEM_MODE.md 5). */
export type ItemRequestAction = "cube" | "use" | "place" | "hit" | "swap" | "change" | "escape" |
  "slots";

/**
 * Failures that never reached the server's sequence check, so the sequence
 * number is still unused: local send failures, the connection's rate limit
 * (answered before the lobby sees the request), the scope checks before it
 * and the sequence rejection itself — the same list as the node test bot's
 * CHECKED_BEFORE_SEQUENCE (server-go/test/lib/item-race.mjs). Every other
 * failure (a timeout included) is taken as consumed, as the server consumes a
 * sequence once it passes the +1 check even when the request is then rejected.
 */
const ITEM_UNCONSUMED_FAILURES: ReadonlySet<string> = new Set([
  "INVALID_SEQUENCE", "ITEM_UNAVAILABLE", "RACE_NOT_FOUND", "NOT_RACE_PARTICIPANT",
  "INVALID_ROOMID", "INVALID_RACEID", "ROOM_NOT_FOUND", "NOT_IN_ROOM", "NOT_ROOM_MEMBER",
  "RATE_LIMITED",
  "Not connected", "Connection busy", "Race connection scope expired", "INVALID_ITEM_REQUEST",
]);

/**
 * After an INVALID_SEQUENCE rejection (a lost reply left the counters apart)
 * the request is retried once with each of these offsets from the expected
 * sequence; a rejected probe consumes nothing on the server.
 */
export const ITEM_SEQUENCE_PROBES: readonly number[] = Object.freeze([1, -1]);

function failureCode(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * A capability-limited race connection. Each operation rechecks the room,
 * race, player identity and AbortSignal before sending or delivering events.
 */
export function createRaceConnection(host: RaceSessionHost, roomId: string,
  raceId: string, signal: AbortSignal) {
  const playerId = host.playerId;
  const active = () => !signal.aborted && host.playerId === playerId &&
    host.motionScope?.roomId === roomId && host.motionScope.raceId === raceId;
  const onPodium = () => !signal.aborted && host.playerId === playerId &&
    host.podiumScope?.roomId === roomId && host.podiumScope.raceId === raceId &&
    host.podiumScope.members.has(playerId!);
  if (!playerId || !active()) throw new Error("Race connection scope is not active");

  const scopedSubscription = <T>(subscribe: (callback: (event: T) => void) => () => void,
    callback: (event: T) => void): (() => void) => {
    const remove = subscribe(callback);
    const cleanup = () => { remove(); signal.removeEventListener("abort", cleanup); };
    signal.addEventListener("abort", cleanup, { once: true });
    return cleanup;
  };

  const requestWhenActive = (message: { type: string; [key: string]: unknown }) =>
    active() ? host.request({ ...message, roomId, raceId })
      : Promise.reject(new Error("Race connection scope expired"));

  // 道具赛: one request at a time with this racer's sequence rising by one,
  // like giant-state. A rejected item request only rejects its own promise.
  let itemSequence = 0;
  let itemChain: Promise<unknown> = Promise.resolve();
  const sendItemNow = async (action: ItemRequestAction,
    fields: Record<string, unknown>): Promise<ItemServerEvent> => {
    for (const offset of [0, ...ITEM_SEQUENCE_PROBES]) {
      const sequence = itemSequence + 1 + offset;
      if (sequence < 1) continue;
      const message: { type: string; [key: string]: unknown } =
        { ...fields, type: "item", roomId, raceId, sequence, action };
      if (!isValidItemRequest(message as unknown)) throw new Error("INVALID_ITEM_REQUEST");
      if (!active()) throw new Error("Race connection scope expired");
      try {
        const reply = await host.request(message) as ItemServerEvent;
        itemSequence = sequence;
        return reply;
      } catch (error) {
        const code = failureCode(error);
        if (code === "INVALID_SEQUENCE") continue;
        if (!ITEM_UNCONSUMED_FAILURES.has(code)) itemSequence = sequence;
        throw error;
      }
    }
    throw new Error("INVALID_SEQUENCE");
  };

  return Object.freeze({
    playerId, roomId, raceId,
    get hasMotionRecipients() {
      return active() && !!host.motionScope?.enabled && host.motionScope.recipientMask !== 0;
    },
    get motionRoundTripMs() { return active() ? host.echoRtt.milliseconds : undefined; },
    resetMotionRtt: () => { if (active()) host.echoRtt.reportAndReset(); },
    directMotionAvailable: (slot: number) =>
      active() && (host.peerTransport?.directAvailable(slot) ?? false),
    latencyMs: (id: string) =>
      active() ? host.peerTransport?.latency(id) ?? host.raceLatencies.get(id) : undefined,
    sendTeamCharge: (charge: number, sequence: number) =>
      requestWhenActive({ type: "team-charge", charge, sequence }),
    sendGiantState: (state: Record<string, unknown>, sequence: number) =>
      active()
        ? host.request({ type: "giant-state", roomId, raceId, sequence, ...state })
        : Promise.reject(new Error("Race connection scope expired")),
    subscribeGiantState: (listener: (event: RaceEvent) => void) => {
      if (!active()) return () => {};
      return scopedSubscription(host.subscribe.bind(host), event => {
        if (active() && event.type === "giant-state" && event.roomId === roomId &&
            event.raceId === raceId && event.playerId !== playerId &&
            host.motionScope?.members.has(event.playerId!)) listener(event);
      });
    },
    subscribeTeamGauge: (listener: (event: RaceEvent) => void) => {
      if (!active()) return () => {};
      return scopedSubscription(host.subscribe.bind(host), event => {
        if (active() && event.type === "team-gauge" && event.roomId === roomId &&
            event.raceId === raceId) listener(event);
      });
    },
    /**
     * Send one item request; it waits for the previous one. Resolves with the
     * server's reply (an item event) and rejects with Error(code).
     */
    sendItem: (action: ItemRequestAction, fields: Record<string, unknown> = {}) => {
      const run = () => sendItemNow(action, fields);
      const result = itemChain.then(run, run);
      itemChain = result.catch(() => {});
      return result;
    },
    /**
     * Item events of this race from the other racers (used, placed, hit,
     * escaped) and the server (scan). Replies carry a requestId and come back
     * as the result of `sendItem` instead.
     */
    subscribeItem: (listener: (event: ItemServerEvent) => void) => {
      if (!active()) return () => {};
      return scopedSubscription(host.subscribe.bind(host), event => {
        if (active() && event.type === "item" && event.roomId === roomId &&
            event.raceId === raceId && event.requestId === undefined)
          listener(event as unknown as ItemServerEvent);
      });
    },
    sendAwardMotion: (motion: unknown) =>
      active() || onPodium()
        ? host.request({ type: "award-motion", roomId, raceId, motion })
        : Promise.reject(new Error("Race connection scope expired")),
    sendRaceChat: (text: string) => requestWhenActive({ type: "race-chat", text }),
    subscribeRaceChat: (listener: (message: string | undefined) => void) => {
      if (!active()) return () => {};
      return scopedSubscription(host.subscribe.bind(host), event => {
        if (active() && event.type === "race-chat" && event.roomId === roomId &&
            event.raceId === raceId) listener(event.message);
      });
    },
    subscribeAwardMotion: (listener: (event: RaceEvent) => void) => {
      if (!active()) return () => {};
      return scopedSubscription(host.subscribe.bind(host), event => {
        if ((active() || onPodium()) && event.type === "award-motion" &&
            event.roomId === roomId && event.raceId === raceId &&
            event.playerId !== playerId &&
            (host.podiumScope ?? host.motionScope)?.members.has(event.playerId!)) listener(event);
      });
    },
    returnToRoom: () =>
      active() || onPodium()
        ? host.request({ type: "return-room", roomId, raceId }).then(result => {
          if (host.podiumScope?.roomId === roomId && host.podiumScope.raceId === raceId) {
            host.podiumScope.members.delete(playerId);
          }
          return result;
        })
        : Promise.reject(new Error("Race connection scope expired")),
    /**
     * The local finish. Item races may add `perfectStart` (the start boost
     * succeeded, for the 完美起步 title); other races never send it.
     */
    reportFinish: (elapsedMs: number, extra?: { perfectStart?: boolean }) =>
      requestWhenActive({ type: "finish", elapsedMs,
        ...(typeof extra?.perfectStart === "boolean" ? { perfectStart: extra.perfectStart } : {}) }),
    sendMotion: (payload: unknown, mask?: number) => active() && host.sendMotion(payload, mask),
    subscribeMotion: (listener: (motion: DecodedGameMotion) => void) => {
      if (!active()) return () => {};
      return scopedSubscription(host.subscribeMotion.bind(host), motion => {
        if (active() && motion.roomId === roomId && motion.raceId === raceId) listener(motion);
      });
    },
  });
}
