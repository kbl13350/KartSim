/** Kart booster visuals and effect scene ownership. */

export interface EffectObject {
  visible: boolean;
  parent?: EffectObject | null;
  add(object: EffectObject): void;
  removeFromParent(): void;
}

export interface EffectScene {
  object: EffectObject;
  reset(time: number): void;
  update(time: number, delta: number, camera: unknown, renderer: unknown): void;
  stopControllers?(time: number): void;
  pruneWorldMatrixRecursion?(): void;
  dispose(): void;
}

export interface EffectResource {
  virtualPath: string;
  bytes(): Promise<Uint8Array>;
}

export interface EffectLibrary {
  exactCanonicalCandidates(path: string): EffectResource[];
}

export interface EffectVehicle {
  boosterTypes: string[];
  attachments: string[];
  boosterWaveType?: string;
  driftBoostEffectType?: string;
  defaultExceedType: number;
  exceedWaveType: string;
}

export interface EffectSceneBinding {
  object: EffectObject;
  nodes: Map<string, { object: EffectObject }>;
}

export interface ParsedEffectScene {
  root: { kind: string; scene?: { scale: number[] }; scale?: number[] };
}

export interface BoosterEffectDependencies {
  decodeScene(bytes: Uint8Array): ParsedEffectScene;
  buildScene(parsed: ParsedEffectScene, library: EffectLibrary, path: string,
    identity: { id: string; folder?: string }, options: {
      environment: unknown; stageBinding: unknown; advanceEnvironment: boolean;
      convertClientCoordinates: boolean; textureCache: Map<unknown, { dispose(): void }>;
    }): Promise<EffectScene>;
  parseXml(bytes: Uint8Array): { root: EffectXmlNode };
  xmlChild(node: EffectXmlNode, name: string): EffectXmlNode | undefined;
  xmlAttribute(node: EffectXmlNode, name: string): string | undefined;
  warmDetachedScene(root: unknown, object: EffectObject, time: number, force: boolean): void;
}

export interface EffectXmlNode { name: string; children: EffectXmlNode[]; }

export interface BoosterInstance {
  kind: string;
  scene: EffectScene;
  family?: string;
}

const dualEffectKind = {
  idle: { solo: "boosterDualIdle", team: "boosterDualIdleTeam" },
  use: { solo: "boosterDual", team: "boosterDualTeam" },
} as const;
const exceedTablePath = "zeta_/cn/engine/exceedTypeChange.xml";
const defaultWave = "effect";

export class KartBoosterSharedSources {
  parsedScenes = new Map<string, ParsedEffectScene>();
  textureCache = new Map<unknown, { dispose(): void }>();
  refs = 0;

  retain(): void { this.refs += 1; }

  release(): void {
    if (this.refs <= 0) throw new Error("KartBoosterSharedSources 引用计数已为 0。");
    this.refs -= 1;
    if (this.refs === 0) {
      this.textureCache.forEach(texture => texture.dispose());
      this.textureCache.clear();
      this.parsedScenes.clear();
    }
  }
}

export function boosterKindForState(state: number): string | undefined {
  if (state === 1 || state === 2 || state === 3 || state === 8) return "booster";
  if (state === 4 || state === 9 || state === 13 || state === 14) return "boosterTeam";
  if (state === 18) return "boosterPlay";
}

export function waveKindForState(state: number): string | undefined {
  if (state === 1 || state === 13 || state === 14 || state === 19) return "baseBoosterWave";
  if (state === 2) return "driftBoostWave";
  if ([3, 4, 5, 6, 8, 9, 12, 17].includes(state)) return "boosterWave";
}

function dualVisualForState(state: number, mode: number): "none" | "idle" | "use" {
  if (mode === 3 && state === 10) return "use";
  if (mode === 1 && [3, 4, 5].includes(state)) return "idle";
  return "none";
}

function boosterFolder(boosterType: string, kind: string): string | undefined {
  return boosterType === "dark" && kind === "boosterPlay" ? "8soon" : undefined;
}

function exactResource(library: EffectLibrary, path: string): EffectResource | undefined {
  const resources = library.exactCanonicalCandidates(path);
  if (resources.length > 1) throw new Error(`${path} source 不唯一。`);
  return resources[0];
}

function waveType(library: EffectLibrary, requested: string | undefined): string {
  const name = requested || defaultWave;
  const path = `effect/boosterWave/${name}.1s`;
  const matches = library.exactCanonicalCandidates(path);
  if (matches.length > 1) throw new Error(`${path} source 不唯一。`);
  if (matches.length === 1) return name;
  const fallback = `effect/boosterWave/${defaultWave}.1s`;
  if (library.exactCanonicalCandidates(fallback).length !== 1)
    throw new Error(`${fallback} source 不唯一或缺失。`);
  return defaultWave;
}

function exceedFromTable(root: EffectXmlNode, id: number, fallback: string,
  deps: BoosterEffectDependencies): string {
  if (id === 0) return fallback;
  const list = deps.xmlChild(root, "exceedTypeList");
  if (!list) throw new Error("exceedTypeChange 缺少 exceedTypeList。");
  const matches = list.children.filter(entry => entry.name === "exceedType" &&
    Number(deps.xmlAttribute(entry, "id")) === id);
  if (matches.length === 0) return fallback;
  if (matches.length !== 1)
    throw new Error(`defaultExceedType ${id} 在当前中国服表中不唯一。`);
  const type = deps.xmlAttribute(matches[0]!, "exceedWaveType");
  if (!type) throw new Error(`defaultExceedType ${id} 缺少 exceedWaveType。`);
  return type;
}

async function exceedWaveType(library: EffectLibrary, vehicle: EffectVehicle,
  deps: BoosterEffectDependencies): Promise<string> {
  if (vehicle.defaultExceedType === 0) return vehicle.exceedWaveType;
  const matches = library.exactCanonicalCandidates(exceedTablePath);
  if (matches.length !== 1)
    throw new Error(`${exceedTablePath} source 不唯一或缺失。`);
  const root = deps.parseXml(await matches[0]!.bytes()).root;
  if (root.name !== "exceedType")
    throw new Error(`${exceedTablePath} 根节点不是 exceedType。`);
  return exceedFromTable(root, vehicle.defaultExceedType, vehicle.exceedWaveType, deps);
}

function decodeWaveScene(bytes: Uint8Array, deps: BoosterEffectDependencies): ParsedEffectScene {
  const parsed = deps.decodeScene(bytes);
  const root = parsed.root.kind === "track" ? parsed.root.scene! : parsed.root;
  root.scale = root.scale!.map(value => Math.fround(value * Math.fround(1.2)));
  return parsed;
}

export class KartBoosterEffectHost {
  state = 0;
  dualMode = 0;
  dualVisual: "none" | "idle" | "use" = "none";
  dualFlavor: "solo" | "team" = "solo";
  exceedActive = false;
  readonly hasTeamDual: boolean;

  constructor(readonly instances: BoosterInstance[], readonly kartRoot: EffectObject,
    readonly textureCache: Map<unknown, { dispose(): void }> = new Map(),
    readonly presentation = "driving",
    readonly sharedSources?: KartBoosterSharedSources,
    readonly dependencies?: BoosterEffectDependencies) {
    this.hasTeamDual = instances.some(({ kind }) => kind === "boosterDualTeam");
  }

  static async load(library: EffectLibrary, vehicle: EffectVehicle, engineGrade: number,
    kart: EffectSceneBinding, environment: unknown, stageBinding: unknown,
    presentation = "driving", allowed?: Set<string>, sharedSources?: KartBoosterSharedSources,
    deps?: BoosterEffectDependencies): Promise<KartBoosterEffectHost> {
    if (!deps) throw new Error("Kart booster effect dependencies missing.");
    const instances: BoosterInstance[] = [];
    const parsed = sharedSources ? sharedSources.parsedScenes : new Map<string, ParsedEffectScene>();
    const textures = sharedSources ? sharedSources.textureCache :
      new Map<unknown, { dispose(): void }>();
    sharedSources?.retain();
    try {
      const loadScene = async (resource: EffectResource, identity: { id: string; folder?: string },
        resizeWave: boolean) => {
        let decoded = parsed.get(resource.virtualPath);
        if (decoded === undefined) {
          decoded = resizeWave
            ? decodeWaveScene(await resource.bytes(), deps)
            : deps.decodeScene(await resource.bytes());
          parsed.set(resource.virtualPath, decoded);
        }
        const scene = await deps.buildScene(decoded, library, resource.virtualPath, identity, {
          environment, stageBinding, advanceEnvironment: false,
          convertClientCoordinates: false, textureCache: textures,
        });
        scene.pruneWorldMatrixRecursion?.();
        return scene;
      };
      const driving = presentation === "driving";
      const families = driving ? ["booster", "boosterFlare"] : ["booster"];
      const exceed = driving && engineGrade >= 7 && engineGrade <= 9
        ? await exceedWaveType(library, vehicle, deps) : "";
      const standardWave = driving ? waveType(library, vehicle.boosterWaveType) : "";
      const driftWave = driving ? waveType(library, vehicle.driftBoostEffectType) : "";

      for (let index = 0; index < vehicle.boosterTypes.length; index++) {
        const booster = vehicle.boosterTypes[index];
        if (!booster) continue;
        const attachment = kart.nodes.get(vehicle.attachments[index]!)?.object;
        if (!attachment) continue;
        for (const kind of ["booster", "boosterTeam", "boosterPlay"]) {
          if (allowed && !allowed.has(kind)) continue;
          for (const family of families) {
            const path = `effect/${family}/${booster}/${kind}.1s`;
            const resource = exactResource(library, path);
            if (!resource) continue;
            const scene = await loadScene(resource,
              { id: `effect:${family}:${booster}`, folder: boosterFolder(booster, kind) }, true);
            scene.object.visible = false;
            attachment.add(scene.object);
            instances.push({ kind, scene, family });
          }
        }
        if (engineGrade > 6) {
          const variants: Array<[string, string[]]> = [
            ["boosterDualIdle", ["boosterDualIdle_S", "boosterDualIdle"]],
            ["boosterDual", ["boosterDual_S", "boosterDual"]],
            ["boosterDualIdleTeam", ["boosterDualIdle_T"]],
            ["boosterDualTeam", ["boosterDual_T"]],
          ];
          for (const [kind, names] of variants) {
            if (allowed && !allowed.has(kind)) continue;
            const candidates = engineGrade === 8 || engineGrade === 9 ? names
              : names.filter(name => !name.endsWith("_S") && !name.endsWith("_T"));
            for (const family of families) {
              const selected = candidates.map(name => `effect/${family}/${booster}/${name}.1s`)
                .map(path => [path, library.exactCanonicalCandidates(path)] as const)
                .find(([, matches]) => matches.length > 0);
              if (!selected) continue;
              const [path, matches] = selected;
              if (matches.length > 1) throw new Error(`${path} source 不唯一。`);
              const scene = await loadScene(matches[0]!,
                { id: `effect:${family}:${booster}:${kind}` }, true);
              scene.object.visible = false;
              attachment.add(scene.object);
              instances.push({ kind, scene, family });
            }
          }
        }
      }

      const waves: Array<[string, string]> = driving ? [
        ["baseBoosterWave", defaultWave], ["boosterWave", standardWave],
        ["driftBoostWave", driftWave], ["exceedWave", exceed],
      ] : [];
      for (const [kind, wave] of waves) {
        if (!wave || (allowed && !allowed.has(kind))) continue;
        const path = `effect/boosterWave/${wave}.1s`;
        const resource = exactResource(library, path);
        if (!resource) continue;
        const scene = await loadScene(resource, { id: `effect:boosterWave:${wave}` }, false);
        scene.object.visible = false;
        instances.push({ kind, scene });
      }
      return new this(instances, kart.object, textures, presentation, sharedSources, deps);
    } catch (error) {
      instances.forEach(({ scene }) => scene.dispose());
      if (sharedSources) sharedSources.release();
      else textures.forEach(texture => texture.dispose());
      throw error;
    }
  }

  syncRootScene(instance: BoosterInstance, active: boolean, restart: boolean, time: number): void {
    if (!active || restart) this.detachRootScene(instance, time);
    if (active && instance.scene.object.parent !== this.kartRoot)
      this.kartRoot.add(instance.scene.object);
  }

  detachRootScene(instance: BoosterInstance, time: number): void {
    if (instance.scene.object.parent === this.kartRoot) {
      if (instance.kind === "exceedWave") instance.scene.stopControllers?.(time);
      instance.scene.object.removeFromParent();
    }
  }

  restartGaragePreview(time: number): void {
    if (this.presentation !== "garage-preview") return;
    this.instances.forEach(instance => {
      instance.scene.stopControllers?.(time);
      instance.scene.object.visible = false;
      if (instance.scene.object.parent === this.kartRoot)
        instance.scene.object.removeFromParent();
    });
    this.state = 0;
    this.dualMode = 0;
    this.dualVisual = "none";
    this.dualFlavor = "solo";
    this.exceedActive = false;
  }

  setState(state: number, dualMode: number, team: boolean,
    exceedActive: boolean, time: number): boolean {
    const changedState = state !== this.state;
    if (!changedState && dualMode === this.dualMode && exceedActive === this.exceedActive)
      return false;
    const previousExceed = this.exceedActive;
    const changedDual = this.updateDualVisual(state, dualMode, team, changedState);
    this.state = state;
    this.dualMode = dualMode;
    this.exceedActive = exceedActive;
    this.instances.forEach(instance => this.syncInstance(instance, changedDual, previousExceed, time));
    return changedState && this.dualVisual === "use" &&
      this.instances.some(instance => instance.kind === dualEffectKind.use[this.dualFlavor] &&
        instance.family === "booster");
  }

  updateDualVisual(state: number, mode: number, team: boolean,
    changedState: boolean): boolean {
    const visual = dualVisualForState(state, mode);
    const flavor = team && this.hasTeamDual ? "team" : "solo";
    const refreshIdle = visual === "idle" && this.dualMode !== 1;
    if (changedState || refreshIdle) {
      this.dualVisual = visual;
      this.dualFlavor = flavor;
    }
    return changedState || refreshIdle;
  }

  isEffectActive(kind: string): boolean {
    if (kind === "exceedWave") return this.exceedActive;
    if (kind === waveKindForState(this.state) ||
      (this.presentation === "driving" && kind === "baseBoosterWave" &&
        this.dualVisual === "use")) return true;
    if (this.dualVisual !== "none")
      return kind === dualEffectKind[this.dualVisual][this.dualFlavor];
    return kind === boosterKindForState(this.state);
  }

  syncInstance(instance: BoosterInstance, changedDual: boolean,
    previousExceed: boolean, time: number): void {
    const active = this.isEffectActive(instance.kind);
    if (instance.kind === "exceedWave")
      this.syncRootScene(instance, active, this.exceedActive !== previousExceed, time);
    else if (["baseBoosterWave", "boosterWave", "driftBoostWave"].includes(instance.kind))
      this.syncRootScene(instance, active, changedDual, time);
    instance.scene.object.visible = active;
    const restart = instance.kind === "exceedWave" ? !previousExceed : changedDual;
    if (active && restart) instance.scene.reset(time);
  }

  update(time: number, delta: number, camera: unknown, renderer: unknown): void {
    this.instances.forEach(({ scene }) => {
      if (scene.object.visible) scene.update(time, delta, camera, renderer);
    });
  }

  warmDetachedScenes(root: unknown, time: number): void {
    for (const { scene } of this.instances)
      if (!scene.object.parent) this.dependencies?.warmDetachedScene(root, scene.object, time, true);
  }

  dispose(): void {
    this.instances.forEach(({ scene }) => {
      scene.object.removeFromParent();
      scene.dispose();
    });
    if (this.sharedSources) this.sharedSources.release();
    else this.textureCache.forEach(texture => texture.dispose());
  }

  censusEffectRoots(): Array<{ name: string; root: EffectObject }> {
    return this.instances.map((instance, index) => ({
      name: `${instance.family ?? "wave"}/${instance.kind}#${index}`,
      root: instance.scene.object,
    }));
  }
}
