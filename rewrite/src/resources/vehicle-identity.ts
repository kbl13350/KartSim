import type { ResourceEntry } from "./resource-lookup";

export interface VehicleResource extends ResourceEntry {
  name: string;
  extension: string;
}

export interface VehicleTitle {
  title?: string;
  itemId?: string;
  ambiguous?: boolean;
  textureKey?: string;
  textureAmbiguous?: boolean;
}

export interface VehicleDefinition {
  kind: string;
  internalId: string;
  itemId: number;
  engineGrade?: number;
  linkCharacterId?: number;
}

export interface VehicleIdentityLibrary {
  files: VehicleResource[];
  vehicleEngineGradePromise?: Promise<Map<string, number | "ambiguous">>;
  vehicleItemIdPromise?: Promise<Map<string, number | "ambiguous">>;
  vehicleLinkCharacterIdPromise?: Promise<Map<string, number | "ambiguous">>;
  findSibling(path: string, names: string[]): VehicleResource | undefined;
  vehicleAssets(): VehicleResource[];
  vehicleTitles(): Promise<Map<string, VehicleTitle>>;
  itemTableGarageDefinitions(): Promise<VehicleDefinition[]>;
  loadVehicleEngineGrades(): Promise<Map<string, number | "ambiguous">>;
  loadVehicleItemIds(): Promise<Map<string, number | "ambiguous">>;
  loadVehicleLinkCharacterIds(): Promise<Map<string, number | "ambiguous">>;
}

const PARAMETER_NAMES = [
  "param@cn.bml", "param@cn.eml", "param@cn.kml", "param@cn.xml",
  "param.bml", "param.eml", "param.kml", "param.xml",
];

/** Mirrors the release's parent-folder identity rule, including root files. */
export function vehicleFolderName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.length > 1
    ? parts[parts.length - 2]!
    : parts[0]?.replace(/\.[^.]+$/, "") || "Unknown";
}

function uniqueModelPerCanonicalFolder<Entry extends VehicleResource>(files: Entry[]): Entry[] {
  const folders = new Map<string, Entry[]>();
  for (const file of files) {
    const path = file.canonicalPath ?? file.virtualPath;
    const folder = path.slice(0, Math.max(0, path.lastIndexOf("/"))).toLowerCase();
    folders.set(folder, [...(folders.get(folder) ?? []), file]);
  }
  return [...folders.values()].filter(group => group.length === 1).map(group => group[0]!);
}

/** Only a model with four frame assets and a parameter file can be driven. */
export function vehicleAssets(library: VehicleIdentityLibrary): VehicleResource[] {
  const models = library.files.filter(file =>
    file.extension === "1s" &&
    file.name.toLowerCase() === "model.1s" &&
    (/(^|\/)kart[^/]*\//i.test(file.virtualPath) || !file.virtualPath.includes("/")) &&
    [0, 1, 2, 3].every(frame =>
      !!library.findSibling(file.virtualPath, [`f0${frame}.1s`])) &&
    !!library.findSibling(file.virtualPath, PARAMETER_NAMES));
  return uniqueModelPerCanonicalFolder(models);
}

export async function vehicleCatalog(library: VehicleIdentityLibrary): Promise<{
  path: string; name: string; internalId: string; subtitle: string; source: string;
}[]> {
  const titles = await library.vehicleTitles();
  return library.vehicleAssets().map(file => {
    const internalId = vehicleFolderName(file.virtualPath);
    const title = titles.get(internalId.toLowerCase());
    return {
      path: file.virtualPath,
      name: title?.title ?? internalId,
      internalId,
      subtitle: title?.title
        ? `${internalId}${title.itemId ? ` · ${title.itemId}` : ""}`
        : title?.ambiguous ? `${internalId} · 名称映射不唯一` : internalId,
      source: file.sourceName,
    };
  });
}

export async function vehicleTextureKey(library: VehicleIdentityLibrary, modelPath: string): Promise<string> {
  const id = vehicleFolderName(modelPath).toLowerCase();
  const title = (await library.vehicleTitles()).get(id);
  if (title?.textureAmbiguous) {
    throw new Error(`${id} 对应多个 t1ImageName，当前 model path 无法唯一选择 item identity。`);
  }
  return title?.textureKey ?? "1";
}

/** Duplicate item-table identities are usable only when their values agree. */
function indexKartValue(
  definitions: readonly VehicleDefinition[],
  select: (definition: VehicleDefinition) => number,
): Map<string, number | "ambiguous"> {
  const identities = new Map<string, number | "ambiguous">();
  for (const definition of definitions.filter(item => item.kind === "kart")) {
    const id = definition.internalId.toLowerCase();
    const value = select(definition);
    const previous = identities.get(id);
    identities.set(id, previous === undefined || previous === value ? value : "ambiguous");
  }
  return identities;
}

export async function loadVehicleEngineGrades(
  library: VehicleIdentityLibrary,
): Promise<Map<string, number | "ambiguous">> {
  return indexKartValue(await library.itemTableGarageDefinitions(), item => item.engineGrade ?? 0);
}

export async function loadVehicleItemIds(
  library: VehicleIdentityLibrary,
): Promise<Map<string, number | "ambiguous">> {
  return indexKartValue(await library.itemTableGarageDefinitions(), item => item.itemId);
}

export async function loadVehicleLinkCharacterIds(
  library: VehicleIdentityLibrary,
): Promise<Map<string, number | "ambiguous">> {
  return indexKartValue(await library.itemTableGarageDefinitions(), item => item.linkCharacterId ?? 0);
}

async function identityValue(
  library: VehicleIdentityLibrary,
  modelPath: string,
  promiseField: "vehicleEngineGradePromise" | "vehicleItemIdPromise" | "vehicleLinkCharacterIdPromise",
  load: () => Promise<Map<string, number | "ambiguous">>,
  label: string,
): Promise<number> {
  library[promiseField] ??= load();
  const id = vehicleFolderName(modelPath).toLowerCase();
  const value = (await library[promiseField]).get(id);
  if (value === "ambiguous") throw new Error(`${id} 对应多个 ${label}。`);
  if (value === undefined) throw new Error(`${id} 缺少 itemTable.kml kart identity。`);
  return value;
}

export function vehicleEngineGrade(library: VehicleIdentityLibrary, modelPath: string): Promise<number> {
  return identityValue(library, modelPath, "vehicleEngineGradePromise",
    () => library.loadVehicleEngineGrades(), "engineGrade");
}

export function vehicleItemId(library: VehicleIdentityLibrary, modelPath: string): Promise<number> {
  return identityValue(library, modelPath, "vehicleItemIdPromise",
    () => library.loadVehicleItemIds(), "kart id");
}

export function vehicleLinkCharacterId(library: VehicleIdentityLibrary, modelPath: string): Promise<number> {
  return identityValue(library, modelPath, "vehicleLinkCharacterIdPromise",
    () => library.loadVehicleLinkCharacterIds(), "linkCharacterId");
}
