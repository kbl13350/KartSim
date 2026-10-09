import { T, lt, s2 } from "../generated/formats.js";

/**
 * The story mission result banner stage_snDriveGame lists, clear@zz from
 * stage_speedIndiGame action2d@cn (完成; KR 성공), which library.js hI() does
 * not build. The panel has the shape of library.js vt(), so the race's own
 * dI instance draws it via schedule().
 */

interface BmlNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: BmlNode[];
}
interface OverlayImage { pixels: Uint8Array; width: number; height: number }
interface ResourceFile { bytes(): Promise<Uint8Array> }
export interface ActionLibrary { canonicalCandidates(path: string): ResourceFile[] }

/** What dI.schedule(panel, atMs) draws (library.js vt() return value). */
export interface Action2DPanel {
  kind: "finish";
  node: BmlNode;
  geometry: unknown;
  textureName: string;
  texture: OverlayImage;
  timing: { fadeInMs: number; showMs: number; fadeOutMs: number };
  uv: { left: number; top: number; right: number; bottom: number };
}

const ACTION2D = "stage_/speedIndiGame/action2d@cn.bml";
const ATLAS_NAME = "2d_1S_통합@cn";

function only(library: ActionLibrary, path: string): ResourceFile {
  const found = library.canonicalCandidates(path);
  if (found.length !== 1) throw new Error(`${path} source 数量必须为 1，实际 ${found.length}。`);
  return found[0]!;
}

function named(root: BmlNode, name: string): BmlNode {
  const found: BmlNode[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (T(node, "name") === name) found.push(node);
    stack.push(...node.children);
  }
  if (found.length !== 1) throw new Error(`${name} node 数量必须为 1，实际 ${found.length}。`);
  return found[0]!;
}

function u32(node: BmlNode, name: string): number {
  const text = T(node, name);
  if (!text || !/^\d+$/.test(text) || Number(text) > 0xffffffff)
    throw new Error(`${node.name}.${name} 不是 u32。`);
  return Number(text);
}

/** vt() for one TonPanel ControlWindow; a leftTopTex panel shows its whole texture. */
export function buildActionPanel(root: BmlNode, name: string, texture: OverlayImage,
  textureName: string): Action2DPanel {
  const window = named(root, name);
  const node = window.children[0];
  if (window.name !== "ControlWindow" || T(window, "windowRect") !== "fullscreen" ||
      window.children.length !== 1 || !node || node.name !== "TonPanel")
    throw new Error(`${name} 不再是只含一个 TonPanel 的 fullscreen ControlWindow。`);
  const expected: Array<[string, string]> = [["texture", textureName], ["textureOp", "modulate"],
    ["color", "255 255 255 255"], ["alphaBlend", "true"], ["panelAnimPack", "pop"]];
  for (const [key, value] of expected)
    if (T(node, key) !== value) throw new Error(`${name} TonPanel.${key} 必须为 ${value}。`);
  let uv: Action2DPanel["uv"];
  const uvRect = T(node, "uvRect");
  if (uvRect !== undefined) {
    // library.js K00()
    const [l, t, r, b] = uvRect.trim().split(/\s+/).map(Number) as [number, number, number, number];
    if (!(Math.min(l, t, r - l, b - t) >= 0 && r <= texture.width && b <= texture.height))
      throw new Error(`${name} TonPanel.uvRect 超出 texture。`);
    const sx = Math.fround(1 / texture.width), sy = Math.fround(1 / texture.height);
    uv = { left: Math.fround(l * sx), top: Math.fround(t * sy),
      right: Math.fround(r * sx), bottom: Math.fround(b * sy) };
  } else {
    if (T(node, "leftTopTex") === undefined) throw new Error(`${name} 缺少 uvRect / leftTopTex。`);
    uv = { left: 0, top: 0, right: 1, bottom: 1 };
  }
  // windowSize panels ignore textureSize; leftTopTex panels take their size from it.
  const options = { textureSize: { width: texture.width, height: texture.height } };
  return {
    kind: "finish", node, geometry: lt(node, undefined, options), textureName, texture,
    timing: { fadeInMs: u32(window, "fadeInLength"), showMs: u32(window, "showLength"),
      fadeOutMs: u32(window, "fadeOutLength") },
    uv,
  };
}

/** clear@zz for the story mission result (retire@zz comes with hI(library, true)). */
export interface StoryResultPanels { clear: Action2DPanel }

/**
 * `atlas` is the 2d_1S_통합@cn image hI() already decoded (dI.definition.finish.texture),
 * so clear@zz shares the GPU texture with finish/retire/raceover/winner.
 */
export async function loadStoryResultPanels(library: ActionLibrary,
  atlas: OverlayImage): Promise<StoryResultPanels> {
  const root = s2(await only(library, ACTION2D).bytes()) as BmlNode;
  return { clear: buildActionPanel(root, "clear@zz", atlas, ATLAS_NAME) };
}
