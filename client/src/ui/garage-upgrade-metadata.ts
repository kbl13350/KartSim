export interface GarageUpgradeXmlNode {
  name: string;
  children: GarageUpgradeXmlNode[];
}

export type GarageUpgradeAttribute = (node: GarageUpgradeXmlNode,
  name: string) => string | undefined;

export interface GarageTuneAbility {
  id: number;
  groupId: number;
  level: number;
  title: string;
  description: string;
}

/** Read the localized TuneAbility descriptions used by the garage skill picker. */
export function parseGarageTuneAbilities(root: GarageUpgradeXmlNode,
  attribute: GarageUpgradeAttribute): Map<number, GarageTuneAbility> {
  const abilities = new Map<number, GarageTuneAbility>();
  if (root.name !== "TuneAbility") return abilities;
  for (const node of root.children.filter(child => child.name === "Tune")) {
    const groupId = Number(attribute(node, "groupId"));
    const level = Number(attribute(node, "id"));
    if (!Number.isInteger(groupId) || groupId < 1 ||
        !Number.isInteger(level) || level < 1) continue;
    const id = groupId * 100 + level;
    abilities.set(id, {
      id, groupId, level,
      title: attribute(node, "name") ?? "",
      description: (attribute(node, "desc") ?? "")
        .replace(/\[\/?color(?::[^\]]+)?\]/g, ""),
    });
  }
  return abilities;
}

export interface GarageExceedType {
  id: number;
  textureType: number;
  accelLevel: number;
  timeLevel: number;
}

/** The source only accepts positive texture IDs and acceleration/time levels 1–3. */
export function parseGarageExceedTypes(root: GarageUpgradeXmlNode,
  attribute: GarageUpgradeAttribute): Map<number, GarageExceedType> {
  const types = new Map<number, GarageExceedType>();
  const list = root.children.find(child => child.name === "exceedTypeList");
  for (const node of list?.children.filter(child => child.name === "exceedType") ?? []) {
    const id = Number(attribute(node, "id"));
    const textureType = Number(attribute(node, "textureType"));
    const accelLevel = Number(attribute(node, "exceedAccel"));
    const timeLevel = Number(attribute(node, "exceedTime"));
    if ([id, textureType, accelLevel, timeLevel].every(Number.isInteger) &&
        id > 0 && textureType > 0 &&
        accelLevel >= 1 && accelLevel <= 3 &&
        timeLevel >= 1 && timeLevel <= 3)
      types.set(id, { id, textureType, accelLevel, timeLevel });
  }
  return types;
}

const QUALITY_BY_NAME = new Map([
  ["Unique", 4], ["Legend", 3], ["Rare", 5], ["Normal", 2],
  ["Special", 1], ["Ultimate", 6], ["Epic", 7],
]);

export interface GarageExceedChangeFee {
  quality: number;
  wrenchCount: number;
  lucci: number;
  ingredientQualities: Set<number>;
}

export interface GarageExceedChangeRules {
  types: Map<number, GarageExceedType>;
  fees: Map<number, GarageExceedChangeFee>;
  changeOnlyKarts: Set<number>;
  excludedIngredients: Set<number>;
  unableTargets: Set<number>;
}

/** Decode fee schedules and vehicle exceptions for changing an exceed type. */
export function parseGarageExceedChangeRules(root: GarageUpgradeXmlNode,
  attribute: GarageUpgradeAttribute): GarageExceedChangeRules {
  const types = parseGarageExceedTypes(root, attribute);
  const fees = new Map<number, GarageExceedChangeFee>();
  const feeList = root.children.find(child => child.name === "exceedTypeChangeFee");
  for (const node of feeList?.children ?? []) {
    const quality = QUALITY_BY_NAME.get(node.name);
    const wrenchCount = Number(attribute(node, "ethisSpanner"));
    const lucci = Number(attribute(node, "lucci"));
    const ingredientQualities = new Set((attribute(node, "ingredientEnableGrade") ?? "")
      .split(",").map(Number).filter(value => Number.isInteger(value) && value > 0));
    if (quality !== undefined && Number.isInteger(wrenchCount) && wrenchCount >= 0 &&
        Number.isInteger(lucci) && lucci >= 0 && ingredientQualities.size > 0)
      fees.set(quality, { quality, wrenchCount, lucci, ingredientQualities });
  }
  const itemIds = (name: string): Set<number> => new Set(
    root.children.find(child => child.name === name)?.children
      .map(node => Number(attribute(node, "id")))
      .filter(id => Number.isInteger(id) && id > 0) ?? []);
  return {
    types, fees,
    changeOnlyKarts: itemIds("exceedTypeChangeOnly"),
    excludedIngredients: itemIds("notUseAsExceedTypeChange"),
    unableTargets: itemIds("unableExceedTypeChange"),
  };
}
