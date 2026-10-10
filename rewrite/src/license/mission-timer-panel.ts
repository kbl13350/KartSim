import type { WebGLRenderer } from "three";
import { T, d5, dn, dt, p2, s2 } from "../generated/formats.js";
import { U1, fn } from "../generated/library.js";
import { MISSION_TIMER_WARN_MS, missionTimerDigits } from "./license-race";

/**
 * stage_speedIndiGame missionTimer.bml: the time a 驾照考试 step has left,
 * "00:00:00" at the top of the race (lefttimeinfo; the red lefttimered set
 * for the last ten seconds). RiderSchoolSpeedStage / ItemStage include it in
 * their ScreenUI. Drawn with the race HUD's overlay renderer (1600×900).
 */

interface Node { name: string; attributes: Array<{ name: string; value: string }>; children: Node[] }
interface ResourceFile { bytes(): Promise<Uint8Array> }
export interface MissionTimerLibrary { canonicalCandidates(path: string): ResourceFile[] }

const TEXTURE_ROOTS = ["zeta_/cn/stage/common", "stage_/common", "stage_/speedIndiGame"];

function find(root: Node, test: (node: Node) => boolean): Node[] {
  const hits: Node[] = [];
  const stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (test(node)) hits.push(node);
    stack.push(...node.children);
  }
  return hits;
}

function one(root: Node, name: string): Node {
  const hits = find(root, node => T(node, "name") === name);
  if (hits.length !== 1) throw new Error(`missionTimer ${name} 数量必须为 1，实际 ${hits.length}。`);
  return hits[0]!;
}

export class MissionTimerPanel {
  private remaining?: number;
  private readonly overlay = new fn(new Map());

  private constructor(private readonly tree: unknown, private readonly window: Node,
    private readonly normal: Node, private readonly red: Node,
    private readonly digits: Map<Node, number>, private readonly textures: Map<string, unknown>) {}

  static async load(library: MissionTimerLibrary): Promise<MissionTimerPanel> {
    const window = s2(await (U1(library, ["stage_/speedIndiGame"], "missionTimer", ".bml") as
      ResourceFile).bytes()) as Node;
    const normal = one(window, "lefttime");
    const red = one(window, "lefttimered");
    const digits = new Map<Node, number>();
    for (const group of [normal, red])
      ["min", "sec", "mil"].forEach((name, index) => digits.set(one(group, name), index));
    const names = new Set(find(window, node => !!T(node, "texture")).map(node => T(node, "texture") as string));
    const textures = new Map(await Promise.all([...names].sort().map(async name =>
      [name, await p2(await (U1(library, TEXTURE_ROOTS, name) as ResourceFile).bytes())] as const)));
    return new MissionTimerPanel(d5(window, textures), window, normal, red, digits, textures);
  }

  /** Milliseconds left, or undefined to hide the timer. */
  set(remainingMs: number | undefined): void {
    this.remaining = remainingMs;
  }

  reset(): void {
    this.remaining = undefined;
    this.overlay.update([], 0);
  }

  render(renderer: WebGLRenderer, nowMs: number, width: number, height: number): void {
    const remaining = this.remaining;
    if (remaining === undefined) return;
    const text = missionTimerDigits(remaining);
    const warn = remaining <= MISSION_TIMER_WARN_MS;
    const commands = dt(dn(this.tree, width, height, {
      visibility: (node: Node) => node === this.normal ? !warn : node === this.red ? warn
        : node === this.window ? true : undefined,
      text: (node: Node) => {
        const index = this.digits.get(node);
        return index === undefined ? undefined : text[index];
      },
    }), this.textures, undefined);
    this.overlay.update(commands, Math.trunc(nowMs) >>> 0);
    this.overlay.render(renderer, width, height);
  }

  dispose(): void {
    this.reset();
    this.overlay.dispose();
  }
}
