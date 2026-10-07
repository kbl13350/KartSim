export interface GaragePartListing {
  family: string;
  slot: string;
  grade: number;
  value: number;
  itemId: number;
  builtIn?: boolean;
  engineGrade?: number;
  legacyTitle?: string;
}

export interface GaragePartLabelDependencies {
  slotLabel(slot: string, family: string): string;
  localize(strings: unknown, key: string, fallback: string): string;
  slotKey: Record<string, string>;
  engineName(strings: unknown, grade: number, fallback: string): string;
  gradeName(grade: number, strings: unknown): string;
  defaultParts(family: string, slot: string): GaragePartListing[];
}

/** Ordinal of a classic/V1 part within its family, slot and quality. */
export function garagePartOrdinal(part: GaragePartListing,
  available: GaragePartListing[],
  dependencies: GaragePartLabelDependencies): number | undefined {
  if (part.family === "xun" || part.family === "legacy") return undefined;
  const matching = (available.length > 0 ? available :
    dependencies.defaultParts(part.family, part.slot))
    .filter(candidate => candidate.family === part.family &&
      candidate.slot === part.slot && candidate.grade === part.grade)
    .sort((left, right) => left.value - right.value ||
      left.itemId - right.itemId);
  const index = matching.findIndex(candidate => candidate.value === part.value &&
    candidate.itemId === part.itemId);
  return index < 0 ? undefined : index + 1;
}

/** Ordinal of a Xun part, falling through to classic numbering for other parts. */
export function garageXunPartOrdinal(part: GaragePartListing,
  available: GaragePartListing[],
  dependencies: GaragePartLabelDependencies): number | undefined {
  if (part.family !== "xun")
    return garagePartOrdinal(part, available, dependencies);
  const index = available.filter(candidate => candidate.family === "xun" &&
    candidate.slot === part.slot && candidate.grade === part.grade)
    .sort((left, right) => left.value - right.value ||
      left.itemId - right.itemId)
    .findIndex(candidate => candidate.itemId === part.itemId &&
      candidate.value === part.value);
  return index < 0 ? undefined : index + 1;
}

/** Build the localized Garage part name seen in inventory and selection. */
export function garagePartDisplayName(part: GaragePartListing,
  strings: unknown,
  available: GaragePartListing[],
  dependencies: GaragePartLabelDependencies): string {
  const slot = part.family === "legacy" ?
    dependencies.slotLabel(part.slot, part.family) :
    dependencies.localize(strings, dependencies.slotKey[part.slot]!,
      dependencies.slotLabel(part.slot, part.family));
  if (part.family === "legacy")
    return part.legacyTitle?.trim() ||
      `${dependencies.slotLabel(part.slot, part.family)} ${part.itemId}`;
  if (part.builtIn) {
    const engineGrade = part.engineGrade === undefined ||
      part.engineGrade === 0 ? 0 : part.engineGrade + 4;
    const engine = dependencies.engineName(strings, engineGrade,
      part.engineGrade === 8 ? "V1引擎" :
        part.engineGrade === 7 ? "X引擎" : "");
    const quality = dependencies.gradeName(part.grade, strings);
    return [engine, quality,
      dependencies.localize(strings, "partsBasic", "基本"), slot]
      .filter(Boolean).join(" ");
  }
  if (part.family === "xun") {
    const quality = dependencies.gradeName(part.grade, strings);
    const ordinal = garageXunPartOrdinal(part, available, dependencies);
    return [dependencies.engineName(strings, 13, "迅引擎"), quality,
      slot, ordinal === undefined ? "" : String(ordinal)]
      .filter(Boolean).join(" ");
  }
  const ordinal = garagePartOrdinal(part, available, dependencies);
  const quality = dependencies.gradeName(part.grade, strings);
  return [
    dependencies.engineName(strings, part.family === "v1" ? 12 : 11,
      part.family === "v1" ? "V1引擎" : "X引擎"),
    quality, slot, String(ordinal === undefined ? part.value : ordinal),
  ].filter(Boolean).join(" ");
}

export interface GarageEnchantNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: GarageEnchantNode[];
}

export interface GarageEnchantSpecDependencies {
  attribute(node: GarageEnchantNode, name: string): string | undefined;
  categories: Set<number>;
  appliesToGameType(gameType: string | undefined): boolean;
  scoreFields: Set<string>;
}

/** Extract supported Factory stat deltas from the item table. */
export function parseGarageEnchantSpecs(root: GarageEnchantNode | undefined,
  dependencies: GarageEnchantSpecDependencies):
  Map<string, { spec: Record<string, number>;
    setSpec: Record<string, string> | undefined }> {
  const result = new Map<string, { spec: Record<string, number>;
    setSpec: Record<string, string> | undefined }>();
  for (const category of root?.children ?? []) {
    if (category.name !== "ItemCat") continue;
    const categoryId = Number(dependencies.attribute(category, "id"));
    if (!dependencies.categories.has(categoryId)) continue;
    for (const item of category.children) {
      if (item.name !== "Item") continue;
      const itemId = Number(dependencies.attribute(item, "id"));
      if (!Number.isSafeInteger(itemId) || itemId < 1) continue;
      const spec: Record<string, number> = {};
      for (const effect of item.children.filter(child =>
        child.name === "EnchanterAddSpec")) {
        if (!dependencies.appliesToGameType(
          dependencies.attribute(effect, "gameType"))) continue;
        for (const entry of effect.attributes) {
          if (entry.name === "gameType" || entry.name === "class") continue;
          const value = Number(entry.value);
          if (Number.isFinite(value) && dependencies.scoreFields.has(entry.name))
            spec[entry.name] = value;
        }
      }
      const setEffect = item.children.find(child =>
        child.name === "EnchanterSetSpec" &&
        dependencies.appliesToGameType(
          dependencies.attribute(child, "gameType")));
      result.set(`${categoryId}:${itemId}`, {
        spec,
        setSpec: setEffect ? Object.fromEntries(setEffect.attributes.map(entry =>
          [entry.name, entry.value])) : undefined,
      });
    }
  }
  return result;
}
