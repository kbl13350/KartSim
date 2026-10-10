import { RADAR_FIELDS, type GarageRadarWeights } from "./garage-radar-chart";

export interface GarageRadarXmlNode {
  name: string;
  children: GarageRadarXmlNode[];
}

export type GarageRadarAttribute = (node: GarageRadarXmlNode,
  name: string) => string | undefined;

const DESCRIPTORS = [
  "DescEngineGrade", "DescBalance", "DescStability", "DescEnchantCap",
  "DescCornering",
];
const UNKNOWN_SENTINEL_FIELDS = new Set([
  "DriftEscapeForce", "TransAccelFactor", "NormalBoosterTime", "DriftMaxGauge",
]);

function requiredFloat(node: GarageRadarXmlNode, key: string,
  attribute: GarageRadarAttribute, fallback?: number): number {
  const text = attribute(node, key);
  if (text === undefined && fallback !== undefined) return fallback;
  if (text === undefined || !text.trim())
    throw new Error(`车辆雷达缺少 ${key}。`);
  const value = Math.fround(Number(text));
  if (!Number.isFinite(value))
    throw new Error("车辆雷达参数不是有效有限数值。");
  return value;
}

/** Read all native vehicle parameters, including optional descriptors and sentinel values. */
export function parseGarageRadarInput(node: GarageRadarXmlNode,
  attribute: GarageRadarAttribute): Record<string, number> {
  const parameters = Object.entries(RADAR_FIELDS).map(([sourceName, fieldName]) => {
    const fallback = sourceName === "StartBoosterTimeSpeed" ?
      requiredFloat(node, "StartBoosterTime", attribute, 0) : 0;
    const value = requiredFloat(node, sourceName, attribute, fallback);
    return [fieldName,
      UNKNOWN_SENTINEL_FIELDS.has(sourceName) && value === -100_000 ? 0 : value];
  });
  return Object.fromEntries([...parameters,
    ...DESCRIPTORS.map(key => [key, requiredFloat(node, key, attribute, 0)])]);
}

/** Validate that weightConst contains exactly one complete row for every radar field. */
export function parseGarageRadarWeights(root: GarageRadarXmlNode,
  attribute: GarageRadarAttribute): Map<string, GarageRadarWeights> {
  if (root.name !== "weightConst")
    throw new Error("车辆雷达权重根节点无效。");
  const weights = new Map<string, GarageRadarWeights>();
  for (const key of Object.keys(RADAR_FIELDS)) {
    const rows = root.children.filter(node => node.name === "weight" &&
      attribute(node, "name") === key);
    if (rows.length !== 1)
      throw new Error(`车辆雷达权重缺失或重复：${key}。`);
    const row = rows[0]!;
    const weight = {
      enchantVariable: requiredFloat(row, "enchantVariable", attribute),
      generalWeight: requiredFloat(row, "generalWeight", attribute),
      enchantWeight: requiredFloat(row, "enchantWeight", attribute),
      publicCutDown: requiredFloat(row, "publicCutDown", attribute),
    };
    if (!weight.enchantVariable)
      throw new Error(`车辆雷达权重分母为零：${key}。`);
    weights.set(key, weight);
  }
  return weights;
}

export interface GarageRadarLibrary {
  exactCanonicalCandidates(path: string): Array<{ bytes(): Promise<Uint8Array> }>;
}

export interface GarageRadarParameterDependencies {
  attribute: GarageRadarAttribute;
  parseXml(bytes: Uint8Array): { root: GarageRadarXmlNode };
  loadVehicleParameters(library: GarageRadarLibrary,
    path: string): Promise<{ value: { body: GarageRadarXmlNode } }>;
}

export interface GarageRadarParameters {
  input: Record<string, number>;
  weights: Map<string, GarageRadarWeights>;
}

const vehicleParametersByLibrary = new WeakMap<GarageRadarLibrary,
  Map<string, Promise<GarageRadarParameters>>>();
const radarWeightsByLibrary = new WeakMap<GarageRadarLibrary,
  Promise<Map<string, GarageRadarWeights>>>();

/** Share weight XML across vehicles; evict failed loads so a later retry can succeed. */
export function loadGarageRadarParameters(library: GarageRadarLibrary,
  path: string, dependencies: GarageRadarParameterDependencies):
  Promise<GarageRadarParameters> {
  let vehicleCache = vehicleParametersByLibrary.get(library);
  if (!vehicleCache) {
    vehicleCache = new Map();
    vehicleParametersByLibrary.set(library, vehicleCache);
  }
  const cached = vehicleCache.get(path);
  if (cached) return cached;

  let weightPromise = radarWeightsByLibrary.get(library);
  if (!weightPromise) {
    weightPromise = (async () => {
      const candidates = library.exactCanonicalCandidates(
        "zeta_/cn/enchant/weightConst.xml");
      if (candidates.length !== 1)
        throw new Error("车辆雷达权重资源缺失或不唯一。");
      const xml = dependencies.parseXml(await candidates[0]!.bytes());
      return parseGarageRadarWeights(xml.root, dependencies.attribute);
    })();
    radarWeightsByLibrary.set(library, weightPromise);
    weightPromise.catch(() => radarWeightsByLibrary.delete(library));
  }
  const result = Promise.all([
    dependencies.loadVehicleParameters(library, path), weightPromise,
  ]).then(([vehicle, weights]) => ({
    input: parseGarageRadarInput(vehicle.value.body, dependencies.attribute),
    weights,
  }));
  vehicleCache.set(path, result);
  result.catch(() => vehicleCache.delete(path));
  return result;
}
