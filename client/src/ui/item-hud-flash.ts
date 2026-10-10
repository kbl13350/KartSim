/**
 * The XUN start item's slot flash (ITEM_MODE.md C.3): when the item a 迅
 * engine item kart starts with reaches slot 0, item/slot/
 * 12thEngineEffect_Big.bml plays its Play1SPanel (`차져슬롯이펙트_big.1s`,
 * camera at −5.25, 1000 ms) over the current slot. The authored panel has
 * no window rect (the native stage placed it on the slot), so the HUD puts
 * it on the current slot's rect; _Normal (camera −5.0) is the reserve slot's
 * variant and is not needed for a start item, which always lands in slot 0.
 */

import type { HudNode, HudRect } from "./item-hud-assets";
import { aimCloudCamera, type CloudPlayBinding, type CloudPlayRuntime, type CloudRenderer,
  type ItemHudCloudDependencies } from "./item-hud-cloud";

const slotFolder = "item/slot";

/** The panel on `rect` (stage pixels), visible from the binding's point of view. */
function placedPanel(node: HudNode, rect: HudRect): HudNode {
  const attributes = node.attributes.filter(entry => entry.name !== "align" && entry.name !== "windowRect");
  attributes.push({ name: "windowRect",
    value: `${Math.round(rect.left)} ${Math.round(rect.top)} ${Math.round(rect.right)} ${Math.round(rect.bottom)}` });
  return { ...node, attributes };
}

export class ItemHudSlotFlash {
  /** The flash on screen: its start tick; undefined when idle. */
  playingFrom?: number;
  /** The last `startItemFlash` it played for. */
  playedFor?: number;
  private disposed = false;

  constructor(readonly root: HudNode, readonly tree: unknown, readonly binding: CloudPlayBinding,
    readonly runtime: CloudPlayRuntime, readonly durationMs: number, readonly renderer: CloudRenderer,
    readonly dependencies: ItemHudCloudDependencies) {}

  static async load(library: unknown, deps: ItemHudCloudDependencies, rect: HudRect,
    tick = 0): Promise<ItemHudSlotFlash> {
    const panel = deps.parseBml(await deps.findResource(library, [slotFolder], "12thEngineEffect_Big",
      ".bml").bytes());
    if (panel.name !== "Play1SPanel") throw new Error("12thEngineEffect_Big 不是 Play1SPanel。");
    // Played on demand: the authored `stop="false"` would start it at load.
    const node = placedPanel({ ...panel, attributes: panel.attributes.map(entry =>
      entry.name === "stop" ? { name: "stop", value: "true" } : entry) }, rect);
    const root: HudNode = { name: "Container", attributes: [{ name: "windowRect", value: "0 0 1600 900" }],
      children: [node] };
    const [binding] = await deps.collectPlayPanels(root, async scene => {
      const file = deps.findResource(library, [slotFolder], scene, ".1s");
      return { scene: deps.parseModel(await file.bytes()),
        canonicalPath: file.canonicalPath ?? file.virtualPath ?? `${slotFolder}/${scene}.1s` };
    });
    if (!binding) throw new Error("12thEngineEffect_Big 缺少 Play1SPanel。");
    const camera = deps.createCamera();
    aimCloudCamera(camera, binding);
    const scene = await deps.loadPlayScene(binding, library) as { update(time: number, camera?: unknown): void };
    const runtime = deps.createPlayRuntime(binding, new Proxy(scene, {
      get(target, key) {
        if (key === "update") return (time: number) => target.update(time, camera);
        return Reflect.get(target, key, target);
      },
    }), tick);
    const runtimes = new Map<unknown, CloudPlayRuntime>([[binding.node, runtime]]);
    return new ItemHudSlotFlash(root, deps.makeUi(root, new Map()), binding, runtime,
      deps.controllerDuration(binding.scene), deps.createRenderer(runtimes), deps);
  }

  /** Plays once for each new `startItemFlash` time, from that time on. */
  update(atMs: number | undefined, tick: number): void {
    if (this.disposed) return;
    tick = Math.trunc(tick) >>> 0;
    if (atMs !== undefined && atMs !== this.playedFor && tick >= atMs && tick < atMs + this.durationMs) {
      this.playedFor = atMs;
      this.playingFrom = tick;
      this.runtime.play(this.durationMs, 0, tick);
    }
    if (this.playingFrom !== undefined && tick - this.playingFrom >= this.durationMs) {
      this.runtime.stop();
      this.playingFrom = undefined;
    }
    if (this.playingFrom === undefined) {
      this.renderer.update([], tick);
      return;
    }
    const commands = this.dependencies.finalizePlay(this.dependencies.materialize(
      this.dependencies.layoutUi(this.tree, 1600, 900, {
        visibility: node => node.name === "Play1SPanel" ? true : undefined,
      }), new Map()), [this.binding]);
    this.renderer.update(commands, tick);
  }

  render(renderer: unknown, width: number, height: number): void {
    if (!this.disposed && this.playingFrom !== undefined) this.renderer.render(renderer, width, height);
  }

  reset(): void {
    if (this.playingFrom !== undefined) this.runtime.stop();
    this.playingFrom = undefined;
    this.playedFor = undefined;
    this.renderer.update([], 0);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.dispose();
  }
}
