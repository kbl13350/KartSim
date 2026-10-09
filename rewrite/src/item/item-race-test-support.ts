/**
 * Test-only fakes for the item race controller: a catalog built from the
 * Appendix B base-0 lifetimes through the real `itemBehaviour`, fake physics,
 * connection, presenter and remotes. Not part of the game build.
 */
import type { ItemState } from "./item-bml";
import { ITEM_REGISTRY, itemBehaviour, type ItemCatalog, type ItemDefinition } from "./item-catalog";
import {
  ItemRaceController, type ItemRaceControllerOptions, type ItemRaceEffectEvent,
} from "./item-race-controller";
import type {
  ItemKartEffect, ItemPresenterPose, ItemRacePresenter,
} from "./item-race-presenter-contract";
import type { PhysicsItemEffect, Vec3 } from "./item-race-rules";

type StateSpec = [name: string, lifeMs: number, extra?: Partial<ItemState>];

const AIM: StateSpec = ["Aim", 0, { auxFx: ["aiming", "inrange", "ontarget", "misfire"] }];
const ROCKET: StateSpec[] = [AIM, ["Use", 1500], ["Affect", 1500], ["Shield", 1000]];

/** Base-0 states of the item race set (ITEM_MODE.md appendix B, item.bml lifetimes). */
export const TEST_ITEM_STATES: Readonly<Record<string, StateSpec[]>> = {
  booster: [],
  teamBooster: [],
  banana: [["Use", 500], ["Set", 30000, { size: 2 }], ["Affect", 2000], ["Shield", 2000]],
  waterBomb: [["Use", 1000], ["Set", 1000, { size: 10 }], ["Affect", 2000], ["EscapeAffect", 2000]],
  waterFly: [["Use", 2000], ["Affect", 1000], ["EscapeAffect", 2000], ["Shield", 1000]],
  rocket: ROCKET,
  guideRocket: ROCKET,
  randomRocket: ROCKET,
  magnet: [AIM, ["Use", 3000]],
  shield: [["Use", 2000], ["Shield", 1000]],
  angel: [["Use", 500], ["Affect", 4000], ["Defend", 1000]],
  devil: [["Use", 500], ["Preaffect", 1000], ["Affect", 3000], ["Escape", 2000]],
  ufo: [["Use", 1500], ["Affect", 3000], ["PostAffect", 500], ["Shield", 1500]],
  emp: [["Use", 500], ["Affect", 1500]],
  thunderbolt: [["Use", 500], ["Warning", 1000], ["Preaffect", 600], ["Affect", 1500]],
  barricade: [["StateUse", 1000, { size: 70 }], ["StateSet", 266, { size: 10 }],
    ["StateActive", 5000, { size: 4.3 }], ["StateAffect", 500], ["StateShield", 1000]],
  cloud2: [["Use", 666], ["Set", 10000], ["Remove", 666]],
  scanning: [["Use", 500], ["Affect", 8000]],
  slotLock: [["Use", 2000], ["Affect", 1000], ["Postaffect", 2000]],
  timeBomb: [["Use", 3000], ["Set", 1000, { size: 15 }], ["Affect", 2000], ["EscapeAffect", 2000]],
  mine: [["Set", 30000, { size: 2 }], ["Affect", 1500], ["Shield", 1000]],
  waterMine: [["Set", 30000, { size: 2 }], ["Explode", 1000, { size: 10 }], ["Affect", 2000],
    ["EscapeAffect", 2000], ["Shield", 1000]],
};

function states(specs: readonly StateSpec[]): Map<string, ItemState> {
  return new Map(specs.map(([name, lifeMs, extra]) =>
    [name, { name, lifeMs, attributes: {}, ...extra } as ItemState]));
}

/** A catalog with the real behaviours of the item race set. */
export function testItemCatalog(): Pick<ItemCatalog, "get" | "items"> {
  const items: ItemDefinition[] = ITEM_REGISTRY.map(entry => {
    const itemStates = states(TEST_ITEM_STATES[entry.name] ?? []);
    return { idx: entry.idx, name: entry.name, folder: entry.folder, base: entry.base,
      title: entry.name, description: "", states: itemStates,
      behaviour: itemBehaviour(entry.name, itemStates) };
  });
  const byIdx = new Map(items.map(item => [item.idx, item]));
  return { items, get: idx => byIdx.get(idx) };
}

export class FakeEffects {
  readonly applied: Array<{ kind: PhysicsItemEffect; durationMs: number;
    options: Record<string, unknown> }> = [];
  readonly ended: PhysicsItemEffect[] = [];
  readonly active = new Set<string>();
  events: ItemRaceEffectEvent[] = [];
  immune = false;
  canUseItem = true;
  escapeShieldRemainingMs = 0;
  clockMs = 0;
  readonly effects = new Map<string, { startMs: number; endMs: number }>();

  apply(kind: PhysicsItemEffect, durationMs: number, options: Record<string, unknown> = {}): boolean {
    this.applied.push({ kind, durationMs, options });
    this.active.add(kind);
    return true;
  }
  end(kind: PhysicsItemEffect): boolean {
    this.ended.push(kind);
    return this.active.delete(kind);
  }
  remainingMs(kind: PhysicsItemEffect): number {
    const effect = this.effects.get(kind);
    return effect ? Math.max(0, effect.endMs - this.clockMs) : 0;
  }
  consumeEvents(): ItemRaceEffectEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}

export class FakePhysics {
  itemSlotCapacity = 2;
  readonly slotsSet: number[][] = [];
  boosters = 0;
  readonly itemEffects = new FakeEffects();
  readonly body = {
    position: { x: 0, y: 0, z: 0 },
    right: { x: 1, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 },
    linearVelocity: { x: 0, y: 0, z: 10 },
  };
  setItemSlots(slots: readonly number[]): void { this.slotsSet.push([...slots]); }
  startItemBooster(): boolean { this.boosters += 1; return true; }
}

export type PresenterCall = [method: string, ...args: unknown[]];

export class FakePresenter implements ItemRacePresenter {
  readonly object = {} as ItemRacePresenter["object"];
  readonly calls: PresenterCall[] = [];
  used(event: unknown): void { this.calls.push(["used", event]); }
  placed(event: unknown): void { this.calls.push(["placed", event]); }
  hit(event: unknown): void { this.calls.push(["hit", event]); }
  removed(useId: number): void { this.calls.push(["removed", useId]); }
  kartEffect(playerId: string, kind: ItemKartEffect, startMs: number, durationMs: number): void {
    this.calls.push(["kartEffect", playerId, kind, startMs, durationMs]);
  }
  endKartEffect(playerId: string, kind: ItemKartEffect): void {
    this.calls.push(["endKartEffect", playerId, kind]);
  }
  sound(itemId: number, stem: string, options?: unknown): void {
    this.calls.push(["sound", itemId, stem, options]);
  }
  stopSound(key: string): void { this.calls.push(["stopSound", key]); }
  update(frame: unknown): void { this.calls.push(["update", frame]); }
  reset(): void { this.calls.push(["reset"]); }
  dispose(): void { this.calls.push(["dispose"]); }
  of(method: string): unknown[][] {
    return this.calls.filter(call => call[0] === method).map(call => call.slice(1));
  }
}

export interface SentItem { action: string; fields: Record<string, unknown> }

/** A server stand-in: `reply` answers each request (return a value, or throw for a rejection). */
export class FakeItemConnection {
  readonly sent: SentItem[] = [];
  listener: ((event: never) => void) | undefined;
  unsubscribed = false;
  reply: (request: SentItem) => unknown = () => ({});

  sendItem = (action: string, fields: Record<string, unknown> = {}): Promise<unknown> => {
    const request = { action, fields };
    this.sent.push(request);
    try {
      return Promise.resolve(this.reply(request));
    } catch (error) {
      return Promise.reject(error);
    }
  };

  subscribeItem = (listener: (event: never) => void): (() => void) => {
    this.listener = listener;
    return () => { this.unsubscribed = true; this.listener = undefined; };
  };

  emit(event: Record<string, unknown>): void {
    this.listener?.({ type: "item", roomId: "room", raceId: "race", ...event } as never);
  }

  of(action: string): Record<string, unknown>[] {
    return this.sent.filter(request => request.action === action).map(request => request.fields);
  }
}

/** Server clock = local clock + 1000 in these tests. */
export const SERVER_OFFSET_MS = 1000;

export interface ControllerFixture {
  controller: ItemRaceController;
  physics: FakePhysics;
  connection: FakeItemConnection;
  presenter: FakePresenter;
  poses: Map<string, ItemPresenterPose>;
  state: { racing: boolean; suspended: boolean; now: number; route?: Vec3 };
  logs: unknown[];
  catalog: ReturnType<typeof testItemCatalog>;
}

export const SELF = "self";
export const RIVAL = "rival";
export const MATE = "mate";
export const OTHER = "other";

export function pose(position: Vec3, forward: Vec3 = { x: 0, y: 0, z: 1 }): ItemPresenterPose {
  return { position, forward, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } };
}

export function controllerFixture(options: { teamRace?: boolean; presenter?: boolean;
  capacity?: number } = {}): ControllerFixture {
  const physics = new FakePhysics();
  if (options.capacity) physics.itemSlotCapacity = options.capacity;
  const connection = new FakeItemConnection();
  const presenter = new FakePresenter();
  const poses = new Map<string, ItemPresenterPose>();
  const state: ControllerFixture["state"] = { racing: true, suspended: false, now: 0 };
  const logs: unknown[] = [];
  const catalog = testItemCatalog();
  const teamRace = options.teamRace ?? false;
  const controllerOptions: ItemRaceControllerOptions = {
    playerId: SELF,
    roster: [
      { playerId: SELF, name: "我", team: teamRace ? 1 : null },
      { playerId: MATE, name: "队友", team: teamRace ? 1 : null },
      { playerId: RIVAL, name: "对手", team: teamRace ? 2 : null },
      { playerId: OTHER, name: "路人", team: teamRace ? 2 : null },
    ],
    teamRace,
    catalog,
    physics,
    connection,
    local: {
      racing: () => state.racing,
      suspended: () => state.suspended,
      routePointAhead: distance => state.route ?? { x: 0, y: 0, z: distance + 1 },
    },
    remotes: {
      pose: id => poses.get(id),
      racing: id => poses.has(id),
    },
    toLocalMs: serverMs => serverMs - SERVER_OFFSET_MS,
    now: () => state.now,
    ...(options.presenter === false ? {} : { presenter }),
    hazardPosition: id => ({ x: id, y: 0, z: 0 }),
    log: (message, error) => logs.push([message, error instanceof Error ? error.message : error]),
  };
  const controller = new ItemRaceController(controllerOptions);
  return { controller, physics, connection, presenter, poses, state, logs, catalog };
}

/** Let pending reply promises settle. */
export async function settle(): Promise<void> {
  for (let index = 0; index < 5; index++) await Promise.resolve();
}
