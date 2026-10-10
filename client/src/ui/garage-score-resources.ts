import type { GarageScoreXmlNode } from "./garage-score-data";

export type GarageScoreXmlAttribute = (node: GarageScoreXmlNode,
  name: string) => string | undefined;

export interface GarageWeightRow {
  values: number[];
  fallback: number;
}

export interface GarageWeightTable {
  kind: string;
  rows: Map<string, GarageWeightRow>;
}

export interface GarageScoreResourceLibrary {
  exactCanonicalCandidates(path: string): Array<{ bytes(): Promise<Uint8Array> }>;
}

export interface GarageScoreResourceDependencies {
  attribute: GarageScoreXmlAttribute;
  scoreFields: readonly string[];
  weightLengths: Record<string, readonly number[]>;
  partScoreFields: Map<number, string>;
  parseNumber(value: string): number;
  projectPartScore(field: string, value: number,
    table: GarageWeightTable): number;
  scoreInteger(value: number): number;
  abilityDescriptions: readonly { id: number }[];
  abilityFields: Record<string, string>;
  zeroAbilityScore(): Record<string, number>;
}

/** Decode native Factory ability deltas for each authored tuning choice. */
export function parseGarageFactoryAbilityScores(root: GarageScoreXmlNode,
  dependencies: GarageScoreResourceDependencies):
  Map<number, Record<string, number>> {
  if (root.name !== "TuneAbilityList")
    throw new Error("改装评分资源根节点无效。");
  const attribute = dependencies.attribute;
  const scores = new Map<number, Record<string, number>>();
  for (const { id } of dependencies.abilityDescriptions) {
    const groups = root.children.filter(node => node.name === "TuneGroup" &&
      attribute(node, "id") === String(Math.floor(id / 100)));
    if (groups.length !== 1) throw new Error(`改装评分组 ${id} 缺失或重复。`);
    const tunes = groups[0]!.children.filter(node => node.name === "Tune" &&
      attribute(node, "id") === String(id % 100));
    if (tunes.length !== 1 || tunes[0]!.children.length !== 1)
      throw new Error(`改装评分效果 ${id} 缺失或重复。`);
    const effect = tunes[0]!.children[0]!;
    if (effect.name !== "EnchanterAddSpec" ||
      effect.children.some(child => child.name !== "UiValue"))
      throw new Error("改装评分遇到未核实的增强类型或展示投影。");
    const score = dependencies.zeroAbilityScore();
    for (const field of Object.keys(dependencies.abilityFields)) {
      const source = attribute(effect, dependencies.abilityFields[field]!) ?? "0";
      const value = Math.fround(Number(source));
      if (!source.trim() || !Number.isFinite(value))
        throw new Error("改装评分属性值无效。");
      score[field] = value;
    }
    scores.set(id, score);
  }
  return scores;
}

/** Read score weights for the selected X/V1, Xun body or Xun part model. */
export function parseGarageWeightTable(root: GarageScoreXmlNode,
  kind: string, dependencies: GarageScoreResourceDependencies):
  GarageWeightTable {
  if (root.name !== "partsConst")
    throw new Error("车库评分资源根节点无效。");
  const groups = root.children.filter(node => node.name === "weightConst");
  if (groups.length !== 1)
    throw new Error("车库评分权重组缺失或重复。");
  const sectionName = kind === "x-v1" ? "weight" :
    kind === "xun-body" ? "weightKart" : "weightParts";
  const rows = new Map<string, GarageWeightRow>();
  dependencies.scoreFields.forEach((field, index) => {
    const matches = groups[0]!.children.filter(node =>
      node.name === sectionName && dependencies.attribute(node, "name") === field);
    if (matches.length !== 1)
      throw new Error(`车库评分权重缺失或重复：${field}。`);
    const values = (dependencies.attribute(matches[0]!, "value") ?? "")
      .split(",").map(dependencies.parseNumber);
    if (values.length !== dependencies.weightLengths[kind]?.[index])
      throw new Error(`车库评分权重长度无效：${field}。`);
    if (field === "DriftEscapeForce" && values[0] === 0)
      throw new Error("车库评分分母为零。");
    rows.set(field, {
      values,
      fallback: dependencies.parseNumber(
        dependencies.attribute(matches[0]!, "default") ?? "0"),
    });
  });
  return { kind, rows };
}

/** Convert native Xun part IDs and values through the part weight table. */
export function parseGarageXunPartValues(root: GarageScoreXmlNode,
  table: GarageWeightTable, dependencies: GarageScoreResourceDependencies):
  Array<{ category: number; itemId: number; field: string; score: number }> {
  if (table.kind !== "xun-parts")
    throw new Error("迅部件评分必须使用部件权重。");
  const groups = root.children.filter(node => node.name === "partsValue");
  if (groups.length !== 1)
    throw new Error("迅部件数值组缺失或重复。");
  const seen = new Set<string>();
  return groups[0]!.children.filter(node => node.name === "parts").map(node => {
    const category = dependencies.parseNumber(
      dependencies.attribute(node, "partsCatId") ?? "");
    const itemId = dependencies.parseNumber(
      dependencies.attribute(node, "partsItemId") ?? "");
    const field = dependencies.partScoreFields.get(category);
    const key = `${category}:${itemId}`;
    if (!field || !Number.isInteger(itemId) || itemId < 0 ||
        itemId > 65_535 || seen.has(key))
      throw new Error(`迅部件编号无效或重复：${key}。`);
    seen.add(key);
    const value = dependencies.parseNumber(
      dependencies.attribute(node, "value") ?? "");
    const score = dependencies.scoreInteger(
      dependencies.projectPartScore(field, value, table));
    return { category, itemId, field, score };
  });
}

export interface GarageScoreSourceDependencies extends GarageScoreResourceDependencies {
  cache: WeakMap<object, Map<string, Promise<GarageScoreSourceData>>>;
  parseXml(bytes: Uint8Array): { root: GarageScoreXmlNode };
  parseWeights(root: GarageScoreXmlNode, kind: string): GarageWeightTable;
  parseParts(root: GarageScoreXmlNode, table: GarageWeightTable):
    ReturnType<typeof parseGarageXunPartValues>;
  parseGradeGrid(root: GarageScoreXmlNode): unknown;
  loadSkills(library: GarageScoreResourceLibrary): Promise<unknown>;
  loadFactory(library: GarageScoreResourceLibrary): Promise<unknown>;
  loadVehicle(library: GarageScoreResourceLibrary,
    vehicle: unknown): Promise<{ value: { body: unknown } }>;
  normalizeBody(body: unknown): unknown;
}

export interface GarageScoreSourceData {
  table: GarageWeightTable;
  parts: ReturnType<typeof parseGarageXunPartValues>;
  grid: unknown;
  skills: unknown;
  factory: unknown;
}

/** Cache parsed score XML per library and grade family while loading vehicle data. */
export async function loadGarageScoreSource(
  library: GarageScoreResourceLibrary,
  vehicle: unknown,
  kind: string,
  dependencies: GarageScoreSourceDependencies,
): Promise<GarageScoreSourceData & { input: unknown }> {
  let byKind = dependencies.cache.get(library);
  if (!byKind) {
    byKind = new Map();
    dependencies.cache.set(library, byKind);
  }
  let resource = byKind.get(kind);
  if (!resource) {
    resource = (async () => {
      const path = `zeta_/cn/${kind === "x-v1" ? "parts" : "engine"}/partsConst.xml`;
      const candidates = library.exactCanonicalCandidates(path);
      if (candidates.length !== 1)
        throw new Error("车库评分资源缺失或不唯一。");
      const root = dependencies.parseXml(await candidates[0]!.bytes()).root;
      return {
        table: dependencies.parseWeights(root, kind),
        parts: kind === "x-v1" ? [] : dependencies.parseParts(root,
          dependencies.parseWeights(root, "xun-parts")),
        grid: kind === "x-v1" ? dependencies.parseGradeGrid(root) : undefined,
        skills: kind === "xun-body" ? await dependencies.loadSkills(library) :
          undefined,
        factory: kind === "x-v1" ? await dependencies.loadFactory(library) :
          undefined,
      };
    })();
    byKind.set(kind, resource);
    resource.catch(() => byKind!.delete(kind));
  }
  const [vehicleData, scoreData] = await Promise.all([
    dependencies.loadVehicle(library, vehicle), resource,
  ]);
  return { ...scoreData, input: dependencies.normalizeBody(vehicleData.value.body) };
}
