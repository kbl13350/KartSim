/** The four upgrade slots represented by the original garage inventory. */
export type GaragePartSlot = "engine" | "handle" | "wheel" | "booster";
export type GaragePartFamily = "legacy" | "x" | "v1" | "xun";

export interface GaragePart {
  family: GaragePartFamily;
  slot: GaragePartSlot;
  itemId: number;
  value: number;
  grade: number;
  builtIn?: boolean;
  engineGrade?: number;
  legacyCategory?: number;
  legacyRarity?: number;
  legacyTitle?: string;
  legacyImagePath?: string;
  legacyEffect?: string;
  legacyDescription?: string;
  legacySpec?: Record<string, number>;
  legacySetSpec?: Record<string, string>;
}

export interface GarageXmlNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: GarageXmlNode[];
}

export type ReadGarageAttribute = (node: GarageXmlNode | undefined, name: string) => string | undefined;

const slotCategories: Record<GaragePartSlot, number> = {
  engine: 43,
  handle: 44,
  wheel: 45,
  booster: 46,
};
const categoriesToSlots = new Map<number, GaragePartSlot>(
  Object.entries(slotCategories).map(([slot, category]) => [category, slot as GaragePartSlot]),
);
const assetKinds: Record<GaragePartSlot, string> = {
  engine: "tuneEnginePatch",
  handle: "tuneHandle",
  wheel: "tuneWheel",
  booster: "tuneSupportKit",
};
const assetKindsToCategories = new Map<string, number>(
  Object.entries(assetKinds).map(([slot, kind]) => [kind, slotCategories[slot as GaragePartSlot]]),
);
const tuneProperties = new Set([
  "dragFactor", "forwardAccel", "backwardAccel", "gripBrake", "slipBrake",
  "frontGripFactor", "rearGripFactor", "cornerDrawFactor", "driftSlipFactor",
  "driftEscapeForce", "driftMaxGauge", "normalBoosterTime", "itemBoosterTime",
  "teamBoosterTime", "animalBoosterTime", "startBoosterTimeItem",
  "startBoosterTimeSpeed", "startForwardAccelItem", "startForwardAccelSpeed",
  "transAccelFactor", "steerConstraint", "boostAccelFactor",
]);

function appliesToTimeAttack(gameTypes: string | undefined): boolean {
  return gameTypes === undefined || gameTypes.split(";").some(type => type.trim() === "TimeAttack");
}

function legacyPartSpecifications(
  root: GarageXmlNode | undefined,
  attribute: ReadGarageAttribute,
): Map<string, { spec: Record<string, number>; setSpec?: Record<string, string> }> {
  const specifications = new Map<string, { spec: Record<string, number>; setSpec?: Record<string, string> }>();
  for (const category of root?.children ?? []) {
    if (category.name !== "ItemCat") continue;
    const categoryId = Number(attribute(category, "id"));
    if (!categoriesToSlots.has(categoryId)) continue;
    for (const item of category.children) {
      if (item.name !== "Item") continue;
      const itemId = Number(attribute(item, "id"));
      if (!Number.isSafeInteger(itemId) || itemId < 1) continue;
      const spec: Record<string, number> = {};
      for (const adjustment of item.children.filter(child => child.name === "EnchanterAddSpec")) {
        if (!appliesToTimeAttack(attribute(adjustment, "gameType"))) continue;
        for (const entry of adjustment.attributes) {
          if (entry.name === "gameType" || entry.name === "class") continue;
          const value = Number(entry.value);
          if (Number.isFinite(value) && tuneProperties.has(entry.name)) spec[entry.name] = value;
        }
      }
      const setAdjustment = item.children.find(child =>
        child.name === "EnchanterSetSpec" && appliesToTimeAttack(attribute(child, "gameType")));
      specifications.set(`${categoryId}:${itemId}`, {
        spec,
        setSpec: setAdjustment
          ? Object.fromEntries(setAdjustment.attributes.map(entry => [entry.name, entry.value]))
          : undefined,
      });
    }
  }
  return specifications;
}

/** Read legacy inventory, localized names, artwork, rarity, and kart stat changes. */
export function parseLegacyGarageParts(
  inventory: GarageXmlNode,
  specifications: GarageXmlNode | undefined,
  artwork: GarageXmlNode | undefined,
  rarity: GarageXmlNode | undefined,
  attribute: ReadGarageAttribute,
): GaragePart[] {
  const seen = new Set<string>();
  const stats = legacyPartSpecifications(specifications, attribute);
  const images = new Map<string, string>();
  for (const node of artwork?.children ?? []) {
    const category = assetKindsToCategories.get(node.name);
    const id = Number(attribute(node, "id"));
    const name = attribute(node, "name")?.trim();
    if (category !== undefined && Number.isSafeInteger(id) && id >= 1 && name)
      images.set(`${category}:${id}`, `stuff/${node.name}/${name}`);
  }
  const rarities = new Map<string, number>();
  for (const node of rarity?.children ?? []) {
    const category = assetKindsToCategories.get(node.name);
    const id = Number(attribute(node, "id"));
    const level = Number(attribute(node, "uniqueLevel"));
    if (category !== undefined && Number.isSafeInteger(id) && id >= 1 &&
        Number.isInteger(level) && level >= 1 && level <= 4)
      rarities.set(`${category}:${id}`, level);
  }
  return inventory.children.flatMap(node => {
    if (node.name !== "item") return [];
    const category = Number(attribute(node, "itemCatId"));
    const slot = categoriesToSlots.get(category);
    const id = Number(attribute(node, "itemId"));
    if (!slot || !Number.isSafeInteger(id) || id < 1) return [];
    const key = `${category}:${id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const title = attribute(node, "itemName")?.trim();
    if (!title) return [];
    return [{
      family: "legacy" as const,
      slot,
      itemId: id,
      value: 0,
      grade: 0,
      legacyCategory: category,
      legacyRarity: rarities.get(key),
      legacyTitle: title,
      legacyImagePath: images.get(key),
      legacyEffect: attribute(node, "itemEffect")?.trim() || undefined,
      legacyDescription: attribute(node, "itemDesc")?.trim() || undefined,
      legacySpec: stats.get(key)?.spec,
      legacySetSpec: stats.get(key)?.setSpec,
    }];
  });
}

export interface GaragePartCollectionDependencies {
  slots: Iterable<GaragePartSlot>;
  attribute: ReadGarageAttribute;
  defaultParts(family: "x" | "v1", slot: GaragePartSlot): GaragePart[];
  xunPartValue(itemId: number): number;
}

/** Combine built-in X/V1 parts, XUN parts, and the legacy inventory. */
export function collectGarageParts(
  parts: GarageXmlNode,
  inventory: GarageXmlNode | undefined,
  specifications: GarageXmlNode | undefined,
  rarity: GarageXmlNode | undefined,
  dependencies: GaragePartCollectionDependencies,
): GaragePart[] {
  const result: GaragePart[] = [];
  for (const slot of dependencies.slots) {
    const group = `parts${slot[0]!.toUpperCase()}${slot.slice(1)}`;
    for (const [family, id] of [["x", "1"], ["v1", "2"]] as const) {
      if (parts.children.some(node => node.name === group && dependencies.attribute(node, "id") === id))
        result.push(...dependencies.defaultParts(family, slot));
    }
    for (const node of parts.children.filter(child => child.name === `${group}12`)) {
      const id = Number(dependencies.attribute(node, "id"));
      const grade = Number(dependencies.attribute(node, "uniqueLevel"));
      if (Number.isInteger(grade) && grade >= 1 && grade <= 4)
        result.push({ family: "xun", slot, itemId: id,
          grade, value: dependencies.xunPartValue(id) });
    }
  }
  if (inventory) result.push(...parseLegacyGarageParts(
    inventory, specifications, parts, rarity, dependencies.attribute));
  return result;
}

/** Keep original inventory ordering rules: legacy rarity is stable; newer parts rank by performance. */
export function sortGarageParts(
  inventory: { parts: GaragePart[] }, family: GaragePartFamily, slot: GaragePartSlot,
): GaragePart[] {
  const parts = inventory.parts.filter(part => part.family === family && part.slot === slot);
  if (family === "legacy") {
    return parts.map((part, index) => ({ part, index }))
      .sort((left, right) =>
        (left.part.legacyRarity ?? Number.POSITIVE_INFINITY) -
          (right.part.legacyRarity ?? Number.POSITIVE_INFINITY) ||
        left.index - right.index)
      .map(entry => entry.part);
  }
  return [...parts].sort((left, right) => right.value - left.value || right.itemId - left.itemId);
}

const defaultPartFields: Record<GaragePartSlot, string> = {
  engine: "defaultEngineType",
  handle: "defaultHandleType",
  wheel: "defaultWheelType",
  booster: "defaultBoosterType",
};

export type GarageKartPartDefaults = {
  defaultExceedType?: number;
  defaultEngineType?: number;
  defaultHandleType?: number;
  defaultWheelType?: number;
  defaultBoosterType?: number;
  [key: string]: unknown;
};

/** Return the actual equipped part, falling back to the kart's generation-specific built-in part. */
export function resolveEquippedGaragePart(
  kart: GarageKartPartDefaults,
  equipment: Partial<Record<GaragePartSlot, GaragePart>>,
  slot: GaragePartSlot,
  available: GaragePart[],
  engineGrade: number | undefined,
  uniqueLevel: number | undefined,
  defaultGrades: Partial<Record<GaragePartSlot, number>> | undefined,
  familyForKart: (kart: GarageKartPartDefaults, grade: number | undefined) => GaragePartFamily | undefined,
): GaragePart | undefined {
  const family = familyForKart(kart, engineGrade);
  const equipped = equipment[slot];
  if (equipped && equipped.family === family && !(equipped.family === "xun" && equipped.itemId === 1)) {
    return equipped.family === "legacy"
      ? available.find(part => part.family === "legacy" && part.slot === slot &&
        part.itemId === equipped.itemId && part.legacyRarity !== undefined) ?? equipped
      : equipped;
  }
  if (engineGrade === 9 || (engineGrade === undefined && (kart.defaultExceedType ?? 0) > 0)) {
    return available.find(part => part.family === "xun" && part.slot === slot &&
      part.itemId === kart[defaultPartFields[slot]]);
  }
  if (!(engineGrade !== undefined && engineGrade >= 0 && engineGrade <= 6) &&
      (engineGrade === 7 || engineGrade === 8)) {
    const defaultGrade = defaultGrades?.[slot];
    const fallbackGrade = typeof uniqueLevel === "number" && Number.isInteger(uniqueLevel) &&
      uniqueLevel >= 1 && uniqueLevel <= 4 ? uniqueLevel : 4;
    const grade = typeof defaultGrade === "number" && Number.isInteger(defaultGrade) &&
      defaultGrade >= 1 && defaultGrade <= 4 ? defaultGrade : fallbackGrade;
    return { family: engineGrade === 8 ? "v1" : "x", slot,
      itemId: engineGrade === 8 ? 2 : 1, value: 0, grade,
      builtIn: true, engineGrade };
  }
  return undefined;
}

/** Equality used by garage selection and preview state. */
export function sameGaragePart(left: GaragePart | undefined, right: GaragePart | undefined): boolean {
  return left === right || !!left && !!right && left.family === right.family &&
    left.slot === right.slot && left.itemId === right.itemId &&
    left.value === right.value && left.grade === right.grade &&
    left.builtIn === right.builtIn && left.engineGrade === right.engineGrade;
}
