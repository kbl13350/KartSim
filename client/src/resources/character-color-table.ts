import { parseResourceXml, type ResourceXmlNode } from "./xml-utf16-parser";

export interface CharacterColorPair {
  primary: number;
  high: number;
}

interface ColorTableCandidate { bytes(): Promise<Uint8Array>; }
export interface ColorTableArchive {
  exactCanonicalCandidates(path: string): ColorTableCandidate[];
}

function attribute(node: ResourceXmlNode, name: string): string | undefined {
  return node.attributes.find(entry => entry.name === name)?.value;
}

function requiredAttribute(node: ResourceXmlNode, name: string): string {
  const value = attribute(node, name);
  if (value === undefined || value === "")
    throw new Error(`itemTable ${node.name}.${name} 缺失。`);
  return value;
}

function idAttribute(node: ResourceXmlNode, name: string): number {
  const value = requiredAttribute(node, name);
  if (!/^\d+$/.test(value))
    throw new Error(`itemTable ${node.name}.${name} 不是非负整数。`);
  return Number(value);
}

function argb(value: string): number {
  const parts = value.trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some(part =>
    !Number.isInteger(part) || part < 0 || part > 255))
    throw new Error(`itemTable color ${value} 不是 A R G B bytes。`);
  const [alpha, red, green, blue] = parts;
  return ((alpha! << 24) | (red! << 16) | (green! << 8) | blue!) >>> 0;
}

function characterIds(root: ResourceXmlNode): Map<string, number> {
  const result = new Map<string, number>();
  for (const child of root.children.filter(node => node.name === "character")) {
    const name = requiredAttribute(child, "name").toLowerCase();
    const colorId = idAttribute(child, "orgColorId");
    const previous = result.get(name);
    if (previous !== undefined && previous !== colorId)
      throw new Error(`itemTable character ${name} 的 orgColorId ${previous}/${colorId} 冲突。`);
    result.set(name, colorId);
  }
  return result;
}

function addColor(node: ResourceXmlNode,
  target: Map<number, CharacterColorPair>): void {
  const id = idAttribute(node, "id");
  if (target.has(id)) throw new Error(`itemTable ${node.name} ${id} 重复。`);
  target.set(id, {
    primary: argb(requiredAttribute(node, "base")),
    high: argb(requiredAttribute(node, "high")),
  });
}

/** Character and rider paint colors parsed from etc_/itemTable.kml. */
export class CharacterColorTable {
  constructor(readonly characterColorIds: Map<string, number>,
    readonly colors: Map<number, CharacterColorPair>,
    readonly riderColors: Map<number, CharacterColorPair>,
    readonly uniformNames: Set<string>,
    readonly dyeRankColors: Map<number, number>) {}

  static parse<T extends CharacterColorTable>(this: new (
    characterColorIds: Map<string, number>,
    colors: Map<number, CharacterColorPair>,
    riderColors: Map<number, CharacterColorPair>,
    uniformNames: Set<string>, dyeRankColors: Map<number, number>) => T,
    bytes: Uint8Array): T {
    const root = parseResourceXml(bytes).root;
    if (root.name !== "itemtable")
      throw new Error(`character color table root ${root.name} 不是 itemtable。`);
    const ids = characterIds(root);
    const colors = new Map<number, CharacterColorPair>();
    const riderColors = new Map<number, CharacterColorPair>();
    const uniformNames = new Set<string>();
    const dyeRankColors = new Map<number, number>();
    for (const child of root.children) {
      if (child.name === "color") addColor(child, colors);
      else if (child.name === "dye") {
        addColor(child, riderColors);
        const rank = attribute(child, "rank");
        if (rank !== undefined) dyeRankColors.set(idAttribute(child, "id"), argb(rank));
      } else if (child.name === "uniform") {
        uniformNames.add(requiredAttribute(child, "name").toLowerCase());
      }
    }
    return new this(ids, colors, riderColors, uniformNames, dyeRankColors);
  }

  resolveDyeRankColor(id: number): number {
    const color = this.dyeRankColors.get(id);
    if (color === undefined)
      throw new Error(`itemTable 缺少 dye ${id} 的 rank 颜色。`);
    return color;
  }

  resolve(character: string): CharacterColorPair {
    const color = this.tryResolve(character);
    if (color) return color;
    const normalized = character.replace(/^character_/i, "")
      .replace(/\.rho$/i, "").toLowerCase();
    throw new Error(`itemTable 缺少 character ${normalized}。`);
  }

  tryResolve(character: string): CharacterColorPair | undefined {
    const normalized = character.replace(/^character_/i, "")
      .replace(/\.rho$/i, "").toLowerCase();
    const id = this.characterColorIds.get(normalized);
    if (id === undefined) return undefined;
    const color = this.riderColors.get(id);
    if (!color)
      throw new Error(`itemTable character ${normalized} 引用缺失 dye ${id}。`);
    return color;
  }

  tryResolveColor(id: number, type = 2): CharacterColorPair | undefined {
    return (type === 2 ? this.colors : this.riderColors).get(id);
  }

  resolveColor(id: number, type = 2): CharacterColorPair {
    const color = this.tryResolveColor(id, type);
    if (!color)
      throw new Error(`itemTable 缺少 ${type === 2 ? "color" : "dye"} ${id}。`);
    return color;
  }
}

export async function loadCharacterColorTable<T extends CharacterColorTable>(
  archive: ColorTableArchive, Table: typeof CharacterColorTable = CharacterColorTable):
  Promise<T> {
  const candidates = archive.exactCanonicalCandidates("etc_/itemTable.kml");
  if (candidates.length !== 1)
    throw new Error(`etc_/itemTable.kml source 数量必须为 1，实际 ${candidates.length}。`);
  return Table.parse(await candidates[0]!.bytes()) as T;
}
