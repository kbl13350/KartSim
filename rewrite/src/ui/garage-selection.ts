import {
  canFavoriteItem, favoriteItemIdentity, favoriteItemKey, favoriteItemKeys,
  makeFavoriteItem, type FavoriteItem,
} from "./local-profile";

export interface GarageCatalogItem {
  kind: string;
  itemId: number;
  title: string;
  category?: number;
  systemKey?: string;
  kartType?: number;
  identityClass?: string;
  internalId?: string;
  path?: string;
  [key: string]: unknown;
}

export interface GarageSelectionProfile {
  equipment: {
    itemIds: Record<number, number>;
    systemKart?: string;
    [key: string]: unknown;
  };
  favoriteItems: FavoriteItem[];
  [key: string]: unknown;
}

export interface GarageLegacyFamily {
  key: string;
  states: Array<{ level: unknown; resource: string }>;
}

export interface GarageSelectionDependencies<Item extends GarageCatalogItem = GarageCatalogItem> {
  blockedKartItem(itemId: number): boolean;
  legacyFamily(systemKey: string | undefined): GarageLegacyFamily | undefined;
  validateKartItem(itemId: number): void;
  selectProfile(profile: GarageSelectionProfile, kartId: number, characterId: number,
    systemKey: string | undefined, variant?: string): GarageSelectionProfile;
  findKart(items: Item[], itemId: number, systemKey?: string): Item;
  findCharacter(items: Item[], itemId: number, label: string): Item;
}

export interface GarageSelectionHost<Item extends GarageCatalogItem = GarageCatalogItem> {
  options: {
    catalog: { karts: Item[]; characters: Item[]; equipment: Item[];
      /** Counted items without a model (精品道具: boxes, materials). */
      stuff?: Item[] };
    /** A 精品道具 card was chosen (a box opens). */
    onUseItem?(item: Item): void;
    onConfirm(selection: { kart: Item; character: Item;
      equipment: GarageSelectionProfile["equipment"] }): void;
    onCancel(): void;
    onFavoriteChange(items: FavoriteItem[]): void;
  };
  assets: { grid: unknown };
  category: string;
  subCategory: string;
  searchQuery: string;
  offset: number;
  draftProfile: GarageSelectionProfile;
  scroll: { reset(): void };
  livePanels?: { resetPreviewRotation(enabled: boolean): void };
  appearanceDialog?: { item: Item; family: GarageLegacyFamily };
  legacyAppearance: Map<string, string>;
  favoriteKeyCache?: { source: FavoriteItem[]; keys: Set<string> };
  render(): void;
  clearSearch(): void;
  showEmptyFavoriteNotice(): void;
  favoriteCategoryItems(): Item[];
  allCategoryItems(): Item[];
  filteredItems(): Item[];
  itemGrid(count: number): { positionCount: number };
  showFavoriteNotice(name: string, title?: string): void;
  clampFavoriteOffset(): void;
  selectCategory(category: string): void;
  selectSubCategory(category: string): void;
  selectItem(item: Item): void;
  commitItem(item: Item): void;
  selectDecoration(item: Item): void;
  selectedKart(): Item;
  selectLegacyAppearance(level: unknown): void;
  confirm(): void;
  toggleFavoriteItem(item: Item): void;
  activateSearch(): void;
}

export interface GarageSelectionAction<Item extends GarageCatalogItem = GarageCatalogItem> {
  kind: string;
  value?: Item | string;
}

export interface GarageFavoriteDependencies {
  maxFavorites: number;
  gridStep(grid: unknown): number;
}

export function garageFavoriteKey(item: GarageCatalogItem): string | undefined {
  const identity = favoriteItemIdentity(item as Parameters<typeof favoriteItemIdentity>[0]);
  return identity === undefined || !canFavoriteItem(identity)
    ? undefined : favoriteItemKey(makeFavoriteItem(identity as FavoriteItem));
}

/** Cache favorite keys while the profile's favorite array keeps its identity. */
export function garageFavoriteKeys(host: GarageSelectionHost): Set<string> {
  const items = host.draftProfile.favoriteItems;
  if (host.favoriteKeyCache?.source !== items) {
    host.favoriteKeyCache = { source: items, keys: favoriteItemKeys(items) };
  }
  return host.favoriteKeyCache.keys;
}

export function favoriteGarageItems<Item extends GarageCatalogItem>(
  host: GarageSelectionHost<Item>,
): Item[] {
  const keys = favoriteItemKeys(host.draftProfile.favoriteItems);
  return keys.size === 0 ? [] : host.allCategoryItems().filter(item => {
    const identity = favoriteItemIdentity(item as Parameters<typeof favoriteItemIdentity>[0]);
    return identity !== undefined && canFavoriteItem(identity) &&
      keys.has(favoriteItemKey(makeFavoriteItem(identity as FavoriteItem)));
  });
}

export function toggleGarageFavoriteItem<Item extends GarageCatalogItem>(
  host: GarageSelectionHost<Item>, item: Item,
  deps: GarageFavoriteDependencies,
): void {
  const identity = favoriteItemIdentity(item as Parameters<typeof favoriteItemIdentity>[0]);
  if (identity === undefined || !canFavoriteItem(identity)) return;
  const favorite = makeFavoriteItem(identity as FavoriteItem);
  const key = favoriteItemKey(favorite);
  const previous = host.draftProfile.favoriteItems;
  const alreadyFavorite = previous.some(entry => favoriteItemKey(entry) === key);
  if (!alreadyFavorite && previous.length >= deps.maxFavorites) {
    host.showFavoriteNotice("favoriteItemOver");
    return;
  }
  const next = alreadyFavorite
    ? previous.filter(entry => favoriteItemKey(entry) !== key)
    : [...previous, favorite];
  host.draftProfile = { ...host.draftProfile, favoriteItems: next };
  host.options.onFavoriteChange(next);
  host.showFavoriteNotice(alreadyFavorite ? "favoriteItemDeleted" : "favoriteItemAdded", item.title);
  if (host.category === "favorite") host.clampFavoriteOffset();
  host.render();
}

export function clampGarageFavoriteOffset(host: GarageSelectionHost,
  deps: GarageFavoriteDependencies): void {
  const pages = host.itemGrid(host.filteredItems().length).positionCount;
  const step = deps.gridStep(host.assets.grid);
  host.offset = Math.min(host.offset, Math.max(0, (pages - 1) * step));
}

const equipmentTabs = [
  { key: "whole", value: "whole" },
  { key: "headband", value: "headBand", kind: "headBand" },
  { key: "balloon", value: "balloon", kind: "balloon" },
  { key: "goggle", value: "goggle", kind: "goggle" },
  { key: "handGearL", value: "handGearL", kind: "handGearL" },
];
const decorationTabs = [
  { key: "whole", value: "whole" },
  { key: "aura", value: "aura", kind: "aura" },
  { key: "paint", value: "paint", kind: "color" },
  { key: "dye", value: "dye", kind: "dye" },
  { key: "skidMark", value: "skidMark", kind: "skidMark" },
  { key: "plate", value: "plate", kind: "plate" },
];

export function garageSubTabs(host: GarageSelectionHost): Array<{
  key: string; value: string; kind?: string;
}> {
  if (host.category === "kart") return [
    { key: "whole", value: "whole" },
    { key: "itemKart", value: "itemKart" },
    { key: "speedkart", value: "speedkart" },
    { key: "legacyMuseum", value: "legacyMuseum" },
  ];
  if (host.category === "character") return [
    { key: "whole", value: "whole" },
    { key: "character", value: "character" },
    { key: "pet", value: "pet" },
    { key: "flyingPet", value: "flyingPet" },
  ];
  if (host.category === "equip") return equipmentTabs;
  if (host.category === "deco") return decorationTabs;
  return [{ key: "whole", value: "whole" }];
}

/** The packaged garage search lowercases ASCII letters only. */
function normalizeSearch(value: string): string {
  return value.replace(/[A-Z]/g, letter => letter.toLowerCase());
}

export function filteredGarageItems<Item extends GarageCatalogItem>(
  host: GarageSelectionHost<Item> & { categoryItems(): Item[] },
): Item[] {
  const items = host.categoryItems();
  const terms = host.searchQuery.split(" ").filter(Boolean).map(normalizeSearch);
  return terms.length === 0 ? items : items.filter(item => {
    const title = normalizeSearch(item.title);
    return terms.every(term => title.includes(term));
  });
}

/** Equipment slot of each catalog kind (release table S7). */
const EQUIPMENT_SLOT: Readonly<Record<string, number>> = {
  character: 1, color: 2, kart: 3, plate: 4, dye: 70, flyingPet: 52, goggle: 8,
  balloon: 9, headBand: 11, handGearL: 16, aura: 26, skidMark: 27,
};

/** The same in-use test that draws a card as selected. */
export function garageItemInUse(item: GarageCatalogItem,
  equipment: { itemIds: Record<number, number>; systemKart?: string }): boolean {
  const slot = EQUIPMENT_SLOT[item.kind];
  if (slot === undefined || item.itemId !== equipment.itemIds[slot]) return false;
  if (item.kind === "kart" && item.itemId === 0) return item.systemKey === equipment.systemKart;
  return item.itemId !== 0;
}

export function garageCategoryItems<Item extends GarageCatalogItem>(
  host: GarageSelectionHost<Item> & { decorationItems(): Item[] },
  deps: GarageSelectionDependencies<Item>,
): Item[] {
  if (host.category === "favorite") return host.favoriteCategoryItems();
  if (host.category === "lottery") return host.options.catalog.stuff ?? [];
  if (host.category === "using") return allGarageItems(host, deps)
    .filter(item => garageItemInUse(item, host.draftProfile.equipment));
  if (host.category === "deco" || host.category === "equip") return host.decorationItems();
  if (host.category === "character") {
    const flyingPets = host.options.catalog.equipment.filter(item => item.kind === "flyingPet");
    if (host.subCategory === "flyingPet") return flyingPets;
    if (host.subCategory === "pet") return [];
    if (host.subCategory === "character") return host.options.catalog.characters;
    return [...host.options.catalog.characters, ...flyingPets];
  }
  const karts = host.options.catalog.karts.filter(item => !deps.blockedKartItem(item.itemId));
  if (host.subCategory === "itemKart") return karts.filter(item => item.kartType === 1);
  if (host.subCategory === "speedkart") return karts.filter(item => item.kartType === 2);
  if (host.subCategory === "legacyMuseum") {
    return karts.filter(item => item.identityClass === "legacy-system-family");
  }
  return karts.filter(item => item.identityClass !== "legacy-system-family");
}

export function allGarageItems<Item extends GarageCatalogItem>(
  host: GarageSelectionHost<Item>, deps: GarageSelectionDependencies<Item>,
): Item[] {
  return [
    ...host.options.catalog.karts.filter(item => !deps.blockedKartItem(item.itemId)),
    ...host.options.catalog.characters,
    ...host.options.catalog.equipment,
  ];
}

export function garageDecorationItems<Item extends GarageCatalogItem>(
  host: GarageSelectionHost<Item>,
): Item[] {
  if (host.category !== "equip" && host.category !== "deco") return [];
  const tabs = host.category === "equip" ? equipmentTabs : decorationTabs;
  const kinds = new Set(tabs.flatMap(tab => "kind" in tab ? [tab.kind] : []));
  const selectedKind = tabs.find(tab => tab.value === host.subCategory)?.kind;
  return host.options.catalog.equipment.filter(item =>
    kinds.has(item.kind) && (selectedKind === undefined || item.kind === selectedKind));
}

export function selectGarageCategory(host: GarageSelectionHost, category: string): void {
  host.category = category;
  host.subCategory = "whole";
  host.offset = 0;
  host.scroll.reset();
  host.livePanels?.resetPreviewRotation(false);
  if (category === "favorite") host.showEmptyFavoriteNotice();
  host.clearSearch();
  host.render();
}

export function selectGarageSubCategory(host: GarageSelectionHost, category: string): void {
  host.subCategory = category;
  host.offset = 0;
  host.scroll.reset();
  host.livePanels?.resetPreviewRotation(false);
  host.clearSearch();
  host.render();
}

export function selectGarageItem<Item extends GarageCatalogItem>(
  host: GarageSelectionHost<Item>, item: Item, deps: GarageSelectionDependencies<Item>,
): void {
  if (item.kind === "stuff") {
    host.options.onUseItem?.(item);
    return;
  }
  if (item.kind === "kart") {
    if (deps.blockedKartItem(item.itemId)) return;
    const family = deps.legacyFamily(item.systemKey);
    if (family) {
      host.appearanceDialog = { item, family };
      host.render();
      return;
    }
  }
  host.commitItem(item);
}

export function commitGarageItem<Item extends GarageCatalogItem>(
  host: GarageSelectionHost<Item>, item: Item, deps: GarageSelectionDependencies<Item>,
): void {
  if (item.kind === "kart") deps.validateKartItem(item.itemId);
  const { itemIds } = host.draftProfile.equipment;
  if ("category" in item) host.selectDecoration(item);
  else {
    host.draftProfile = deps.selectProfile(host.draftProfile,
      item.kind === "kart" ? item.itemId : itemIds[3]!,
      item.kind === "character" ? item.itemId : itemIds[1]!,
      item.kind === "kart" ? item.systemKey : host.draftProfile.equipment.systemKart,
      item.kind === "kart" && deps.legacyFamily(item.systemKey)
        ? item.internalId : undefined);
  }
  host.livePanels?.resetPreviewRotation(item.kind === "plate");
  host.render();
}

export function selectGarageDecoration<Item extends GarageCatalogItem>(
  host: GarageSelectionHost<Item>, item: Item,
): void {
  const equipment = host.draftProfile.equipment;
  const previous = equipment.itemIds[item.category!];
  const next = item.kind === "color" || item.kind === "dye"
    ? item.itemId : previous === item.itemId ? 0 : item.itemId;
  host.draftProfile = { ...host.draftProfile,
    equipment: { ...equipment,
      itemIds: { ...equipment.itemIds, [item.category!]: next } } };
}

export function selectedGarageKart<Item extends GarageCatalogItem>(
  host: GarageSelectionHost<Item>, deps: GarageSelectionDependencies<Item>,
): Item {
  const equipment = host.draftProfile.equipment;
  const selected = deps.findKart(host.options.catalog.karts,
    equipment.itemIds[3]!, equipment.systemKart);
  const variant = selected.systemKey
    ? host.legacyAppearance.get(selected.systemKey) : undefined;
  return variant ? { ...selected,
    internalId: variant, path: `kart_/${variant}/model.1s` } : selected;
}

export function confirmGarageSelection<Item extends GarageCatalogItem>(
  host: GarageSelectionHost<Item>, deps: GarageSelectionDependencies<Item>,
): void {
  const kart = host.selectedKart();
  const character = deps.findCharacter(host.options.catalog.characters,
    host.draftProfile.equipment.itemIds[1]!, "人物");
  host.options.onConfirm({ kart, character, equipment: host.draftProfile.equipment });
}

export function selectGarageLegacyAppearance<Item extends GarageCatalogItem>(
  host: GarageSelectionHost<Item>, level: unknown,
): void {
  const dialog = host.appearanceDialog;
  if (!dialog) return;
  const state = dialog.family.states.find(entry => entry.level === level);
  if (!state) throw new Error(`${dialog.family.key} 缺少 ${level} 外观。`);
  host.legacyAppearance.set(dialog.family.key, state.resource);
  host.appearanceDialog = undefined;
  host.commitItem({ ...dialog.item,
    internalId: state.resource, path: `kart_/${state.resource}/model.1s` });
}

/** Route cards, category tabs, favorites and close/confirm buttons. */
export function activateGarageAction<Item extends GarageCatalogItem>(
  host: GarageSelectionHost<Item>, action: GarageSelectionAction<Item>,
): void {
  if (action.kind === "appearanceCancel") {
    host.appearanceDialog = undefined;
    host.render();
    return;
  }
  if (action.kind === "appearance") {
    host.selectLegacyAppearance(action.value);
    return;
  }
  if (action.kind === "cancel") { host.options.onCancel(); return; }
  if (action.kind === "confirm") { host.confirm(); return; }
  if (action.kind === "category") { host.selectCategory(action.value as string); return; }
  if (action.kind === "subCategory") { host.selectSubCategory(action.value as string); return; }
  if (action.kind === "favorite") { host.toggleFavoriteItem(action.value as Item); return; }
  if (action.kind === "search") { host.activateSearch(); return; }
  host.selectItem(action.value as Item);
}
