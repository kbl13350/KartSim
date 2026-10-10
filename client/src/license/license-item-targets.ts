/**
 * The targets of a 驾照考试 item mission (RiderSchoolItemStage): the models of
 * stage_/riderSchoolItem placed at the course's ToDummy points. A step's
 * targetName (target2, the pirate-captain board; iron, the magnet weight)
 * stands at every target<N> dummy; a course's own `iron` dummy always gets
 * the iron. targetArrow / goalArrow put arrow.1s over the boards still up /
 * over the iron.
 *
 * How a board reacts to a hit, the arrow height and its bobbing are not in
 * the data [还原].
 */
import { Group } from "three";
import type { ItemPresenterPose } from "../item/item-race-presenter-contract";
import { clientToThreePoint, type Vec3 } from "../item/item-race-rules";

const FOLDER = "stage_/riderSchoolItem";
/** Without targetName (水炸弹练习) the target<N> dummies get the plain board [还原]. */
const DEFAULT_TARGET = "target";
/** A board falls this long after it is shot, then is gone [还原]. */
const FALL_MS = 500;
/** Aims and hits land this high above a board's foot (its face) [还原]. */
const BOARD_CENTRE = 4;
/** The arrow floats this high over its target and bobs this much [还原]. */
const ARROW_HEIGHT = 12;
const ARROW_BOB = 1;
const ARROW_PERIOD_MS = 1200;

export type LicenseTargetRole = "board" | "iron";

export interface LicenseTarget {
  /** Roster id of the item race (target0…, iron). */
  id: string;
  role: LicenseTargetRole;
  /** Name in the item notices. */
  name: string;
  /** three.js pose the items aim at and hit. */
  pose: ItemPresenterPose;
  /** Up until it is shot (a board); the iron always is. */
  alive: boolean;
  /** When it was shot (effective race clock). */
  hitAtMs?: number;
}

interface SceneNode {
  kind: string;
  className: string;
  name: string;
  transform: number[][];
  position: number[];
  scale: number[];
  slots: unknown[];
  slotOccurrences: unknown[];
  childOccurrences: unknown[];
  nodeEnabled: number;
  children: SceneNode[];
}

interface ModelData { root: SceneNode; settings?: unknown }

interface RenderedScene {
  object: Group;
  rootObjects: Array<{ name: string; visible: boolean } | undefined>;
  reset(nowMs: number): void;
  /** Re-serializes a wrapper's basis and position (item-cubes.ts). */
  setNodeScale(node: SceneNode, scale: number[]): void;
  update(nowMs: number, camera?: unknown, width?: number, height?: number): void;
  dispose(): void;
}

export interface LicenseTargetOps<Archive> {
  originalAsset(archive: Archive, path: string): { bytes(): Promise<Uint8Array> };
  decodeModel(bytes: Uint8Array): unknown;
  loadModel(data: ModelData, archive: Archive, path: string, identity: { id: string },
    options: Record<string, unknown>): Promise<unknown>;
}

interface DummyObject {
  kind: string;
  name: string;
  transform?: { basis?: number[][]; position?: number[] };
}

/** A target<N> or iron dummy of the course. */
export interface LicenseDummy {
  name: string;
  /** Client (Z-up) position and basis rows. */
  position: [number, number, number];
  basis: number[][];
}

export function licenseDummies(trackObjects: readonly DummyObject[]): LicenseDummy[] {
  const dummies: LicenseDummy[] = [];
  for (const object of trackObjects) {
    if (object.kind !== "ToDummy" || !/^(target\d+|iron)$/.test(object.name)) continue;
    const position = object.transform?.position;
    if (!position || position.length !== 3 || !position.every(Number.isFinite)) continue;
    const basis = object.transform?.basis;
    dummies.push({ name: object.name, position: [position[0]!, position[1]!, position[2]!],
      basis: basis?.length === 3 ? basis.map(row => [...row]) : [[1, 0, 0], [0, 1, 0], [0, 0, 1]] });
  }
  // target0, target1, … in course order, the iron last.
  return dummies.sort((a, b) => order(a.name) - order(b.name));
}

function order(name: string): number {
  return name === "iron" ? Number.MAX_SAFE_INTEGER : Number(name.slice(6));
}

const vector = (row: readonly number[] | undefined): Vec3 =>
  clientToThreePoint({ x: row?.[0] ?? 0, y: row?.[1] ?? 0, z: row?.[2] ?? 0 });

function pose(dummy: LicenseDummy, lift: number): ItemPresenterPose {
  const up = vector(dummy.basis[2]);
  const foot = clientToThreePoint({ x: dummy.position[0], y: dummy.position[1], z: dummy.position[2] });
  return {
    position: { x: foot.x + up.x * lift, y: foot.y + up.y * lift, z: foot.z + up.z * lift },
    right: vector(dummy.basis[0]), forward: vector(dummy.basis[1]), up,
  };
}

/** What a step puts where: the model of each target dummy, and the arrows. */
export interface LicenseTargetPlan {
  targetName?: string;
  targetArrow?: boolean;
  goalArrow?: boolean;
}

/** The targets of a course for a step (no model is loaded). */
export function licenseTargets(dummies: readonly LicenseDummy[], plan: LicenseTargetPlan): LicenseTarget[] {
  return dummies.map(dummy => {
    const iron = dummy.name === "iron" || plan.targetName === "iron";
    return {
      id: dummy.name, role: iron ? "iron" as const : "board" as const,
      name: iron ? "铁块" : plan.targetName === "target2" ? "海盗船长" : "目标物",
      pose: pose(dummy, iron ? 0 : BOARD_CENTRE), alive: true,
    };
  });
}

/** One model instance: its wrapper node and its object in the rendered scene. */
interface Instance {
  scene: RenderedScene;
  wrapper: SceneNode;
  view?: RenderedScene["rootObjects"][number];
  /** Client position at load. */
  base: number[];
}

interface Placed {
  target: LicenseTarget;
  model?: Instance;
  arrow?: Instance;
}

const IDENTITY = (): number[][] => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const ONE = [1, 1, 1];

function wrapper(template: SceneNode, name: string, position: readonly number[], basis: number[][],
  children: SceneNode[]): SceneNode {
  return {
    ...template, name, transform: basis.map(row => [...row]), position: [...position], scale: [...ONE],
    slots: Array.from({ length: template.slots.length }),
    slotOccurrences: Array.from({ length: template.slotOccurrences.length }),
    childOccurrences: [], nodeEnabled: 1, children,
  };
}

function cloneTree(node: SceneNode): SceneNode {
  return { ...node, children: node.children.map(cloneTree) };
}

/** Moves an instance to its load position raised by `rise` (client z); like the cubes, through its node. */
function raise(instance: Instance, rise: number): void {
  instance.wrapper.position = [instance.base[0]!, instance.base[1]!, instance.base[2]! + rise];
  instance.scene.setNodeScale(instance.wrapper, ONE);
}

/** Course targets with their models in the track group. */
export class LicenseTargetField {
  readonly object = new Group();
  private readonly scenes: RenderedScene[] = [];
  private readonly placed: Placed[];
  private readonly textures = new Map<unknown, { dispose(): void }>();
  private disposed = false;

  private constructor(readonly targets: LicenseTarget[], private readonly plan: LicenseTargetPlan) {
    this.object.name = "licenseTargets";
    this.placed = targets.map(target => ({ target }));
  }

  static async load<Archive>(archive: Archive, dummies: readonly LicenseDummy[], plan: LicenseTargetPlan,
    environment: unknown, stageBinding: unknown, ops: LicenseTargetOps<Archive>): Promise<LicenseTargetField> {
    const field = new LicenseTargetField(licenseTargets(dummies, plan), plan);
    try {
      await field.loadModels(archive, dummies, environment, stageBinding, ops);
      return field;
    } catch (error) {
      field.dispose();
      throw error;
    }
  }

  private async loadModels<Archive>(archive: Archive, dummies: readonly LicenseDummy[],
    environment: unknown, stageBinding: unknown, ops: LicenseTargetOps<Archive>): Promise<void> {
    const byModel = new Map<string, number[]>();
    this.placed.forEach((entry, index) => {
      const model = entry.target.role === "iron" ? "iron" : this.plan.targetName ?? DEFAULT_TARGET;
      byModel.set(model, [...byModel.get(model) ?? [], index]);
    });
    const options = { environment, stageBinding, advanceEnvironment: false as const,
      textureCache: this.textures };
    for (const [model, indices] of byModel) {
      const instances = await this.loadInstances(archive, model, indices.map(index => {
        const dummy = dummies[index]!;
        return { name: `${model}#${dummy.name}`, position: dummy.position, basis: dummy.basis };
      }), options, ops);
      indices.forEach((index, at) => { this.placed[index]!.model = instances[at]; });
    }
    const arrowed = this.placed.map((entry, index) => ({ entry, index })).filter(({ entry }) =>
      entry.target.role === "board" ? this.plan.targetArrow : this.plan.goalArrow);
    if (arrowed.length) {
      const instances = await this.loadInstances(archive, "arrow", arrowed.map(({ index }) => {
        const dummy = dummies[index]!;
        const up = dummy.basis[2] ?? [0, 0, 1];
        return { name: `arrow#${dummy.name}`, basis: IDENTITY(),
          position: dummy.position.map((value, axis) => value + (up[axis] ?? 0) * ARROW_HEIGHT) };
      }), options, ops);
      arrowed.forEach(({ entry }, at) => { entry.arrow = instances[at]; });
    }
  }

  private async loadInstances<Archive>(archive: Archive, model: string,
    instances: Array<{ name: string; position: readonly number[]; basis: number[][] }>,
    options: Record<string, unknown>, ops: LicenseTargetOps<Archive>): Promise<Instance[]> {
    const path = `${FOLDER}/${model}.1s`;
    const data = ops.decodeModel(await ops.originalAsset(archive, path).bytes()) as ModelData;
    if (data.root?.kind !== "node") throw new Error(`${path} 必须是独立 Relement。`);
    const root = wrapper(data.root, `license-${model}`, [0, 0, 0], IDENTITY(), []);
    const wrappers = instances.map(instance =>
      wrapper(data.root, instance.name, instance.position, instance.basis, [cloneTree(data.root)]));
    const scene = await ops.loadModel({ root, settings: data.settings }, archive, path,
      { id: `license-${model}` }, { ...options, additionalRoots: wrappers }) as RenderedScene;
    this.scenes.push(scene);
    this.object.add(scene.object);
    if (scene.rootObjects.length !== wrappers.length + 1) throw new Error(`${path} 场景根节点数量不一致。`);
    scene.reset(0);
    return wrappers.map((node, index) => ({ scene, wrapper: node, view: scene.rootObjects[index + 1],
      base: [...node.position] }));
  }

  /** The race (re)starts: every board up again. */
  reset(): void {
    for (const entry of this.placed) {
      entry.target.alive = true;
      entry.target.hitAtMs = undefined;
      if (entry.model) {
        raise(entry.model, 0);
        if (entry.model.view) entry.model.view.visible = true;
      }
      if (entry.arrow?.view) entry.arrow.view.visible = true;
    }
  }

  /** A board was shot (or trapped): it no longer counts as up. */
  hit(target: LicenseTarget, nowMs: number, falls: boolean): void {
    if (target.role !== "board" || !target.alive) return;
    target.alive = false;
    target.hitAtMs = falls ? nowMs : undefined;
    const entry = this.placed.find(placed => placed.target === target);
    if (entry?.arrow?.view) entry.arrow.view.visible = false;
  }

  update(nowMs: number, camera?: unknown, width?: number, height?: number): void {
    if (this.disposed) return;
    const bob = Math.sin((nowMs % ARROW_PERIOD_MS) / ARROW_PERIOD_MS * Math.PI * 2) * ARROW_BOB;
    for (const entry of this.placed) {
      if (entry.arrow?.view?.visible) raise(entry.arrow, bob);
      const { model, target } = entry;
      if (!model?.view?.visible || target.hitAtMs === undefined) continue;
      // A shot board sinks into the ground, then is gone.
      const progress = Math.min(1, Math.max(0, (nowMs - target.hitAtMs) / FALL_MS));
      raise(model, -progress * BOARD_CENTRE * 2);
      if (progress >= 1) model.view.visible = false;
    }
    for (const scene of this.scenes) scene.update(Math.trunc(nowMs) >>> 0, camera, width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.object.removeFromParent();
    for (const scene of this.scenes) scene.dispose();
    this.scenes.length = 0;
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
  }
}
