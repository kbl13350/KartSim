import type { WebGLRenderer } from "three";
import { T, d5, dn, dt, p2, s2 } from "../generated/formats.js";
import { U1, fn } from "../generated/library.js";

/**
 * stage_snDriveGame mq_window@zz tracingPanel: "距离 [000] 米" at the top of
 * the race, the gap to the Tracing / Escape rival in metres. Drawn with the
 * same overlay renderer as the race HUD (library.js fn, 1600×900).
 */

interface Node { name: string; attributes: Array<{ name: string; value: string }>; children: Node[] }
interface ResourceFile { bytes(): Promise<Uint8Array> }
export interface ChasePanelLibrary { canonicalCandidates(path: string): ResourceFile[] }

/** stage.bml monocoque addResFolder, the CN overlay first (sn_거리@cn reads 距离 … 米). */
const TEXTURE_ROOTS = ["zeta_/cn/stage/common", "stage_/common", "stage_/common/icon",
  "stage_/speedIndiGame", "stage_/itemIndiGame", "stage_/snDriveGame"];

function named(root: Node, name: string): Node {
  const hits: Node[] = [];
  const stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (T(node, "name") === name) hits.push(node);
    stack.push(...node.children);
  }
  if (hits.length !== 1) throw new Error(`snDriveGame ${name} 数量必须为 1，实际 ${hits.length}。`);
  return hits[0]!;
}

function textureNames(root: Node): string[] {
  const names = new Set<string>();
  const stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    const texture = T(node, "texture") as string | undefined;
    if (texture) names.add(texture);
    stack.push(...node.children);
  }
  return [...names].sort();
}

export class ChasePanel {
  private text?: string;
  private readonly overlay = new fn(new Map());

  private constructor(private readonly tree: unknown, private readonly panel: Node,
    private readonly digits: Node, private readonly textures: Map<string, unknown>) {}

  static async load(library: ChasePanelLibrary): Promise<ChasePanel> {
    const window = s2(await (U1(library, ["stage_/snDriveGame"], "mq_window@zz", ".bml") as
      ResourceFile).bytes()) as Node;
    // Only the panel's subtree: the fullscreen root does not lay out on its own.
    const panel = named(window, "tracingPanel");
    const digits = named(panel, "tracingLeft");
    const textures = new Map(await Promise.all(textureNames(panel).map(async name =>
      [name, await p2(await (U1(library, TEXTURE_ROOTS, name) as ResourceFile).bytes())] as const)));
    return new ChasePanel(d5(panel, textures), panel, digits, textures);
  }

  /** Metres to show, or undefined to hide the panel. */
  set(metres: number | undefined): void {
    this.text = metres === undefined ? undefined
      : String(Math.min(999, Math.max(0, Math.round(metres))));
  }

  reset(): void {
    this.text = undefined;
    this.overlay.update([], 0);
  }

  render(renderer: WebGLRenderer, nowMs: number, width: number, height: number): void {
    const text = this.text;
    if (text === undefined) return;
    const commands = dt(dn(this.tree, width, height, {
      // The release panel ships visible="false"; the stage turns it on.
      visibility: (node: Node) => node === this.panel ? true : undefined,
      text: (node: Node) => node === this.digits ? text : undefined,
    }), this.textures, undefined);
    this.overlay.update(commands, Math.trunc(nowMs) >>> 0);
    this.overlay.render(renderer, width, height);
  }

  dispose(): void {
    this.reset();
    this.overlay.dispose();
  }
}
