export interface GarageEngineLayouts<Layout> {
  classic: Layout;
  v1: Layout;
  xun: Layout;
}

/** Choose the authored Garage layout for a kart's engine generation. */
export function garageLayoutForEngineGrade<Layout>(grade: number | undefined,
  layouts: GarageEngineLayouts<Layout>): Layout | undefined {
  if (grade === undefined || !Number.isInteger(grade)) return undefined;
  if (grade >= 0 && grade <= 7) return layouts.classic;
  if (grade === 8) return layouts.v1;
  if (grade === 9) return layouts.xun;
  return undefined;
}

/** The vehicle progression system active for its engine generation. */
export function garageProgressionKind(grade: number | undefined):
  "classic" | "xun" | undefined {
  if (grade === undefined || !Number.isInteger(grade)) return undefined;
  if (grade >= 0 && grade <= 6) return "classic";
  if (grade === 9) return "xun";
  return undefined;
}

export interface GaragePreviewPart {
  family: string;
  slot: string;
}

export interface GaragePreviewDependencies<Vehicle, Equipment, Result> {
  calculate(vehicle: Vehicle, equipment: unknown,
    configuration: Equipment, version: number): Result;
  family(vehicle: Vehicle, equipment: unknown): string;
  slotLocked(vehicle: Vehicle, slot: string): boolean;
}

/** Preview one compatible part while preserving the current equipment draft. */
export function previewGaragePart<Vehicle,
  Equipment extends Record<string, unknown>, Result>(
  vehicle: Vehicle, equipment: unknown, configuration: Equipment,
  part: GaragePreviewPart | undefined,
  version: number,
  dependencies: GaragePreviewDependencies<Vehicle, Equipment, Result>,
): Result {
  if (!part) return dependencies.calculate(vehicle, equipment,
    configuration, version);
  if (part.family !== dependencies.family(vehicle, equipment) ||
      dependencies.slotLocked(vehicle, part.slot))
    throw new Error("当前车辆无法预览此部件。");
  return dependencies.calculate(vehicle, equipment,
    { ...configuration, [part.slot]: part } as Equipment, version);
}

/** Native string table fallback used for part labels. */
export function garageText(strings: Map<string, string>,
  key: string, fallback: string): string {
  return strings.get(key)?.trim() || fallback;
}

/** Name one engine generation without repeating the localized engine suffix. */
export function garageEngineName(strings: Map<string, string>,
  grade: number, fallback: string): string {
  const suffix = garageText(strings, "partsEngine12", "引擎");
  const name = garageText(strings, `engineGrade${grade}`, fallback);
  return name.endsWith(suffix) ? name.slice(0, -suffix.length).trim() :
    name.trim();
}

/** Localized part quality, with level four as the native fallback. */
export function garageGradeName(grade: number, strings: Map<string, string>,
  keys: Record<number, string>, fallbacks: Record<number, string>): string {
  const level = grade >= 1 && grade <= 3 ? grade : 4;
  return garageText(strings, keys[level]!, fallbacks[level]!);
}

export interface GarageQualityPart {
  family: string;
  grade: number;
  legacyRarity?: number;
}

/** Display rarity for legacy parts, and quality grade for current parts. */
export function garagePartQuality(part: GarageQualityPart): number | undefined {
  const quality = part.family === "legacy" ? part.legacyRarity : part.grade;
  return quality !== undefined && Number.isInteger(quality) &&
    quality >= 1 && quality <= 4 ? quality : undefined;
}

export function garagePartCardBackground(part: GarageQualityPart,
  fallback: string): string {
  const quality = garagePartQuality(part);
  return quality === undefined ? fallback : `unique${quality}_x`;
}

export function garageKartTypeTexture(kind: number): string {
  return `garage_img_textCarType${kind === 1 ? 1 : 2}`;
}

export function garagePageBackground(page: string,
  layout: { backgroundTexture: string }): string | undefined {
  return page === "parts" ? layout.backgroundTexture : undefined;
}

export function garageShowsVehicleInformation(page: string,
  engineGrade: number): boolean {
  return page === "parts" || page === "level" && engineGrade === 9;
}

export function garageAllowsEquipment(locked: boolean,
  blocked = false): boolean {
  return !locked && !blocked;
}

export interface GaragePreviewElement {
  closest(selector: string): GaragePreviewElement | null;
}

export interface GaragePreviewContainer {
  contains(element: GaragePreviewElement): boolean;
}

/** Resolve the preview card currently under the pointer. */
export function garagePreviewHitTest<Value>(container: GaragePreviewContainer,
  x: number, y: number,
  elementFromPoint: (x: number, y: number) => GaragePreviewElement | null,
  cards: Map<GaragePreviewElement, Value>): Value | undefined {
  const card = elementFromPoint(x, y)?.closest(".garage-part-preview");
  return card && container.contains(card) ? cards.get(card) : undefined;
}
