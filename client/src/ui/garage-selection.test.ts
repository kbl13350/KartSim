import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  activateGarageAction, allGarageItems, commitGarageItem,
  confirmGarageSelection, filteredGarageItems, garageCategoryItems,
  garageDecorationItems, garageFavoriteKey, garageFavoriteKeys, garageSubTabs,
  favoriteGarageItems, toggleGarageFavoriteItem, clampGarageFavoriteOffset,
  selectGarageCategory,
  selectGarageDecoration, selectGarageItem, selectGarageLegacyAppearance,
  selectGarageSubCategory, selectedGarageKart,
  type GarageCatalogItem, type GarageSelectionDependencies,
  type GarageSelectionHost, type GarageSelectionProfile,
} from "./garage-selection";
import {
  canFavoriteItem, favoriteItemIdentity, favoriteItemKey, favoriteItemKeys,
  makeFavoriteItem,
} from "./local-profile";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("class C7 {");
const end = source.indexOf("class E7 {", start);
assert.ok(start > 0 && end > start);

test("garage catalog filters, category navigation, kart variants and confirmation match C7", () => {
  const family = { key: "legacy", states: [
    { level: "l1", resource: "legacy-l1" },
    { level: "l2", resource: "legacy-l2" },
  ] };
  const karts: GarageCatalogItem[] = [
    { kind: "kart", itemId: 1, title: "Speed Kart", kartType: 2 },
    { kind: "kart", itemId: 2, title: "Item Kart", kartType: 1 },
    { kind: "kart", itemId: 0, title: "Legacy Kart", systemKey: "legacy",
      identityClass: "legacy-system-family", kartType: 2 },
    { kind: "kart", itemId: 999, title: "Blocked Kart", kartType: 2 },
  ];
  const characters: GarageCatalogItem[] = [
    { kind: "character", itemId: 10, title: "Driver" },
  ];
  const equipment: GarageCatalogItem[] = [
    { kind: "flyingPet", itemId: 20, title: "Flying Pet" },
    { kind: "headBand", itemId: 30, title: "Headband", category: 11 },
    { kind: "color", itemId: 40, title: "Red Paint", category: 2 },
    { kind: "dye", itemId: 41, title: "Blue Dye", category: 70 },
    { kind: "plate", itemId: 42, title: "Plate", category: 4 },
  ];
  const deps: GarageSelectionDependencies = {
    blockedKartItem: id => id === 999,
    legacyFamily: systemKey => systemKey === "legacy" ? family : undefined,
    validateKartItem: id => { if (id === 999) throw new Error("blocked kart"); },
    selectProfile: (profile, kartId, characterId, systemKey, variant) => ({
      ...profile,
      equipment: { ...profile.equipment,
        itemIds: { ...profile.equipment.itemIds, 3: kartId, 1: characterId },
        systemKart: systemKey, systemKartVariant: variant },
    }),
    findKart: (items, id, systemKey) => {
      const found = items.find(item => item.itemId === id &&
        (id !== 0 || item.systemKey === systemKey));
      if (!found) throw new Error(`missing kart ${id}`);
      return found;
    },
    findCharacter: (items, id, label) => {
      const found = items.find(item => item.itemId === id);
      if (!found) throw new Error(`missing ${label} ${id}`);
      return found;
    },
  };
  const subtabs = {
    equip: [
      { key: "whole", value: "whole" },
      { key: "headband", value: "headBand", kind: "headBand" },
      { key: "balloon", value: "balloon", kind: "balloon" },
      { key: "goggle", value: "goggle", kind: "goggle" },
      { key: "handGearL", value: "handGearL", kind: "handGearL" },
    ],
    deco: [
      { key: "whole", value: "whole" },
      { key: "aura", value: "aura", kind: "aura" },
      { key: "paint", value: "paint", kind: "color" },
      { key: "dye", value: "dye", kind: "dye" },
      { key: "skidMark", value: "skidMark", kind: "skidMark" },
      { key: "plate", value: "plate", kind: "plate" },
    ],
  };
  const Original = new Function("hT", "fT", "n3", "of", "j6", "aT", "cf", "pT",
    "Jd", "wl", "ef", "Q3", "sT", "qg", "i4",
    `${source.slice(start, end)}; return C7;`)(
      subtabs, (value: string) => value.replace(/[A-Z]/g, letter => letter.toLowerCase()),
      deps.blockedKartItem, deps.legacyFamily, deps.validateKartItem,
      deps.selectProfile, deps.findCharacter, deps.findKart,
      favoriteItemIdentity, canFavoriteItem, makeFavoriteItem,
      favoriteItemKey, favoriteItemKeys, 100, () => 40,
    ) as { prototype: Record<string, (...args: never[]) => unknown> };

  const run = (released: boolean) => {
    const events: unknown[] = [];
    const host = Object.create(Original.prototype) as GarageSelectionHost & {
      subTabs(): unknown;
      filteredItems(): GarageCatalogItem[];
      categoryItems(): GarageCatalogItem[];
      allCategoryItems(): GarageCatalogItem[];
      decorationItems(): GarageCatalogItem[];
      favoriteKey(item: GarageCatalogItem): string | undefined;
      favoriteKeys(): Set<string>;
      activate(action: { kind: string; value?: GarageCatalogItem | string }): void;
    };
    host.options = {
      catalog: { karts, characters, equipment },
      onConfirm: value => { events.push(["confirm", structuredClone(value)]); },
      onCancel: () => { events.push("cancel"); },
      onFavoriteChange: items => { events.push(["favorites-changed", structuredClone(items)]); },
    };
    host.assets = { grid: {} };
    host.category = "kart";
    host.subCategory = "whole";
    host.searchQuery = "";
    host.offset = 20;
    host.draftProfile = { equipment: { itemIds: { 1: 10, 3: 1, 4: 0, 70: 0 } },
      favoriteItems: [] } as GarageSelectionProfile;
    host.scroll = { reset: () => { events.push("scroll-reset"); } };
    host.livePanels = { resetPreviewRotation: value => { events.push(["rotation", value]); } };
    host.legacyAppearance = new Map();
    host.render = () => { events.push("render"); };
    host.clearSearch = () => { host.searchQuery = ""; events.push("clear-search"); };
    host.showEmptyFavoriteNotice = () => { events.push("empty-favorite-notice"); };
    host.itemGrid = count => ({ positionCount: Math.ceil(count / 2) });
    host.showFavoriteNotice = (name, title) => { events.push(["favorite-notice", name, title]); };
    host.activateSearch = () => { events.push("search"); };
    if (!released) {
      host.subTabs = () => garageSubTabs(host);
      host.filteredItems = () => filteredGarageItems(host);
      host.categoryItems = () => garageCategoryItems(host, deps);
      host.allCategoryItems = () => allGarageItems(host, deps);
      host.decorationItems = () => garageDecorationItems(host);
      host.favoriteKey = item => garageFavoriteKey(item);
      host.favoriteKeys = () => garageFavoriteKeys(host);
      host.favoriteCategoryItems = () => favoriteGarageItems(host);
      host.toggleFavoriteItem = item => toggleGarageFavoriteItem(host, item,
        { maxFavorites: 100, gridStep: () => 40 });
      host.clampFavoriteOffset = () => clampGarageFavoriteOffset(host,
        { maxFavorites: 100, gridStep: () => 40 });
      host.selectCategory = value => selectGarageCategory(host, value);
      host.selectSubCategory = value => selectGarageSubCategory(host, value);
      host.selectItem = item => selectGarageItem(host, item, deps);
      host.commitItem = item => commitGarageItem(host, item, deps);
      host.selectDecoration = item => selectGarageDecoration(host, item);
      host.selectedKart = () => selectedGarageKart(host, deps);
      host.confirm = () => confirmGarageSelection(host, deps);
      host.selectLegacyAppearance = level => selectGarageLegacyAppearance(host, level);
      host.activate = action => activateGarageAction(host, action);
    }
    const states: unknown[] = [];
    const errors: string[] = [];
    const capture = (label: string, result?: unknown) => states.push({
      label, result, category: host.category, subCategory: host.subCategory,
      searchQuery: host.searchQuery, offset: host.offset,
      draftProfile: structuredClone(host.draftProfile),
      appearanceDialog: host.appearanceDialog && {
        item: host.appearanceDialog.item.itemId,
        family: host.appearanceDialog.family.key,
      },
      legacyAppearance: [...host.legacyAppearance],
      favoriteKeyCache: host.favoriteKeyCache && {
        matchesSource: host.favoriteKeyCache.source === host.draftProfile.favoriteItems,
        keys: [...host.favoriteKeyCache.keys],
      },
      errors: [...errors], events: structuredClone(events),
    });
    capture("all-items", host.allCategoryItems().map(item => item.title));
    capture("kart-subtabs", host.subTabs());
    capture("kart-whole", host.categoryItems().map(item => item.title));
    host.subCategory = "itemKart";
    capture("item-karts", host.categoryItems().map(item => item.title));
    host.subCategory = "speedkart";
    capture("speed-karts", host.categoryItems().map(item => item.title));
    host.subCategory = "legacyMuseum";
    capture("legacy-museum", host.categoryItems().map(item => item.title));
    host.subCategory = "whole";
    host.searchQuery = "SPEED  kart";
    capture("search", host.filteredItems().map(item => item.title));
    host.selectCategory("character");
    capture("character-all", host.categoryItems().map(item => item.title));
    host.selectSubCategory("flyingPet");
    capture("flying-pet", host.categoryItems().map(item => item.title));
    host.subCategory = "pet";
    capture("pet-empty", host.categoryItems());
    host.selectCategory("equip");
    capture("equip-tabs", host.subTabs());
    capture("equip-all", host.decorationItems().map(item => item.title));
    host.selectSubCategory("headBand");
    capture("equip-headband", host.categoryItems().map(item => item.title));
    host.selectCategory("deco");
    capture("deco-tabs", host.subTabs());
    host.selectSubCategory("paint");
    capture("deco-paint", host.categoryItems().map(item => item.title));
    host.selectCategory("favorite");
    capture("favorite-category", host.categoryItems().map(item => item.title));
    capture("favorite-key", host.favoriteKey(karts[0]!));
    capture("favorite-keys-empty", [...host.favoriteKeys()]);
    host.toggleFavoriteItem(karts[0]!);
    capture("favorite-added", host.favoriteCategoryItems().map(item => item.title));
    capture("favorite-keys-added", [...host.favoriteKeys()]);
    host.toggleFavoriteItem(karts[0]!);
    capture("favorite-deleted", host.favoriteCategoryItems());
    host.toggleFavoriteItem(karts[2]!);
    capture("favorite-legacy", host.favoriteCategoryItems().map(item => item.title));
    host.selectItem(karts[3]!); capture("blocked-kart");
    host.selectItem(karts[2]!); capture("legacy-dialog");
    try { host.selectLegacyAppearance("missing"); }
    catch (error) { errors.push(String(error)); }
    capture("invalid-appearance");
    host.selectLegacyAppearance("l2");
    capture("legacy-selected", host.selectedKart());
    host.confirm(); capture("confirm-legacy");
    host.commitItem(equipment[4]!); capture("equip-plate-on");
    host.commitItem(equipment[4]!); capture("equip-plate-off");
    host.commitItem(characters[0]!); capture("character-selected");
    host.activate({ kind: "category", value: "kart" }); capture("activate-category");
    host.activate({ kind: "subCategory", value: "itemKart" }); capture("activate-subtab");
    host.activate({ kind: "favorite", value: karts[0] });
    host.activate({ kind: "search" });
    host.activate({ kind: "appearanceCancel" }); capture("activate-misc");
    host.activate({ kind: "cancel" }); capture("cancel");
    host.draftProfile = { ...host.draftProfile, favoriteItems: Array.from({ length: 100 },
      (_, index) => ({ category: 3, itemId: index + 1000, serial: 0 })) };
    host.toggleFavoriteItem(karts[1]!); capture("favorite-limit");
    return states;
  };
  assert.deepEqual(run(false), run(true));
});
