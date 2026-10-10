import assert from "node:assert/strict";
import test from "node:test";

import { clearAccountSession, installAccountSession } from "../account/account-runtime";
import { BrowserAccountSession } from "../account/browser-session";
import { accountService, TEST_ORIGIN, TEST_TOKEN } from "../account/account-test-fixtures";
import type { ShopOpenOptions, ShopPreviewRequest } from "../shop/shop-view";
import type { GarageCardItem } from "../ui/garage-live-panel-assets";
import { closeReadyShop, openReadyShop, type ReadyShopController } from "./ready-shop";
import {
  createShopPreview, SHOP_PREVIEW_CATEGORIES, SHOP_STAGE_CATEGORIES, ShopSnapshotPreview,
  type ShopRiderSelection, type ShopSnapshotBackend, type ShopSnapshotPreviewOptions,
  type ShopStageSession,
} from "./shop-preview";
import {
  garageCardFor, GarageShopSnapshots, poseStageCamera, SHOP_STAGE_CAMERA, snapshotSize, STAGE_CAMERA_ZOOM,
  stagePreviewSelection,
  type GarageShopCatalog, type GarageShopPanels,
} from "./shop-preview-garage";
import type { GaragePreviewSelection } from "../ui/garage-live-panel-assets";

function request(itemId: number, size: ShopPreviewRequest["size"] = "card",
  category = 3): ShopPreviewRequest {
  return { category, itemId, kind: category === 3 ? "kart" : "character",
    internalId: `item${itemId}`, name: `Item ${itemId}`, size };
}

const host = (name: string) => ({ name }) as unknown as HTMLElement;
const signal = () => new AbortController().signal;
const tick = () => new Promise(resolve => setImmediate(resolve));

interface Call {
  request: ShopPreviewRequest;
  signal: AbortSignal;
  resolve(value: string | undefined): void;
  reject(error: Error): void;
}

class FakeBackend implements ShopSnapshotBackend<string> {
  readonly calls: Call[] = [];
  disposed = 0;
  snapshot(request: ShopPreviewRequest, signal: AbortSignal): Promise<string | undefined> {
    return new Promise((resolve, reject) => this.calls.push({ request, signal, resolve, reject }));
  }
  dispose(): void { this.disposed++; }
}

function harness(options: Partial<ShopSnapshotPreviewOptions<string>> = {}) {
  const backend = new FakeBackend();
  const events: unknown[] = [];
  let loads = 0;
  const preview = new ShopSnapshotPreview<string>({
    loadBackend: async () => { loads++; return backend; },
    present: (snapshot, target) => {
      const name = (target as unknown as { name: string }).name;
      events.push(["present", snapshot, name]);
      return () => events.push(["remove", snapshot, name]);
    },
    release: snapshot => events.push(["release", snapshot]),
    ...options,
  });
  return { backend, events, preview, loads: () => loads };
}

test("cards showing the same picture share one snapshot; later pages use the cache", async () => {
  const { backend, events, preview, loads } = harness();
  const first = preview.render(request(7), host("a"), signal());
  const second = preview.render(request(7), host("b"), signal());
  await tick();
  assert.equal(backend.calls.length, 1);
  assert.deepEqual(backend.calls[0]!.request, request(7));
  backend.calls[0]!.resolve("kart-7");
  const [cleanup] = await Promise.all([first, second]);
  assert.deepEqual(events, [["present", "kart-7", "a"], ["present", "kart-7", "b"]]);
  assert.equal(typeof cleanup, "function");
  (cleanup as () => void)();
  assert.deepEqual(events.at(-1), ["remove", "kart-7", "a"]);

  await preview.render(request(7), host("c"), signal());
  assert.equal(backend.calls.length, 1, "drawn once per (category, itemId, size)");
  assert.deepEqual(events.at(-1), ["present", "kart-7", "c"]);
  void preview.render(request(7, "detail"), host("detail"), signal());
  void preview.render(request(7, "card", 1), host("rider"), signal());
  await tick();
  assert.deepEqual(backend.calls.map(call => [call.request.category, call.request.size]),
    [[3, "card"], [3, "detail"], [1, "card"]]);
  assert.equal(loads(), 1, "one shared backend");
});

test("a card leaving the page aborts its snapshot when nobody else waits", async () => {
  const { backend, events, preview } = harness();
  const abort = new AbortController();
  const pending = preview.render(request(1), host("a"), abort.signal);
  await tick();
  const call = backend.calls[0]!;
  abort.abort();
  assert.equal(await pending, undefined);
  assert.equal(call.signal.aborted, true);
  assert.deepEqual(preview.pendingKeys, []);
  call.resolve(undefined);
  await tick();
  assert.deepEqual(preview.cachedKeys, [], "an aborted miss is not remembered");
  assert.deepEqual(events, []);

  void preview.render(request(1), host("b"), signal());
  await tick();
  assert.equal(backend.calls.length, 2, "the next visit draws again");
});

test("a snapshot keeps going while another card still waits for it", async () => {
  const { backend, events, preview } = harness();
  const card = new AbortController();
  const first = preview.render(request(2), host("card"), card.signal);
  const second = preview.render(request(2), host("again"), signal());
  await tick();
  card.abort();
  assert.equal(await first, undefined);
  assert.equal(backend.calls[0]!.signal.aborted, false);
  backend.calls[0]!.resolve("kart-2");
  assert.equal(typeof await second, "function");
  assert.deepEqual(events, [["present", "kart-2", "again"]]);
});

test("nothing loads for aborted or unsupported requests", async () => {
  const { backend, preview, loads } = harness({ supports: item => item.category === 3 });
  const abort = new AbortController();
  abort.abort();
  assert.equal(await preview.render(request(3), host("a"), abort.signal), undefined);
  assert.equal(await preview.render(request(3, "card", 21), host("pet"), signal()), undefined);
  await tick();
  assert.equal(loads(), 0);
  assert.equal(backend.calls.length, 0);
});

test("failures and items without a picture keep the icon and are not retried", async () => {
  const { backend, events, preview } = harness();
  const broken = preview.render(request(4), host("a"), signal());
  await tick();
  backend.calls[0]!.reject(new Error("broken model"));
  assert.equal(await broken, undefined);
  assert.equal(await preview.render(request(4), host("b"), signal()), undefined);
  const missing = preview.render(request(5), host("c"), signal());
  await tick();
  backend.calls[1]!.resolve(undefined);
  assert.equal(await missing, undefined);
  assert.equal(await preview.render(request(5), host("d"), signal()), undefined);
  assert.equal(backend.calls.length, 2);
  assert.deepEqual(preview.cachedKeys, ["3:4:card", "3:5:card"]);
  assert.deepEqual(events, []);
});

test("a backend that cannot start (no WebGL) leaves every card on its icon", async () => {
  let loads = 0;
  const preview = new ShopSnapshotPreview<string>({
    loadBackend: async () => { loads++; throw new Error("WebGL unavailable"); },
    present: () => { throw new Error("must not draw"); },
  });
  assert.equal(await preview.render(request(1), host("a"), signal()), undefined);
  assert.equal(await preview.render(request(2), host("b"), signal()), undefined);
  assert.equal(loads, 1);
  preview.dispose();
});

test("the snapshot cache is bounded and releases what it evicts", async () => {
  const { backend, events, preview } = harness({ cacheSize: 2 });
  const draw = async (itemId: number) => {
    const pending = preview.render(request(itemId), host(String(itemId)), signal());
    await tick();
    backend.calls.at(-1)!.resolve(`kart-${itemId}`);
    return pending;
  };
  await draw(1);
  await draw(2);
  await preview.render(request(1), host("again"), signal());
  await draw(3);
  assert.deepEqual(preview.cachedKeys, ["3:1:card", "3:3:card"]);
  assert.deepEqual(events.filter(event => (event as unknown[])[0] === "release"), [["release", "kart-2"]]);
});

test("dispose aborts pending snapshots, releases the cache and the backend once", async () => {
  const { backend, events, preview } = harness();
  const drawn = preview.render(request(1), host("a"), signal());
  await tick();
  backend.calls[0]!.resolve("kart-1");
  await drawn;
  const pending = preview.render(request(2), host("b"), signal());
  await tick();
  const call = backend.calls[1]!;
  preview.dispose();
  preview.dispose();
  assert.equal(call.signal.aborted, true);
  assert.equal(await pending, undefined, "waiters do not hang on the backend");
  call.resolve("late");
  await tick();
  assert.equal(backend.disposed, 1);
  assert.deepEqual(events.filter(event => (event as unknown[])[0] === "release"),
    [["release", "kart-1"], ["release", "late"]]);
  assert.deepEqual(preview.cachedKeys, []);
  assert.equal(await preview.render(request(1), host("c"), signal()), undefined);
  assert.equal(backend.calls.length, 2, "no work after dispose");
});

test("a backend still loading when the shop closes is disposed when it arrives", async () => {
  const backend = new FakeBackend();
  let arrive!: (value: FakeBackend) => void;
  const preview = new ShopSnapshotPreview<string>({
    loadBackend: () => new Promise(resolve => { arrive = resolve; }),
    present: () => () => {},
  });
  const pending = preview.render(request(1), host("a"), signal());
  await tick();
  preview.dispose();
  assert.equal(await pending, undefined);
  arrive(backend);
  await tick();
  assert.equal(backend.disposed, 1);
  assert.equal(backend.calls.length, 0);
});

test("the shop's preview is lazy: creating and disposing it loads nothing", () => {
  const preview = createShopPreview({ name: "library" });
  assert.equal(SHOP_PREVIEW_CATEGORIES.has(3), true);
  assert.equal(SHOP_PREVIEW_CATEGORIES.has(1), true);
  assert.equal(SHOP_PREVIEW_CATEGORIES.has(21), false, "pets keep the icon");
  preview.dispose();
});

// --- Garage backend ------------------------------------------------------

const catalog: GarageShopCatalog = {
  karts: [
    { kind: "kart", itemId: 12, path: "kart_/a/model.1s", title: "A", internalId: "kartA",
      identityClass: "catalog-vehicle" },
    { kind: "kart", itemId: 12, path: "kart_/b/model.1s", title: "B", internalId: "kartB",
      identityClass: "catalog-vehicle" },
    { kind: "kart", itemId: 13, path: "kart_/c/model.1s", title: "C", internalId: "kartC",
      identityClass: "catalog-vehicle" },
  ],
  characters: [
    { kind: "character", itemId: 5, path: "character_/dao/model.1s", title: "Dao",
      internalId: "dao", identityClass: "catalog-character" },
  ],
  equipment: [
    { kind: "flyingPet", category: 52, itemId: 9, internalId: "bee", title: "Bee" },
    { kind: "pet", category: 21, itemId: 9, internalId: "dog", title: "Dog" },
  ],
};

test("shop items map onto the garage catalog's cards", () => {
  assert.equal(garageCardFor(catalog, { ...request(12), internalId: "KARTB" })?.path, "kart_/b/model.1s");
  assert.equal(garageCardFor(catalog, { ...request(12), internalId: "other" })?.path, "kart_/a/model.1s");
  assert.equal(garageCardFor(catalog, request(5, "card", 1))?.kind, "character");
  assert.equal(garageCardFor(catalog, { ...request(9, "card", 52), internalId: "bee" })?.kind, "flyingPet");
  assert.equal(garageCardFor(catalog, request(9, "card", 21)), undefined, "no garage card loader for pets");
  assert.equal(garageCardFor(catalog, request(99)), undefined);
  assert.equal(garageCardFor(catalog, request(0)), undefined);
  // The original ItemWindows: shopCard item 180×115, shopCardTip 125×125, mqBuyItem 220×150.
  assert.deepEqual(snapshotSize("card"), { width: 180, height: 115 });
  assert.deepEqual(snapshotSize("dialog"), { width: 220, height: 150 });
  assert.deepEqual(snapshotSize("detail"), { width: 125, height: 125 });
});

class FakePanels implements GarageShopPanels {
  readonly events: unknown[] = [];
  readonly synced: string[][] = [];
  readonly renderer = {
    domElement: { width: 0, height: 0 } as HTMLCanvasElement,
    outputColorSpace: undefined as unknown,
    autoClear: false,
    setClearColor() {},
    setPixelRatio: (ratio: number) => { this.ratio = ratio; },
    getPixelRatio: () => this.ratio,
    setSize: (width: number, height: number) => {
      this.renderer.domElement.width = width * this.ratio;
      this.renderer.domElement.height = height * this.ratio;
    },
    setScissorTest() {},
    setViewport() {},
    setScissor() {},
    clear: () => this.events.push("clear"),
    dispose: () => this.events.push("renderer.dispose"),
    forceContextLoss: () => this.events.push("renderer.contextLoss"),
  };
  readonly stageBinding = { beginFrame: () => this.events.push("beginFrame") };
  ratio = 1;
  pixelRatio = 1;
  directFrame?: unknown;
  readonly characters = new Map<number, { scene: unknown; character: { update(): void } }>();
  readonly karts = new Map<string, unknown>();
  readonly equipment = new Map<string, unknown>();
  readonly characterFailed = new Set<number>();
  readonly kartFailed = new Set<string>();
  readonly equipmentFailed = new Set<string>();
  onReady = () => {};

  syncCards(items: GarageCardItem[]): void {
    this.synced.push(items.map(item => `${item.kind}:${item.itemId}`));
    const karts = new Set(items.filter(item => item.kind === "kart").map(item => `catalog:3:${item.itemId}`));
    for (const key of [...this.karts.keys()]) if (!karts.has(key)) this.karts.delete(key);
  }
  load(itemId: number, ok = true): void {
    if (ok) this.karts.set(`catalog:3:${itemId}`, { itemId });
    else this.kartFailed.add(`catalog:3:${itemId}`);
    this.onReady();
  }
  renderKartCard(_time: number, height: number, item: GarageCardItem,
    rectangle: unknown, zoom?: number, shadow?: boolean): void {
    this.events.push(["kart", item.itemId, height, rectangle, zoom, shadow]);
  }
  renderEquipmentCard(): void { this.events.push("equipment"); }
  setViewport(): void {}
  submitScene(): void { this.events.push("submit"); }
  dispose(): void { this.events.push("panels.dispose"); }
}

function garage() {
  const panels = new FakePanels();
  const owned: string[] = [];
  const copies: unknown[] = [];
  const snapshots = new GarageShopSnapshots(catalog, panels,
    [{ dispose: () => owned.push("binding") }, { dispose: () => owned.push("environment") }],
    () => ({
      width: 0, height: 0,
      getContext: () => ({ drawImage: (source: unknown) => copies.push(source) }),
    }) as unknown as HTMLCanvasElement);
  panels.onReady = () => snapshots.changed();
  return { panels, owned, copies, snapshots };
}

test("the garage backend draws a loaded kart card once and keeps it for the detail picture", async () => {
  const { panels, copies, snapshots } = garage();
  const pending = snapshots.snapshot(request(13), signal());
  assert.deepEqual(panels.synced.at(-1), ["kart:13"]);
  panels.load(13);
  const snapshot = await pending;
  assert.equal(snapshot?.width, 180);
  assert.equal(snapshot?.height, 115);
  assert.equal(snapshot?.canvas.width, 180);
  assert.deepEqual(copies, [panels.renderer.domElement]);
  assert.deepEqual(panels.events.filter(event => Array.isArray(event)),
    [["kart", 13, 115, { x: 0, y: 0, width: 180, height: 115 }, undefined, true]]);
  assert.deepEqual(snapshots.loadedKeys, ["kart|catalog:3:13"], "kept for a quick detail picture");
  assert.equal(await snapshots.snapshot(request(99), signal()), undefined);
});

test("the garage backend gives up on failures, aborts and dispose without drawing", async () => {
  const { panels, owned, snapshots } = garage();
  const failed = snapshots.snapshot(request(13), signal());
  panels.load(13, false);
  await assert.rejects(failed);
  assert.deepEqual(panels.synced.at(-1), [], "failed models are not kept");

  const abort = new AbortController();
  const aborted = snapshots.snapshot(request(12), abort.signal);
  abort.abort();
  await assert.rejects(aborted);
  assert.deepEqual(panels.synced.at(-1), []);

  const closing = snapshots.snapshot({ ...request(12), internalId: "kartA" }, signal());
  snapshots.dispose();
  snapshots.dispose();
  await assert.rejects(closing);
  assert.equal(panels.events.some(event => Array.isArray(event)), false, "nothing was drawn");
  assert.deepEqual(panels.events.filter(event => typeof event === "string" && event !== "clear"),
    ["panels.dispose", "renderer.contextLoss"]);
  assert.deepEqual(owned, ["binding", "environment"]);
});

test("a blank picture or a lost WebGL context keeps the icon", async () => {
  const panels = new FakePanels();
  let alpha = 0;
  const snapshots = new GarageShopSnapshots(catalog, panels, [], () => ({
    width: 0, height: 0,
    getContext: () => ({
      drawImage() {},
      getImageData: (_x: number, _y: number, width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4).fill(alpha),
      }),
    }),
  }) as unknown as HTMLCanvasElement);
  panels.onReady = () => snapshots.changed();
  const blank = snapshots.snapshot(request(13), signal());
  panels.load(13);
  assert.equal(await blank, undefined);
  assert.deepEqual(snapshots.loadedKeys, [], "a model that draws nothing is not kept");

  alpha = 255;
  const pending = snapshots.snapshot(request(13, "dialog"), signal());
  panels.load(13);
  assert.equal((await pending)?.width, 220);

  Object.assign(panels.renderer, { getContext: () => ({ isContextLost: () => true }) });
  await assert.rejects(snapshots.snapshot(request(13), signal()), /WebGL/);
  snapshots.dispose();
});

test("the garage backend keeps at most a page and a few drawn models loaded", async () => {
  const many: GarageShopCatalog = {
    ...catalog,
    karts: Array.from({ length: 20 }, (_, index) => ({ kind: "kart", itemId: index + 1,
      path: `kart_/k${index}/model.1s`, title: `K${index}`, internalId: `k${index}`,
      identityClass: "catalog-vehicle" })),
  };
  const panels = new FakePanels();
  const snapshots = new GarageShopSnapshots(many, panels, [], () => ({
    width: 0, height: 0, getContext: () => ({ drawImage() {} }),
  }) as unknown as HTMLCanvasElement);
  panels.onReady = () => snapshots.changed();
  for (let itemId = 1; itemId <= 20; itemId++) {
    const pending = snapshots.snapshot(request(itemId), signal());
    panels.load(itemId);
    await pending;
  }
  assert.equal(snapshots.loadedKeys.length, 12);
  assert.equal(snapshots.loadedKeys[0], "kart|catalog:3:9");
  assert.equal(Math.max(...panels.synced.map(keys => keys.length)) <= 12, true);
  snapshots.dispose();
});

// --- The shop stage (3D rider) ----------------------------------------------

const RIDER: ShopRiderSelection = {
  vehicleItemId: 12, vehiclePath: "KART_/B/model.1s", characterItemId: 5,
  characterPath: "character_/dao/model.1s",
  equipment: { itemIds: { 1: 5, 2: 6, 3: 12, 70: 4 }, kartSerial: 3, systemKart: "x", valueAt3E: 0, exceedType: 0 },
  garage: { parts: true }, initial: "AB",
};

test("the stage wears tried-on items over the rider's own kart, character and equipment", () => {
  const base = stagePreviewSelection(catalog, RIDER, [])!;
  assert.equal(base.kart.path, "kart_/b/model.1s", "the exact Ready kart");
  assert.equal(base.character.itemId, 5);
  assert.equal(base.selection.equipment.kartSerial, 3);
  assert.equal(base.selection.equipment.itemIds[2], 6);
  assert.equal(base.selection.equipment.itemIds[9], 0, "every slot is present for the preview loader");
  assert.deepEqual([base.selection.garage, base.selection.initial], [{ parts: true }, "AB"]);
  const tried = stagePreviewSelection(catalog, RIDER, [request(13), { ...request(9, "card", 52), kind: "flyingPet",
    internalId: "bee" }, { ...request(77, "card", 2), kind: "color" }])!;
  assert.equal(tried.kart.itemId, 13);
  assert.equal(tried.selection.equipment.itemIds[3], 13);
  assert.equal(tried.selection.equipment.kartSerial, 0, "another kart has no serial");
  assert.equal((tried.selection.equipment as { systemKart?: string }).systemKart, undefined);
  assert.equal(tried.selection.equipment.itemIds[52], 9);
  assert.equal(tried.selection.equipment.itemIds[2], 6, "an item the garage has no card for is not worn");
  assert.equal(stagePreviewSelection(catalog, { ...RIDER, vehicleItemId: 99 }, []), undefined);
  assert.equal(SHOP_STAGE_CATEGORIES.has(21), false, "pets are not worn");
});

class StagePanels extends FakePanels {
  readonly previews: string[] = [];
  readonly previewCamera = { zoom: 1, updates: 0, updateProjectionMatrix() { this.updates++; } };
  preview?: unknown;
  previewKey?: string;
  previewGeneration = 0;
  syncPreview(kart: GarageCardItem, rider: GarageCardItem, selection: GaragePreviewSelection): void {
    this.previews.push(`${kart.itemId}/${rider.itemId}/${selection.equipment.itemIds[52]}`);
    this.preview = {};
  }
  disposePreview(): void { this.events.push("disposePreview"); this.preview = undefined; }
  setPreviewSize(width: number, height: number, preset?: string): void {
    this.events.push(["size", width, height, preset]);
  }
  renderPreview(_time: number, height: number): void { this.events.push(["preview", height]); }
  rotatePreview(delta: number): void { this.events.push(["rotate", delta]); }
}

test("the garage backend draws the stage rider every frame with one renderer and stops on dispose", () => {
  const panels = new StagePanels();
  const snapshots = new GarageShopSnapshots(catalog, panels, [], () => ({
    width: 0, height: 0, getContext: () => ({ drawImage() {} }) }) as unknown as HTMLCanvasElement);
  const frames: Array<(time: number) => void> = [];
  const cancelled: number[] = [];
  const saved = { raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };
  globalThis.requestAnimationFrame = callback => frames.push(callback);
  globalThis.cancelAnimationFrame = id => { cancelled.push(id); };
  try {
    const draws: unknown[] = [];
    const canvas = {
      width: 0, height: 0,
      getBoundingClientRect: () => ({ width: 357, height: 310 }),
      getContext: () => ({ clearRect() {}, drawImage: (...args: unknown[]) => draws.push(args.slice(1)) }),
    } as unknown as HTMLCanvasElement;
    let firstFrames = 0;
    const session = snapshots.attachStage(canvas, RIDER, () => firstFrames++) as ShopStageSession;
    assert.ok(session);
    assert.deepEqual(panels.previews, ["12/5/0"]);
    frames.shift()!(16);
    frames.shift()!(32);
    assert.equal(firstFrames, 1, "the first drawn frame is reported once");
    assert.equal(canvas.width, 357);
    assert.ok(panels.events.some(event => Array.isArray(event) && event[0] === "size" && event[3] === "garage-x"));
    assert.ok(panels.events.some(event => Array.isArray(event) && event[0] === "preview" && event[1] === 310));
    assert.equal(panels.previewCamera.zoom, STAGE_CAMERA_ZOOM);
    assert.deepEqual(draws[0], [0, 0, 357, 310, 0, 0, 357, 310]);
    session.setTryOns([request(13), { ...request(9, "card", 52), kind: "flyingPet", internalId: "bee" }]);
    assert.deepEqual(panels.previews.at(-1), "13/5/9");
    session.rotate(12);
    assert.deepEqual(panels.events.at(-1), ["rotate", 12]);
    session.dispose();
    assert.ok(panels.events.includes("disposePreview"));
    assert.equal(panels.previewKey, undefined);
    assert.equal(cancelled.length, 1);
    session.setTryOns([request(12)]);
    assert.deepEqual(panels.previews.at(-1), "13/5/9", "a stopped stage changes nothing");
    // A rider the catalog does not have shows no stage; dispose stops running stages.
    assert.equal(snapshots.attachStage(canvas, { ...RIDER, characterItemId: 77 }), undefined);
    snapshots.attachStage(canvas, RIDER);
    snapshots.dispose();
    assert.equal(cancelled.length, 2);
  } finally {
    globalThis.requestAnimationFrame = saved.raf;
    globalThis.cancelAnimationFrame = saved.caf;
  }
});

test("the shop's stage keeps try-ons until the backend is ready, then hands them over", async () => {
  const sessions: Array<{ tried: string[]; disposed: boolean; rotated: number[] }> = [];
  let arrive!: (backend: ShopSnapshotBackend<string>) => void;
  const backend: ShopSnapshotBackend<string> = {
    snapshot: async () => undefined,
    attachStage: (_canvas, rider, firstFrame) => {
      assert.equal(rider, RIDER);
      firstFrame?.();
      const state = { tried: [] as string[], disposed: false, rotated: [] as number[] };
      sessions.push(state);
      return {
        setTryOns: items => { state.tried = items.map(item => `${item.category}:${item.itemId}`); },
        rotate: pixels => state.rotated.push(pixels),
        dispose: () => { state.disposed = true; },
      };
    },
    dispose() {},
  };
  const preview = new ShopSnapshotPreview<string>({
    loadBackend: () => new Promise(resolve => { arrive = resolve; }),
    present: () => () => {},
    rider: RIDER,
  });
  const appended: unknown[] = [];
  const canvas = { className: "", remove: () => appended.push("removed"), setAttribute() {} };
  const stageHost = {
    ownerDocument: { createElement: () => canvas },
    append: (node: unknown) => appended.push(node),
  } as unknown as HTMLElement;
  const stage = preview.stage(stageHost)!;
  assert.deepEqual(appended, [canvas]);
  assert.equal(stage.tryOn(request(13)), true);
  assert.equal(stage.tryOn({ ...request(9, "card", 21), kind: "pet" }), false, "pets are not worn");
  assert.equal(stage.tryOn(request(12)), true, "one kart at a time");
  stage.takeOff(request(13));
  await tick();
  arrive(backend);
  await tick();
  await stage.ready;
  assert.deepEqual(sessions[0]!.tried, ["3:12"]);
  stage.tryOn(request(5, "card", 1));
  assert.deepEqual(sessions[0]!.tried, ["3:12", "1:5"]);
  stage.rotate?.(4);
  assert.deepEqual(sessions[0]!.rotated, [4]);
  stage.reset();
  assert.deepEqual(sessions[0]!.tried, []);
  preview.dispose();
  assert.equal(sessions[0]!.disposed, true);
  assert.deepEqual(appended.at(-1), "removed");
  // Without a rider (or once disposed) there is no stage.
  assert.equal(createShopPreview({ name: "library" }).stage(stageHost), undefined);
  assert.equal(preview.stage(stageHost), undefined);
});

// --- Ready wiring --------------------------------------------------------

function shopController(): ReadyShopController {
  return {
    host: {
      root: { name: "root" } as unknown as HTMLElement,
      hud: { showDebugText() {} },
      shell: { current: "Ready", closeModal() {} },
      getLibrary: () => ({ name: "library" }),
      getSelection: () => undefined,
      getReadyOptions: () => ({ speed: 7 }) as never,
    },
    disposed: false,
    activeTimeAttackReady: { name: "ready" },
    enterTimeAttackReady: async () => undefined,
    openGarageX() {},
  };
}

test("Ready passes the shop item pictures and disposes them with the shop", async () => {
  const service = accountService();
  const session = new BrowserAccountSession({ backendOrigin: TEST_ORIGIN, token: TEST_TOKEN,
    fetch: service.fetch });
  await session.refresh();
  installAccountSession(session);
  try {
    const events: string[] = [];
    let created = 0;
    const factory = (library: unknown) => {
      assert.deepEqual(library, { name: "library" });
      const id = ++created;
      return { render() {}, dispose: () => events.push(`preview${id}.dispose`) };
    };
    let options: ShopOpenOptions | undefined;
    const opener = async (value: ShopOpenOptions) => {
      options = value;
      return { close: () => events.push("shop.close") };
    };

    // The player closes the shop.
    const ready = shopController();
    await openReadyShop(ready, undefined, opener, factory);
    assert.ok(options?.preview, "cards get pictures");
    options!.onClose();
    options!.onClose();
    assert.deepEqual(events, ["preview1.dispose"]);

    // Ready disposal closes it.
    events.length = 0;
    await openReadyShop(ready, undefined, opener, factory);
    closeReadyShop(ready);
    assert.deepEqual(events, ["shop.close", "preview2.dispose"]);

    // Opening fails.
    events.length = 0;
    await openReadyShop(ready, undefined, async () => { throw new Error("offline"); }, factory);
    assert.deepEqual(events, ["preview3.dispose"]);

    // Ready went away while the shop was opening.
    events.length = 0;
    const leaving = shopController();
    await openReadyShop(leaving, undefined, async value => {
      leaving.disposed = true;
      return opener(value);
    }, factory);
    assert.deepEqual(events, ["shop.close", "preview4.dispose"]);
    assert.equal(leaving.activeShop, undefined);

    // A broken preview factory still opens the shop, without pictures.
    const plain = shopController();
    await openReadyShop(plain, undefined, opener, () => { throw new Error("no previews"); });
    assert.equal(options?.preview, undefined);
    assert.ok(plain.activeShop);
  } finally {
    clearAccountSession();
  }
});

test("the stage camera looks at the rider from the front left and above, turned by the player's drag", () => {
  const calls: unknown[] = [];
  const camera = {
    zoom: 1,
    position: { set: (x: number, y: number, z: number) => calls.push(["position", x, y, z]) },
    lookAt: (x: number, y: number, z: number) => calls.push(["lookAt", x, y, z]),
    updateProjectionMatrix: () => calls.push("projection"),
  };
  poseStageCamera(camera, 0);
  const view = SHOP_STAGE_CAMERA;
  const [, x, y, z] = calls[0] as [string, number, number, number];
  // On the orbit: distance from the target, pitch above it.
  assert.ok(Math.abs(Math.hypot(x, y - view.targetY, z) - view.distance) < 1e-9);
  assert.ok(Math.abs(Math.asin((y - view.targetY) / view.distance) - view.pitch) < 1e-9);
  assert.ok(Math.abs(Math.atan2(x, z) - view.yaw) < 1e-9);
  assert.deepEqual(calls[1], ["lookAt", 0, view.targetY, 0]);
  assert.equal(camera.zoom, view.zoom);
  assert.equal(calls[2], "projection");
  calls.length = 0;
  poseStageCamera(camera, 0.5);
  const [, x2, , z2] = calls[0] as [string, number, number, number];
  assert.ok(Math.abs(Math.atan2(x2, z2) - (view.yaw + 0.5)) < 1e-9, "the drag turns the view");
  assert.equal(calls.length, 2, "the zoom is set once");
});
