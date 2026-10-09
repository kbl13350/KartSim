/**
 * The original lottery stage layouts read from the resource library at run
 * time: the BML windows (stage_/treasureHunt RouletteStage, stage_/gachaUse
 * GachaUseStage), their stage_stringBag (cn) and the art they draw. The
 * windows become DOM through the shop's BML widgets (shop-widgets BmlTree on
 * a ShopLayout of the 1080-high virtual screen).
 */
import { s2 } from "../generated/formats.js";
import { U1 } from "../generated/library.js";
import { layoutArt, loadLayoutArt, type ShopArt, type ShopArtLibrary } from "../shop/shop-assets";
import { attr, type ShopNode } from "../shop/shop-original";

interface ResourceFile { bytes(): Promise<Uint8Array> }

export interface LotteryLibrary extends ShopArtLibrary {
  canonicalCandidates(path: string): ResourceFile[];
}

export function isLotteryLibrary(library: unknown): library is LotteryLibrary {
  return typeof (library as Partial<LotteryLibrary> | undefined)?.canonicalCandidates === "function";
}

/** Resource folders of the treasure hunt (stage.bml addResFolder /stage/common/). */
export const TREASURE_ROOTS = ["stage_/treasureHunt", "stage_/common"] as const;
/** Resource folders of the 精品道具场. */
export const GACHA_ROOTS = ["stage_/gachaUse", "stage_/common"] as const;

async function bml(library: LotteryLibrary, roots: readonly string[], name: string): Promise<ShopNode> {
  const file = U1(library, [...roots], name, ".bml") as ResourceFile;
  return s2(await file.bytes()) as ShopNode;
}

/** A stage's cn strings (stage_stringBag: <k n><m c v/>…</k>), tw then kr where cn is empty. */
export async function loadStringBag(library: LotteryLibrary, roots: readonly string[]): Promise<Map<string, string>> {
  const root = await bml(library, roots, "stage_stringBag");
  const strings = new Map<string, string>();
  for (const key of root.children) {
    const name = attr(key, "n");
    if (!name) continue;
    const value = (["cn", "tw", "kr"] as const).map(locale =>
      key.children.find(entry => attr(entry, "c") === locale && attr(entry, "v"))).find(Boolean);
    const text = value ? attr(value, "v") : undefined;
    if (text) strings.set(name, text);
  }
  return strings;
}

/** Replaces #sb(key) references with the bag's strings (unknown keys keep their key). */
export function resolveStrings(node: ShopNode, strings: ReadonlyMap<string, string>): ShopNode {
  const attributes = node.attributes.map(entry => entry.value.includes("#sb(")
    ? { ...entry, value: entry.value.replace(/#sb\(([^)]+)\)/g, (_whole, key: string) => strings.get(key) ?? key) }
    : entry);
  return { ...node, attributes, children: node.children.map(child => resolveStrings(child, strings)) };
}

export interface LotteryStage {
  /** The stage window with #sb strings filled in. */
  window: ShopNode;
  /** Extra windows of the stage folder (cards, reward cells), by file name. */
  parts: Map<string, ShopNode>;
  strings: Map<string, string>;
}

/** Loads a stage window, its parts and its strings. */
export async function loadLotteryStage(library: LotteryLibrary, roots: readonly string[],
  window: string, parts: readonly string[] = []): Promise<LotteryStage> {
  const strings = await loadStringBag(library, roots);
  const [root, ...loaded] = await Promise.all([bml(library, roots, window),
    ...parts.map(name => bml(library, roots, name))]);
  return {
    window: resolveStrings(root!, strings),
    parts: new Map(parts.map((name, index) => [name, resolveStrings(loaded[index]!, strings)])),
    strings,
  };
}

/** The art of a stage's windows plus extra images, as CSS custom properties. */
export function loadStageArt(library: LotteryLibrary, roots: readonly string[], windows: readonly ShopNode[],
  extraImages: readonly string[] = []): Promise<ShopArt> {
  const art = layoutArt(windows);
  return loadLayoutArt(library, roots, [...art.images, ...extraImages], art.frames);
}

/** Every node named name, depth first. */
export function findAll(node: ShopNode, name: string, found: ShopNode[] = []): ShopNode[] {
  if (attr(node, "name") === name) found.push(node);
  for (const child of node.children) findAll(child, name, found);
  return found;
}

/** The first node named name inside the node named parent (or anywhere). */
export function findIn(node: ShopNode, name: string, parent?: string): ShopNode | undefined {
  const scope = parent ? findAll(node, parent)[0] : node;
  return scope ? findAll(scope, name)[0] : undefined;
}

/** A copy of node without the children skip rejects (recursively). */
export function prune(node: ShopNode, skip: (child: ShopNode) => boolean): ShopNode {
  return { ...node, children: node.children.filter(child => !skip(child)).map(child => prune(child, skip)) };
}

/** A copy of node with attribute changes on every node named name. */
export function patch(node: ShopNode, name: string, changes: Record<string, string | undefined>): ShopNode {
  let attributes = node.attributes;
  if (attr(node, "name") === name) {
    attributes = attributes.filter(entry => !(entry.name in changes));
    for (const [key, value] of Object.entries(changes)) if (value !== undefined) attributes.push({ name: key, value });
  }
  return { ...node, attributes, children: node.children.map(child => patch(child, name, changes)) };
}
