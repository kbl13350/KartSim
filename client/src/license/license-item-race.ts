/**
 * 驾照考试 item missions (release RiderSchoolItemStage) on the time attack
 * race: the item race controller of 道具赛 with the license's local item
 * authority (license-item-authority.ts), the course's item boxes, the item
 * effects, the item slots and notices, the targets (license-item-targets.ts)
 * and the scripted attacks of the course's event:* points.
 *
 * What the release data gives (riderSchool@cn.xml, the course): the slots at
 * GO, the box item, the slot count, the targets, the arrows, nonLimitItem and
 * oneTime. What a step asks besides the goal comes from its briefing
 * (stage_riderSchoolReady stage_stringBag stepN_1/2): 导弹练习 hits its board,
 * 水炸弹练习 traps its target before the goal, 连续导弹 shoots every 海盗船长
 * and then takes the magnet over the goal. The scripted attacks fire on the
 * course's own points: event:waterfly (水苍蝇), event:waterbomb (a water bomb
 * where the player is heading, on courses where the player has none),
 * event:devil* (大魔王). Their timing, and the magnet of 连续导弹, are
 * [还原].
 */
import { Group, PerspectiveCamera } from "three";
import { c5, d5, dn, dt, j2, l5, lt, p2, s2, T, y9 } from "../generated/formats.js";
import { he, Iw, Q9, Rw, S9, U1, fn } from "../generated/library.js";
import {
  ItemInputRouter, itemReverseDrivingEffect, type ItemDirectionKey, type ItemInputTransition,
} from "../input/item-input";
import { ItemIdx, type ItemCatalog } from "../item/item-catalog";
import type { ItemTrackModel } from "../item/item-cube-source";
import { loadItemCubeField, type ItemCubeField, type ItemPairWorld } from "../item/item-cubes";
import { itemCatalogFor, loadItemGameTrackSources } from "../item/item-race-map";
import { ItemRaceController, type ItemRacePhysics } from "../item/item-race-controller";
import { loadItemRacePresenter } from "../item/item-race-presenter";
import type { ItemPresenterPose, ItemRacePresenter } from "../item/item-race-presenter-contract";
import { threeToClient, type Vec3 } from "../item/item-race-rules";
import { ItemHud, type ItemHudDependencies } from "../ui/item-hud";
import { giantControllerDuration } from "../ui/giant-boost-hud-model";
import type { ItemHudState } from "../ui/item-hud-state";
import { collectItemHudPlayPanels, finalizeItemHudPlayPanels } from "../ui/item-hud-play-panels";
import { readStoredItemHudOptions } from "../ui/item-hud-options";
import { uniqueOriginalCoinAsset } from "../vehicle/track-coin-source";
import { LicenseItemAuthority } from "./license-item-authority";
import { LicenseTargetField, licenseDummies, type LicenseTarget } from "./license-item-targets";
import type { LicenseMissionSpec } from "./license-mission";

export const LICENSE_PLAYER = "license-player";
/** Who throws the course's scripted attacks: never drawn, never aimed at. */
const ATTACKER = "license-attacker";
/** The time attack lifecycle phase of the race (TimeAttackPhase.Racing). */
const RACING_PHASE = 2;
/** 导弹练习 clears the moment its board is down: its goal is only the end of the practice road [还原]. */
const CLEAR_ON_TARGETS: ReadonlySet<number> = new Set([3]);
/** The scripted attacker trails the kart this far (the fly and the bomb come from behind) [还原]. */
const ATTACKER_BEHIND = 30;
/** A scripted water fly arrives after this long if its item has no flight cap [还原]. */
const FLY_ETA_MS = 1500;
/**
 * The magnet steps' limits (C107: 269 units from the start line, 5.5 s for 磁铁练习,
 * 5.4 s with an Alt swap, 4.5 s with a Z change; riderSchool@cn.xml, tuned for
 * practice kart V1 on 2022-10-20) leave room only for a magnet that locks on
 * the iron 296 units away at GO and pulls far faster than the kart drives.
 * The item race's own aim range (150) and pull (60 u/s) cannot make 4.5 s
 * [还原: these values make 4.5 s with about 0.7 s to spare].
 */
const LICENSE_AIM_RANGE = 300;
const LICENSE_PULL = { acceleration: 60, maximumSpeed: 100 };
/**
 * 水炸弹练习 (C108) throws at its red mark (event:waterbomb, x 590–572) and
 * traps the target 200 units on (target0, x 370) before the goal
 * (stage_stringBag step11_1/2). The item race's throw (1 s of the kart's
 * speed plus 20 ahead) lands 65 units on; here a water bomb lands on the
 * nearest board ahead within this reach and the aim cone [还原].
 */
const LOB_REACH = 250;
const LOB_CONE_COS = Math.cos(25 * Math.PI / 180);

export interface LicenseItemPlan {
  capacity: 1 | 2;
  /** itemslot0/1 as item idx (the one slot of a one-slot step). */
  startSlots: number[];
  /** itemslot1 of a one-slot step: what 道具变更卡 (Z) turns slot 0 into. */
  changeTo?: number;
  cubeItem?: number;
  refill: boolean;
  /** 道具换位卡 / 道具变更卡: oneTime gives one, else as many as wanted. */
  changers: { slot: number; item: number };
  clearOnTargets: boolean;
}

/** The item set-up of an item step (rule item). */
export function licenseItemPlan(spec: LicenseMissionSpec,
  catalog: Pick<ItemCatalog, "byName">): LicenseItemPlan {
  const { setup } = spec;
  const idx = (name: string): number => {
    const item = catalog.byName(name);
    if (!item) throw new Error(`驾照考试第 ${spec.step} 关的道具 ${name} 不在道具目录中。`);
    return item.idx;
  };
  const capacity = setup.slotCount === 1 ? 1 : 2;
  const named = (setup.slots ?? []).map(idx);
  const changeTo = capacity === 1 ? named[1] : undefined;
  const cards = setup.oneTime ? 1 : -1;
  return {
    capacity,
    startSlots: named.slice(0, capacity),
    ...(changeTo !== undefined ? { changeTo } : {}),
    ...(setup.cubeItem ? { cubeItem: idx(setup.cubeItem) } : {}),
    refill: setup.nonLimitItem === true,
    changers: { slot: capacity === 2 && named.length === 2 ? cards : 0, item: changeTo !== undefined ? cards : 0 },
    clearOnTargets: CLEAR_ON_TARGETS.has(spec.mission),
  };
}

/** The item a course's event:<name> point throws at the player, if it attacks. */
export function scriptedAttack(event: string, plan: Pick<LicenseItemPlan, "startSlots">): number | undefined {
  if (event === "waterfly") return ItemIdx.waterFly;
  if (/^devil\d*$/.test(event)) return ItemIdx.devil;
  // 水炸弹练习's red mark is where the player throws its own; elsewhere (逃脱水炸弹) it is thrown at them.
  if (event === "waterbomb" && !plan.startSlots.includes(ItemIdx.waterBomb)) return ItemIdx.waterBomb;
  return undefined;
}

/** The time attack race as the item race reads it each frame. */
export interface LicenseItemHost {
  session: {
    lifecycle: { phase: number; startAtMs: number; finishAtMs: number; effectiveTime(rawNowMs: number): number };
    speedResetState?: { phase?: number };
  };
  warpNext?: { blocksDriving?(): boolean };
  drivingInput?: { setSteeringInverted?(enabled: boolean): void; setForwardReverseSwap?(enabled: boolean): void };
}

/** The local kart of an item step: the item mode members of AL. */
export type LicenseItemPhysics = ItemRacePhysics & {
  itemEffects?: ItemRacePhysics["itemEffects"] & {
    readonly steeringInverted?: boolean;
    readonly forwardBackSwapped?: boolean;
    escapePress?(): void;
    directionPress?(direction: ItemDirectionKey): void;
  };
};

export interface LicenseItemRaceLoad {
  library: unknown;
  spec: LicenseMissionSpec;
  trackId: string;
  /** The decoded course (cubes and target dummies). */
  model: ItemTrackModel & { root: { trackObjects: unknown[] } };
  environment: unknown;
  stageBinding: unknown;
  audioContext?: unknown;
  physics: LicenseItemPhysics;
  /** The race HUD's slot definition (gameplayUi.definition.items). */
  slots?: unknown;
  warn?(message: string): void;
}

type Library = Parameters<typeof itemCatalogFor>[0];

const modelOps = {
  originalAsset: (archive: unknown, path: string) => uniqueOriginalCoinAsset(archive as never, path),
  decodeModel: (bytes: Uint8Array) => y9(bytes),
  loadModel: (data: unknown, archive: unknown, path: string, identity: unknown, options: unknown) =>
    c5(data as never, archive as never, path, identity as never, options as never),
};

function hudDependencies(warn: (message: string) => void): ItemHudDependencies {
  const attribute = T as ItemHudDependencies["attribute"];
  return {
    attribute, numbers: j2, parseBml: s2, decodeTexture: p2, findResource: U1,
    geometry: lt, place: l5, createRenderer: () => new fn(new Map()),
    cloud: {
      attribute, parseBml: s2, findResource: U1, parseModel: y9,
      collectPlayPanels: collectItemHudPlayPanels as never,
      finalizePlay: finalizeItemHudPlayPanels as never,
      loadPlayScene: (binding: unknown, library: unknown) => Rw(binding, library, { convertClientCoordinates: false }),
      createPlayRuntime: (binding: unknown, scene: unknown, tick: unknown) => new Iw(binding, scene, tick),
      createRenderer: (runtimes: unknown) => new fn(runtimes),
      makeUi: d5, layoutUi: dn, materialize: dt, controllerDuration: giantControllerDuration,
      createCamera: () => new PerspectiveCamera(),
    },
    warn,
  } as ItemHudDependencies;
}

export class LicenseItemRace {
  /** Track group content: the item boxes, the targets and the item effects. */
  readonly object = new Group();
  readonly input = new ItemInputRouter();
  controller!: ItemRaceController;
  authority!: LicenseItemAuthority<LicenseTarget>;
  /** The step's own objective is met (no targets: from the start). */
  objectiveMet = false;
  /** Why the objective is not met, for the result message. */
  readonly failure?: string;
  private nowMs = 0;
  /** After GO and before the finish (a reset does not end it). */
  private racing = false;
  /** A reset or a warp holds the kart: no item use, no boxes, no hits. */
  private suspended = false;
  private started = false;
  private clearPending = false;
  private trapped = false;
  private readonly fired = new Set<string>();
  private readonly hints: string[] = [];
  /** The app-wide input accumulator the devil reverses (cleared when the race ends). */
  private drivingInput?: LicenseItemHost["drivingInput"];
  disposed = false;

  private constructor(
    readonly spec: LicenseMissionSpec,
    readonly plan: LicenseItemPlan,
    readonly catalog: ItemCatalog,
    readonly physics: LicenseItemPhysics,
    readonly targets: LicenseTargetField,
    readonly cubes: ItemCubeField | undefined,
    readonly presenter: ItemRacePresenter | undefined,
    readonly hud: ItemHud | undefined,
    readonly trackId: string,
  ) {
    this.object.name = "licenseItemRace";
    active = this;
    this.object.add(targets.object);
    if (cubes) this.object.add(cubes.object as never);
    if (presenter?.object) this.object.add(presenter.object as never);
    const boards = targets.targets.filter(target => target.role === "board");
    if (boards.length) {
      const water = plan.startSlots.includes(ItemIdx.waterBomb);
      this.failure = water ? "任务失败：没有用水炸弹困住目标物。"
        : boards.length > 1 ? "任务失败：没有用导弹击中赛道上所有的海盗船长。"
          : "任务失败：没有用导弹击中目标物。";
    }
    this.restart();
  }

  static async load(options: LicenseItemRaceLoad): Promise<LicenseItemRace> {
    const { library, spec, physics } = options;
    const warn = options.warn ?? (() => undefined);
    const sources = await loadItemGameTrackSources(library as Library, options.model, options.trackId);
    const catalog = sources.catalog;
    const plan = licenseItemPlan(spec, catalog);
    const disposables: Array<{ dispose(): void }> = [];
    try {
      const targets = await LicenseTargetField.load(library, licenseDummies(options.model.root.trackObjects as never),
        spec.setup, options.environment, options.stageBinding, modelOps as never);
      disposables.push(targets);
      const cubes = sources.cubes.cubes.length ? await loadItemCubeField(library, sources.cubes,
        options.environment, options.stageBinding, options.audioContext as never, undefined, {
          createObject: () => new Group(), ...modelOps, decodeAudio: Q9, routeAudio: S9,
        } as never) : undefined;
      if (cubes) disposables.push(cubes);
      // The effects and icons of what this step can show: its own items and the scripted attacks.
      const shown = new Set<number>([...plan.startSlots, ItemIdx.waterFly, ItemIdx.waterBomb, ItemIdx.devil,
        ItemIdx.shield, ItemIdx.magnet, ...(plan.changeTo !== undefined ? [plan.changeTo] : []),
        ...(plan.cubeItem !== undefined ? [plan.cubeItem] : [])]);
      const narrowed = { ...catalog, items: catalog.items.filter(item => shown.has(item.idx)) };
      let presenter: ItemRacePresenter | undefined;
      try {
        presenter = await loadItemRacePresenter(library, narrowed, options.environment, options.stageBinding,
          options.audioContext as never, { ...modelOps, decodeAudio: Q9, routeAudio: S9, setGain: he } as never);
        disposables.push(presenter);
      } catch (error) {
        warn(`道具特效未能载入：${error instanceof Error ? error.message : String(error)}`);
      }
      const hud = await ItemHud.load(library, hudDependencies(warn), {
        capacity: plan.capacity, ...(options.slots ? { slots: options.slots as never } : {}),
        options: readStoredItemHudOptions(),
        describe: idx => {
          const item = catalog.get(idx);
          return item && (item.title || item.description)
            ? { name: item.title, description: item.description } : undefined;
        },
        itemIds: [...shown],
      });
      disposables.push(hud);
      return new LicenseItemRace(spec, plan, catalog, physics, targets, cubes, presenter, hud, options.trackId);
    } catch (error) {
      for (const owner of disposables.reverse()) owner.dispose();
      throw error;
    }
  }

  private target(id: string): LicenseTarget | undefined {
    return this.targets.targets.find(target => target.id === id);
  }

  private attackerPose(): ItemPresenterPose {
    const body = this.physics.body;
    const back = (axis: "x" | "y" | "z") => body.position[axis] - body.forward[axis] * ATTACKER_BEHIND;
    return { position: { x: back("x"), y: back("y"), z: back("z") }, forward: { ...body.forward },
      right: { ...body.right }, up: { ...body.up } };
  }

  /**
   * A new race on these owners (the first one, or a retry): a fresh
   * controller and authority, every board up and every box back. The kart's
   * slots were emptied by its start reset.
   */
  restart(world?: ItemPairWorld): void {
    if (this.disposed) return;
    this.clearReverse();
    this.controller?.dispose();
    this.started = false;
    this.racing = false;
    this.suspended = false;
    this.clearPending = false;
    this.trapped = false;
    this.fired.clear();
    this.hints.length = 0;
    this.targets.reset();
    this.objectiveMet = !this.targets.targets.some(target => target.role === "board");
    // The race judges the step on these (ready-license.ts).
    this.spec.progress.objective = this.objectiveMet;
    if (this.failure) this.spec.progress.failure = this.failure;
    this.authority = new LicenseItemAuthority({
      playerId: LICENSE_PLAYER, catalog: this.catalog, capacity: this.plan.capacity,
      startSlots: this.plan.startSlots,
      ...(this.plan.cubeItem !== undefined ? { cubeItem: this.plan.cubeItem } : {}),
      refill: this.plan.refill, changers: this.plan.changers,
      ...(this.plan.changeTo !== undefined ? { changeTo: this.plan.changeTo } : {}),
      now: () => this.nowMs,
      position: () => ({ ...this.physics.body.position }),
      targets: this.targets.targets,
      onTargetHit: (target, itemId) => this.targetHit(target, itemId),
      landing: itemId => this.catalog.get(itemId)?.behaviour.family === "waterBomb" ? this.lobTarget() : undefined,
    });
    this.controller = new ItemRaceController({
      playerId: LICENSE_PLAYER,
      roster: [
        { playerId: LICENSE_PLAYER, name: "", team: null },
        ...this.targets.targets.map(target => ({ playerId: target.id, name: target.name, team: null })),
        { playerId: ATTACKER, name: "海盗船长", team: null },
      ],
      teamRace: false,
      trackId: this.trackId,
      catalog: this.catalog,
      physics: this.physics,
      connection: this.authority,
      local: { racing: () => this.racing, suspended: () => this.suspended },
      remotes: {
        pose: id => id === ATTACKER ? this.attackerPose() : this.target(id)?.pose,
        racing: id => this.target(id)?.alive === true,
      },
      toLocalMs: serverMs => serverMs,
      now: () => this.nowMs,
      changers: { ...this.plan.changers, itemArmed: false },
      aimRangeM: LICENSE_AIM_RANGE,
      pull: LICENSE_PULL,
      ...(this.presenter ? { presenter: this.presenter } : {}),
      log: (message, error) => console.warn(`驾照道具：${message}`, error ?? ""),
    });
    this.presenter?.reset();
    this.hud?.reset();
    this.cubes?.reset?.();
    if (world) this.attach(world);
  }

  private collecting = (): boolean => this.racing && !this.suspended;

  /** The board a thrown water bomb lands on: the nearest one ahead in reach. */
  private lobTarget(): Vec3 | undefined {
    const { position, forward } = this.physics.body;
    const length = Math.hypot(forward.x, forward.y, forward.z) || 1;
    let best: LicenseTarget | undefined;
    let bestDistance = Infinity;
    for (const target of this.targets.targets) {
      if (target.role !== "board" || !target.alive) continue;
      const dx = target.pose.position.x - position.x, dy = target.pose.position.y - position.y,
        dz = target.pose.position.z - position.z;
      const gap = Math.hypot(dx, dy, dz);
      const along = (dx * forward.x + dy * forward.y + dz * forward.z) / length;
      if (gap > LOB_REACH || along <= 0 || along / gap < LOB_CONE_COS || gap >= bestDistance) continue;
      best = target;
      bestDistance = gap;
    }
    return best ? { ...best.pose.position } : undefined;
  }

  /** Pair the item boxes with the race coordinator (made anew by every start). */
  private attach(world: ItemPairWorld): void {
    this.cubes?.attach(world, () => ({ ...this.physics.body.position }), this.collecting,
      cubeId => this.controller.cube(cubeId));
  }

  private targetHit(target: LicenseTarget, itemId: number): void {
    // A missile still in flight at the goal lands too late: the finish was judged without it.
    if (target.role !== "board" || !this.racing) return;
    // A missile knocks the board over; a water bomb holds it in its bubble.
    this.targets.hit(target, this.nowMs, this.catalog.get(itemId)?.behaviour.family !== "waterBomb");
    if (this.targets.targets.some(entry => entry.role === "board" && entry.alive)) return;
    this.objectiveMet = true;
    this.spec.progress.objective = true;
    if (this.plan.clearOnTargets) this.clearPending = true;
    // 连续导弹: with every board down the boxes give the magnet for the iron over the goal [还原].
    if (this.targets.targets.some(entry => entry.role === "iron")) this.authority.setCubeItem(ItemIdx.magnet);
  }

  /** One frame before the physics step. */
  update(host: LicenseItemHost, rawNowMs: number): void {
    if (this.disposed) return;
    const lifecycle = host.session.lifecycle;
    const now = lifecycle.effectiveTime(rawNowMs);
    this.nowMs = now;
    this.suspended = (host.session.speedResetState?.phase ?? 0) !== 0 ||
      host.warpNext?.blocksDriving?.() === true;
    this.racing = lifecycle.phase === RACING_PHASE && lifecycle.startAtMs !== 0 && now >= lifecycle.startAtMs &&
      lifecycle.finishAtMs === 0;
    if (this.racing && !this.started) {
      this.started = true;
      this.authority.start();
    }
    // 大魔王 swaps left and right through the input snapshot.
    const effects = this.physics.itemEffects;
    this.drivingInput = host.drivingInput;
    host.drivingInput?.setSteeringInverted?.(effects?.steeringInverted === true);
    host.drivingInput?.setForwardReverseSwap?.(effects?.forwardBackSwapped === true);
    this.controller.update(now);
    this.authority.update(now);
    // 逃脱水炸弹: the 좌우연타 (mash left/right) hint when the bubble closes on the kart.
    const trapped = (effects?.remainingMs("trap") ?? 0) > 0;
    if (trapped && !this.trapped) this.hints.push("shakeHit");
    this.trapped = trapped;
  }

  /** One rendered frame, after the track scene update. */
  present(camera: unknown, width: number, height: number): void {
    if (this.disposed) return;
    this.cubes?.update(this.nowMs, camera, width, height);
    this.targets.update(this.nowMs, camera, width, height);
    this.controller.present({ nowMs: this.nowMs, camera, width, height });
  }

  /** This frame's item HUD state (slots, aim, warnings, changer cards). */
  hudState(): ItemHudState {
    const state = this.controller.hudState(this.nowMs);
    this.hud?.setState(state);
    return state;
  }

  /**
   * Ctrl, Alt and Z become item commands; arrows also break a bubble.
   * `racingNow` is the lifecycle's own phase: a paused race keeps the keys
   * (and their releases) away from the items.
   */
  routeInput<T>(transitions: readonly T[], nowMs: number, racingNow = true): T[] {
    const effects = this.physics.itemEffects;
    return this.input.route(transitions as unknown as ItemInputTransition[], {
      racing: this.racing && racingNow,
      command: command => this.controller.handleCommand(command, nowMs),
      escape: () => { if (racingNow) effects?.escapePress?.(); },
      direction: direction => { if (racingNow) effects?.directionPress?.(direction); },
    }) as unknown as T[];
  }

  /** Alt or Z used a changer card this frame (the slot_changer sound). */
  consumeSlotChangerSound(): boolean {
    return !this.disposed && this.controller.consumeSlotChangerSound();
  }

  /** The devil's swap ends with the race: the next race steers normally. */
  private clearReverse(): void {
    this.drivingInput?.setSteeringInverted?.(false);
    this.drivingInput?.setForwardReverseSwap?.(false);
  }

  /** A pedal or drift command as a running reverse remaps it. */
  reverseEffect<T>(effect: T): T {
    const effects = this.physics.itemEffects;
    if (!effects || typeof effect !== "object" || effect === null ||
        typeof (effect as { kind?: unknown }).kind !== "string") return effect;
    return itemReverseDrivingEffect(effect as unknown as { kind: string; direction?: number }, {
      steeringInverted: effects.steeringInverted === true,
      forwardBackSwapped: effects.forwardBackSwapped === true,
    }) as unknown as T;
  }

  cancelInput(): void {
    this.input.cancel({ command: command => this.controller.handleCommand(command, this.nowMs) });
  }

  /** A route tag of the course: its scripted attacks fire once a race. */
  routeTag(tag: string): void {
    const match = /^event:(\w+):in:next$/.exec(tag);
    if (!match || this.disposed || !this.racing || this.suspended) return;
    const event = match[1]!;
    const itemId = scriptedAttack(event, this.plan);
    if (itemId === undefined || this.fired.has(event)) return;
    this.fired.add(event);
    const behaviour = this.catalog.get(itemId)?.behaviour;
    if (!behaviour) return;
    if (itemId === ItemIdx.waterFly) {
      // 护盾练习: the 아이템_실드 hint as the fly comes.
      this.hints.push("sheild");
      this.authority.attack(itemId, ATTACKER, behaviour.maxEtaMs ?? FLY_ETA_MS);
    } else if (behaviour.family === "waterBomb") {
      // Thrown where the kart will be when it lands.
      const body = this.physics.body;
      const lead = behaviour.delayMs / 1000;
      const point: Vec3 = { x: body.position.x + body.linearVelocity.x * lead,
        y: body.position.y + body.linearVelocity.y * lead, z: body.position.z + body.linearVelocity.z * lead };
      this.authority.attack(itemId, ATTACKER, 0, { point: threeToClient(point) });
    } else {
      this.authority.attack(itemId, ATTACKER, 0);
    }
  }

  /** The course's eventList hints the race asks for (sheild, shakeHit). */
  consumeHints(): string[] {
    return this.hints.splice(0);
  }

  /** 导弹练习: the board is down, the step clears now. */
  consumeClear(): boolean {
    const clear = this.clearPending;
    this.clearPending = false;
    return clear;
  }

  dispose(): void {
    if (this.disposed) return;
    this.clearReverse();
    this.disposed = true;
    if (active === this) active = undefined;
    this.controller?.dispose();
    this.object.removeFromParent();
    this.presenter?.dispose();
    this.cubes?.dispose();
    this.targets.dispose();
    this.hud?.dispose();
  }
}

/** The license item race of the current race, if its step has one. */
export function licenseItemsOf(session: unknown): LicenseItemRace | undefined {
  const items = (session as { licenseItems?: unknown } | undefined)?.licenseItems;
  return items instanceof LicenseItemRace ? items : undefined;
}

/** The race the app runs (one at a time); the input pipeline has no session. */
let active: LicenseItemRace | undefined;

/** The license item race of the race being driven, if its step has one. */
export function activeLicenseItems(): LicenseItemRace | undefined {
  return active && !active.disposed ? active : undefined;
}
