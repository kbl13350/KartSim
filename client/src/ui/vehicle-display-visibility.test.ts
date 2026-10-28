import assert from "node:assert/strict";
import test from "node:test";
import { refreshVehicleDisplaySettings, vehicleCatalogDisplayEnabled } from "../resources/vehicle-display-settings";
import { ownedGarageCatalog } from "../account/ownership";
import { allGarageItems, commitGarageItem, confirmGarageSelection, favoriteGarageItems, filteredGarageItems,
  garageCategoryItems, selectGarageItem, selectedGarageKart, type GarageSelectionHost,
  type GarageSelectionDependencies } from "./garage-selection";
import { filteredGarageKarts, selectGarageKart, type GarageCatalogNavigationHost } from "./garage-catalog-navigation";
import { createGarageSelectionViewClass, type GarageSelectionViewOps } from "./garage-selection-view";
import { loadGarageView, type GarageLoadDependencies } from "./garage-lifecycle";
import { defaultShopQuery, queryShop, ShopIndex } from "../shop/shop-model";
import { fixtureCatalog } from "../shop/shop-test-fixtures";
import { ShopApiError, shopErrorMessage } from "../shop/shop-api";

async function withPolicy(action: (update: (ids: string[]) => Promise<void>) => Promise<void>) {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), oldFetch = globalThis.fetch;
  let ids: string[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://vehicle-test.example" } } });
  globalThis.fetch = async () => new Response(JSON.stringify({ disabledVehicleIds: ids, version: "test", updatedAt: 1 }));
  try { await action(async next => { ids = next; await refreshVehicleDisplaySettings(true); }); }
  finally {
    globalThis.fetch = oldFetch;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}
function garage() {
  const catalog = { karts: [
    { kind: "kart", itemId: 10, title: "竞速赛车", kartType: 2, engineGrade: 9 },
    { kind: "kart", itemId: 20, title: "道具赛车", kartType: 1, engineGrade: 9 },
    { kind: "kart", itemId: 0, systemKey: "practiceKart", title: "练习车", kartType: 2 },
    { kind: "kart", itemId: 0, systemKey: "legacy", title: "经典车", identityClass: "legacy-system-family" },
  ], characters: [{ kind: "character", itemId: 2, title: "皮蛋" }], equipment: [] };
  const owned = ownedGarageCatalog(catalog, { owns: () => true, inventory: () => [] }, { kartItemId: 20 });
  const confirmed: unknown[] = [];
  const deps: GarageSelectionDependencies = {
    blockedKartItem: () => false, legacyFamily: key => key === "legacy" ? { key, states: [] } : undefined,
    validateKartItem() {}, selectProfile: (profile, kartId, characterId, systemKey) => ({ ...profile,
      equipment: { ...profile.equipment, itemIds: { 1: characterId, 3: kartId }, systemKart: systemKey } }),
    findKart: (items, id, systemKey) => items.find(item => item.itemId === id && (id !== 0 || item.systemKey === systemKey))!,
    findCharacter: (items, id) => items.find(item => item.itemId === id)!,
  };
  const host = { options: { catalog: owned, onConfirm: (value: unknown) => confirmed.push(value), onCancel() {}, onFavoriteChange() {} },
    category: "kart", subCategory: "whole", searchQuery: "", offset: 0,
    draftProfile: { equipment: { itemIds: { 1: 2, 3: 20 } }, favoriteItems: [
      { category: 3, itemId: 10, serial: 0 }, { category: 3, itemId: 20, serial: 0 }] },
    legacyAppearance: new Map(), render() {},
  } as unknown as GarageSelectionHost & { categoryItems(): ReturnType<typeof allGarageItems>; decorationItems(): never[] };
  host.allCategoryItems = () => allGarageItems(host, deps);
  host.favoriteCategoryItems = () => favoriteGarageItems(host);
  host.categoryItems = () => garageCategoryItems(host, deps);
  host.filteredItems = () => filteredGarageItems(host);
  host.decorationItems = () => [];
  host.commitItem = item => commitGarageItem(host, item, deps);
  host.selectedKart = () => selectedGarageKart(host, deps);
  return { host, deps, confirmed, catalog };
}

test("classic/multiplayer garage hides disabled cards, favorites, using and search without deleting current equipment", async () => {
  await withPolicy(async update => {
    await update(["catalog:3:20", "system:legacy"]);
    const { host, deps, catalog, confirmed } = garage();
    assert.deepEqual(host.filteredItems().map(item => item.itemId), [10, 0]);
    host.category = "favorite";
    assert.deepEqual(host.filteredItems().map(item => item.itemId), [10]);
    host.category = "using";
    assert.deepEqual(host.filteredItems().map(item => item.kind), ["character"]);
    host.category = "kart";
    for (const sub of ["itemKart", "legacyMuseum"]) { host.subCategory = sub; assert.deepEqual(host.filteredItems(), []); }
    host.subCategory = "whole"; host.searchQuery = "道具";
    assert.deepEqual(host.filteredItems(), []);
    const before = host.draftProfile;
    selectGarageItem(host, catalog.karts[1]!, deps); commitGarageItem(host, catalog.karts[1]!, deps);
    selectGarageItem(host, catalog.karts[3]!, deps);
    assert.equal(host.draftProfile, before); assert.equal(host.appearanceDialog, undefined);
    assert.equal(host.selectedKart().itemId, 20);
    confirmGarageSelection(host, deps);
    assert.equal((confirmed[0] as { kart: { itemId: number } }).kart.itemId, 20);
    assert.equal(host.options.catalog.karts.length, 4); assert.equal(host.draftProfile.favoriteItems.length, 2);
    host.commitItem(catalog.karts[0]!); assert.equal(host.selectedKart().itemId, 10);
    host.commitItem(catalog.karts[1]!); assert.equal(host.selectedKart().itemId, 10);
    await update([]); host.searchQuery = "";
    assert.deepEqual(host.filteredItems().map(item => item.itemId), [10, 20, 0]);
  });
});

test("full-screen parts/upgrade/factory filter disabled vehicles; stale clicks and all-closed retain current preview", async () => {
  await withPolicy(async update => {
    const { catalog, host: classic } = garage();
    const host = { options: { catalog }, pageMode: "parts", search: { value: "" }, filter: 0,
      selected: catalog.karts[1], nativeFactoryAllowed: () => true } as unknown as GarageCatalogNavigationHost;
    const deps = { blockedKart: () => false, canCustomize: () => true, progressionLayout: () => "xun" };
    await update(["catalog:3:20", "system:practiceKart", "system:legacy"]);
    for (const page of ["parts", "level", "factory"] as const) {
      host.pageMode = page; assert.deepEqual(filteredGarageKarts(host, deps).map(item => item.itemId), [10]);
    }
    selectGarageKart(host, catalog.karts[1]!, () => assert.fail("disabled vehicle reached selection"));
    assert.equal(host.selected, catalog.karts[1]);
    await update(["catalog:3:10", "catalog:3:20", "system:practiceKart", "system:legacy"]);
    assert.deepEqual(filteredGarageKarts(host, deps), []); assert.deepEqual(classic.filteredItems(), []);
    assert.equal(classic.selectedKart().itemId, 20); assert.equal(catalog.karts.length, 4);
    const messages: string[] = [];
    const Dialog = createGarageSelectionViewClass({ drawText: (_context: unknown, message: string) => messages.push(message) } as unknown as GarageSelectionViewOps);
    Dialog.prototype.drawVehicleDisplayNotice.call({ category: "kart", options: { catalog }, rect: () => ({}) } as unknown as InstanceType<typeof Dialog>);
    assert.deepEqual(messages, ["暂无已开启的车辆，当前装备仍会保留。"]);
  });
});

test("shared classic and full-screen loaders refresh each opening and preserve raw current catalog entries", async () => {
  await withPolicy(async update => {
    await update(["catalog:3:20"]);
    let requests = 0;
    const fetch = globalThis.fetch; globalThis.fetch = (...args) => { requests++; return fetch(...args); };
    const { catalog } = garage(), options = { catalog, selectedKartItemId: 20, selectedCharacterItemId: 2 };
    const Dialog = createGarageSelectionViewClass({ validateKart: (items: unknown) => assert.equal(items, catalog.karts),
      validateCharacter() {}, loadAssets: async () => ({}) } as unknown as GarageSelectionViewOps);
    class Probe { constructor(readonly options: unknown) {} }
    for (let i = 0; i < 2; i++) assert.equal((await Dialog.load.call(Probe as unknown as typeof Dialog, options)).options, options);
    const fakeView = { surface: { append() {} }, controls: {}, progressionPanel: { element: {} },
      previewRect: { width: 100, height: 100 }, pageMode: "parts", setFactory() {}, updateControls() {}, showFactoryTutorial() {}, dispose() {} };
    const deps = { defaultStageWidth: 1600, normalizeStage: (width: number) => ({ width }), loadAssets: async () => ({}),
      loadPreviews: async () => ({}), loadLayout: async () => ({}), createView: () => fakeView,
      createFactoryPanel: () => ({ element: {}, resizeCanvases() {} }), loadConfirmation: async () => ({}),
      loadPanels: async () => ({ setParticleModificationPageVisible() {} }), previewSize: () => ({}) } as unknown as GarageLoadDependencies;
    for (let i = 0; i < 2; i++) await loadGarageView({ library: {}, environment: {}, stageBinding: {} }, deps);
    assert.equal(requests, 4); assert.equal(catalog.karts.length, 4);
    assert.equal(vehicleCatalogDisplayEnabled(catalog.karts[1]!), false);
  });
});

test("shop category, recommended and search hide disabled karts and keep other goods; re-enable restores cached catalog", async () => {
  await withPolicy(async update => {
    const catalog = fixtureCatalog(), index = new ShopIndex(catalog);
    await update(["catalog:3:10", "catalog:3:20", "catalog:3:5"]);
    for (const query of [defaultShopQuery("kartBody"), defaultShopQuery(), { ...defaultShopQuery(), search: "尖锋" },
      { ...defaultShopQuery("kartBody"), currency: "lucci" as const }])
      assert.ok(queryShop(index, query).every(entry => entry.item.category !== 3));
    assert.ok(queryShop(index, defaultShopQuery("character")).length > 0);
    assert.equal(catalog.items.filter(item => item.category === 3).length, 3);
    await update([]); assert.equal(queryShop(index, defaultShopQuery("kartBody")).length, 3);
    const closed = new ShopApiError("VEHICLE_DISABLED", 409);
    assert.equal(closed.staleCatalog, true); assert.equal(closed.retryable, false);
    assert.match(shopErrorMessage("VEHICLE_DISABLED"), /车辆已关闭/);
  });
});
