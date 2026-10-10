import assert from "node:assert/strict";
import test from "node:test";

import { clearAccountSession, installAccountSession } from "../account/account-runtime";
import { BrowserAccountSession } from "../account/browser-session";
import { accountService, item, TEST_ORIGIN, TEST_TOKEN } from "../account/account-test-fixtures";
import type { ShopOpenOptions } from "../shop/shop-view";
import { setLobbyHomeBackdrop, setLobbyShopBackdrop } from "../ui/lobby-home-backdrop";
import { closeReadyShop, openReadyShop, SHOP_TASKBAR_HEIGHT, type ReadyShopController } from "./ready-shop";
import type { ShopRiderSelection } from "./shop-preview";

function controller(events: unknown[], garageX = false): ReadyShopController {
  const shell = { current: garageX ? "ReadyGarage" : "Ready",
    modal: garageX ? "garage" as string | undefined : undefined,
    closeModal: (name: string) => { events.push(["closeModal", name]); shell.modal = undefined; } };
  const value: ReadyShopController = {
    host: {
      root: { name: "root" } as unknown as HTMLElement,
      hud: { showDebugText: (message: string) => events.push(["debug", message]) },
      shell,
      getLibrary: () => ({ name: "library" }),
      getSelection: () => ({ vehicleItemId: 0 }),
      getReadyOptions: () => ({ speed: 7 }),
    },
    disposed: false,
    activeGarage: garageX ? { name: "garage-x" } : undefined,
    activeTimeAttackReady: garageX ? undefined : { name: "ready" },
    activeHome: { showNotice: message => events.push(["notice", message]) },
    enterTimeAttackReady: async () => {
      events.push("enterReady");
      value.activeGarage = undefined;
      value.activeTimeAttackReady = { name: "ready" };
    },
    openGarageX: (selection, options) => events.push(["openGarageX", selection, options]),
  };
  return value;
}

async function signedIn() {
  const service = accountService();
  const session = new BrowserAccountSession({ backendOrigin: TEST_ORIGIN, token: TEST_TOKEN,
    fetch: service.fetch });
  await session.refresh();
  installAccountSession(session);
  return { service, session };
}

test("the shop needs a signed-in account", async () => {
  clearAccountSession();
  const events: unknown[] = [];
  let opened = 0;
  await openReadyShop(controller(events), undefined, async () => { opened++; return { close() {} }; });
  assert.equal(opened, 0);
  assert.deepEqual(events[0], ["notice", "商店需要登录账号。"]);
});

test("the shop opens once with the session; purchases refresh the account", async () => {
  const { service, session } = await signedIn();
  try {
    const events: unknown[] = [];
    const ready = controller(events);
    let options: ShopOpenOptions | undefined;
    let opened = 0;
    const opener = async (value: ShopOpenOptions) => {
      opened++;
      options = value;
      return { close: () => events.push("shop.close") };
    };
    await Promise.all([openReadyShop(ready, "kartBody", opener), openReadyShop(ready, "equip", opener)]);
    assert.equal(opened, 1);
    assert.equal(options?.session, session);
    assert.equal(options?.initialTab, "kartBody");
    assert.deepEqual(options?.library, { name: "library" });
    assert.ok(ready.activeShop);
    const calls = service.calls.length;
    options!.onPurchased?.(item(3, 387, { expiresAt: Date.now() + 86_400_000 }));
    assert.equal(session.owns(3, 387), true);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.ok(service.calls.length > calls, "the account is re-read after a purchase");
    options!.onClose();
    assert.equal(ready.activeShop, undefined);
    assert.deepEqual(events, []);
    // Disposal closes an open shop.
    await openReadyShop(ready, undefined, opener);
    closeReadyShop(ready);
    assert.deepEqual(events, ["shop.close"]);
  } finally {
    clearAccountSession();
  }
});

test("purchases made over the full-screen garage reopen it", async () => {
  await signedIn();
  try {
    const events: unknown[] = [];
    const garage = controller(events, true);
    let options: ShopOpenOptions | undefined;
    await openReadyShop(garage, undefined, async value => { options = value; return { close() {} }; });
    options!.onPurchased?.(item(1, 3));
    options!.onClose();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(events, [["closeModal", "garage"], "enterReady",
      ["openGarageX", { vehicleItemId: 0 }, { speed: 7 }]]);
  } finally {
    clearAccountSession();
  }
});

test("a shop closed while it is still loading closes as soon as it opens", async () => {
  await signedIn();
  try {
    const events: unknown[] = [];
    const ready = controller(events);
    let resolve!: (handle: { close(): void }) => void;
    const pending = openReadyShop(ready, undefined, () => new Promise(done => { resolve = done; }));
    await new Promise(done => setTimeout(done, 0));
    assert.equal(ready.shopOpening, true);
    // A race starts (releaseReadyForRace) before the shop module has loaded.
    closeReadyShop(ready);
    resolve({ close: () => events.push("shop.close") });
    await pending;
    assert.deepEqual(events, ["shop.close"]);
    assert.equal(ready.activeShop, undefined);
    assert.equal(ready.shopOpening, false);
    // The next open is not affected.
    await openReadyShop(ready, undefined, async () => ({ close: () => events.push("shop.close.2") }));
    assert.ok(ready.activeShop);
    closeReadyShop(ready);
    assert.deepEqual(events, ["shop.close", "shop.close.2"]);
  } finally {
    clearAccountSession();
  }
});

test("the stage's rider comes from Ready and the profile; the lobby still is the backdrop", async () => {
  await signedIn();
  try {
    const events: unknown[] = [];
    const ready = controller(events);
    ready.host.getSelection = () => ({ vehicleItemId: 387, vehiclePath: "kart_/saber10/model.1s",
      characterItemId: 2, characterPath: "character_/dao/model.1s" });
    ready.host.getProfile = () => ({ equipment: { itemIds: { 1: 2, 3: 387 }, kartSerial: 1 },
      garage: { parts: [] }, initial: "KS" });
    const backdrop = { image: {} as CanvasImageSource, width: 1600, height: 900 };
    setLobbyHomeBackdrop(backdrop);
    let rider: ShopRiderSelection | undefined;
    let options: ShopOpenOptions | undefined;
    await openReadyShop(ready, undefined, async value => { options = value; return { close() {} }; },
      (_library, value) => { rider = value; return { render() {}, dispose() {} }; });
    assert.deepEqual(rider, { vehicleItemId: 387, vehiclePath: "kart_/saber10/model.1s",
      characterItemId: 2, characterPath: "character_/dao/model.1s",
      equipment: { itemIds: { 1: 2, 3: 387 }, kartSerial: 1 }, garage: { parts: [] }, initial: "KS" });
    assert.equal(options?.backdrop, backdrop);
    assert.equal(options?.taskbarHeight, undefined, "no taskbar on this page: the shop covers everything");
    options!.onClose();
  } finally {
    clearAccountSession();
  }
});

test("the taskbar stays under the shop: 상점 does nothing, another button closes the shop first", async () => {
  await signedIn();
  try {
    const events: unknown[] = [];
    const ready = controller(events);
    const listeners = new Set<(event: MouseEvent) => void>();
    const page = {
      addEventListener: (_type: string, listener: (event: MouseEvent) => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: MouseEvent) => void) => listeners.delete(listener),
    };
    const button = (name: string) => {
      const node = { dataset: { taskbarButton: name }, disabled: false, closest: () => node };
      return node;
    };
    const shop = button("상점"), home = button("gotoHome");
    ready.activeTaskbar = { element: { hidden: false, isConnected: true, ownerDocument: page,
      contains: (node: unknown) => node === shop || node === home } };
    let options: ShopOpenOptions | undefined;
    await openReadyShop(ready, undefined, async value => {
      options = value;
      return { close: () => events.push("shop.close") };
    }, () => ({ render() {}, dispose: () => events.push("preview.dispose") }));
    assert.equal(options?.taskbarHeight, SHOP_TASKBAR_HEIGHT);
    assert.equal(listeners.size, 1);
    const click = (target: unknown) => {
      let stopped = false;
      for (const listener of [...listeners])
        listener({ target, stopImmediatePropagation: () => { stopped = true; } } as unknown as MouseEvent);
      return stopped;
    };
    assert.equal(click(shop), true, "the taskbar's own 상점 handler does not run again");
    assert.ok(ready.activeShop);
    assert.equal(click({ closest: () => null }), false);
    click(home);
    assert.deepEqual(events, ["shop.close", "preview.dispose"]);
    assert.equal(ready.activeShop, undefined);
    assert.equal(listeners.size, 0, "the taskbar listener goes with the shop");
    options!.onClose();
    assert.deepEqual(events, ["shop.close", "preview.dispose"], "closing twice does nothing");
  } finally {
    clearAccountSession();
  }
});

/** A taskbar under the shop: its buttons, and the document its capture listener goes on. */
function fakeTaskbar(ready: ReadyShopController, names: string[]) {
  const listeners = new Set<(event: MouseEvent) => void>();
  const page = {
    addEventListener: (_type: string, listener: (event: MouseEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MouseEvent) => void) => listeners.delete(listener),
  };
  const buttons = new Map(names.map(name => {
    const node = { dataset: { taskbarButton: name }, disabled: false, closest: () => node };
    return [name, node];
  }));
  ready.activeTaskbar = { element: { hidden: false, isConnected: true, ownerDocument: page,
    contains: (node: unknown) => [...buttons.values()].includes(node as never) } };
  /** A click on a taskbar button; true when the taskbar's own handler is skipped. */
  const click = (name: string) => {
    let stopped = false;
    for (const listener of [...listeners])
      listener({ target: buttons.get(name), stopImmediatePropagation: () => { stopped = true; } } as unknown as MouseEvent);
    return stopped;
  };
  return { listeners, click };
}

test("车库 from the shop over GarageX closes the shop; after a purchase GarageX reopens to list it", async () => {
  await signedIn();
  try {
    // Nothing bought: the shop closes and GarageX, still open under it, shows again.
    let events: unknown[] = [];
    let garage = controller(events, true);
    let bar = fakeTaskbar(garage, ["상점", "파츠"]);
    let options: ShopOpenOptions | undefined;
    await openReadyShop(garage, undefined, async value => {
      options = value;
      return { close: () => events.push("shop.close") };
    }, () => ({ render() {}, dispose: () => events.push("preview.dispose") }));
    assert.equal(bar.click("파츠"), false, "the taskbar's own 车库 handler runs too");
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(events, ["shop.close", "preview.dispose"]);
    assert.equal(garage.activeShop, undefined);
    assert.equal(bar.listeners.size, 0);

    // Bought something: 车库 is the way back to the garage, so it reopens like the close button.
    events = [];
    garage = controller(events, true);
    bar = fakeTaskbar(garage, ["상점", "파츠"]);
    await openReadyShop(garage, undefined, async value => {
      options = value;
      return { close: () => events.push("shop.close") };
    }, () => ({ render() {}, dispose: () => events.push("preview.dispose") }));
    options!.onPurchased?.(item(1, 3));
    bar.click("파츠");
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(events, ["shop.close", "preview.dispose", ["closeModal", "garage"], "enterReady",
      ["openGarageX", { vehicleItemId: 0 }, { speed: 7 }]]);
    options!.onClose();
    assert.equal(events.length, 5, "a late close does nothing more");
  } finally {
    clearAccountSession();
  }
});

test("other taskbar buttons from the shop over GarageX close it without reopening GarageX", async () => {
  await signedIn();
  try {
    for (const name of ["gotoHome", "singleplay", "multiplay", "마이룸", "설정"]) {
      const events: unknown[] = [];
      const garage = controller(events, true);
      const bar = fakeTaskbar(garage, ["상점", name]);
      let options: ShopOpenOptions | undefined;
      await openReadyShop(garage, undefined, async value => {
        options = value;
        return { close: () => events.push("shop.close") };
      });
      options!.onPurchased?.(item(1, 3));
      assert.equal(bar.click(name), false, `${name}: the taskbar's own handler goes on`);
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.deepEqual(events, ["shop.close"], `${name} leaves for its own page`);
      assert.equal(garage.activeShop, undefined);
    }
  } finally {
    clearAccountSession();
  }
});

test("a taskbar button pressed while the shop is loading closes it as soon as it opens", async () => {
  await signedIn();
  try {
    const events: unknown[] = [];
    const garage = controller(events, true);
    const bar = fakeTaskbar(garage, ["상점", "파츠"]);
    let resolve!: (handle: { close(): void }) => void;
    const pending = openReadyShop(garage, undefined, () => new Promise(done => { resolve = done; }),
      () => ({ render() {}, dispose: () => events.push("preview.dispose") }));
    await new Promise(done => setTimeout(done, 0));
    assert.equal(garage.shopOpening, true);
    assert.equal(bar.click("상점"), true, "상점 still does nothing while the shop loads");
    bar.click("파츠");
    resolve({ close: () => events.push("shop.close") });
    await pending;
    assert.deepEqual(events, ["shop.close", "preview.dispose"]);
    assert.equal(garage.activeShop, undefined);
    assert.equal(bar.listeners.size, 0, "the taskbar listener goes with the shop");
    // The next open is not affected.
    await openReadyShop(garage, undefined, async () => ({ close: () => events.push("shop.close.2") }));
    assert.ok(garage.activeShop);
    assert.equal(bar.listeners.size, 1);
    closeReadyShop(garage);
    assert.equal(bar.listeners.size, 0);
  } finally {
    clearAccountSession();
  }
});

test("over the home lobby the shop keeps the live lobby: no backdrop or top bar of its own, the lobby steps aside until it closes", async () => {
  await signedIn();
  try {
    const events: unknown[] = [];
    const ready = controller(events);
    const lobby = { hidden: false, enterShop: () => { events.push("lobby.enterShop"); return () => events.push("lobby.restore"); } };
    ready.activeHome = { page: "home", lobby, showNotice: message => events.push(["notice", message]) };
    setLobbyHomeBackdrop({ image: {} as CanvasImageSource, width: 1600, height: 900 });
    let options: ShopOpenOptions | undefined;
    await openReadyShop(ready, undefined, async value => {
      options = value;
      return { close: () => events.push("shop.close") };
    });
    assert.equal(options?.overLobby, true);
    assert.equal(options?.backdrop, undefined);
    assert.equal(options?.topBar, undefined);
    assert.deepEqual(events, ["lobby.enterShop"]);
    options!.onClose();
    assert.deepEqual(events, ["lobby.enterShop", "lobby.restore"]);
    // Closed by the controller (a race starts): the lobby comes back too.
    events.length = 0;
    await openReadyShop(ready, undefined, async () => ({ close: () => events.push("shop.close") }));
    closeReadyShop(ready);
    assert.deepEqual(events, ["lobby.enterShop", "shop.close", "lobby.restore"]);
    // The 单人游戏 page or a hidden lobby: the shop is not over the lobby.
    for (const home of [{ page: "single", lobby }, { page: "home", lobby: { ...lobby, hidden: true } }]) {
      events.length = 0;
      ready.activeHome = { ...home, showNotice: () => {} };
      await openReadyShop(ready, undefined, async value => { options = value; return { close() {} }; });
      assert.equal(options?.overLobby, undefined);
      assert.equal(typeof options?.topBar, "function");
      assert.deepEqual(events, []);
      options!.onClose();
    }
  } finally {
    clearAccountSession();
  }
});

test("away from the lobby the shop draws the lobby top bar and its last frame without the rider", async () => {
  await signedIn();
  try {
    const events: unknown[] = [];
    const ready = controller(events, true);
    const still = { image: {} as CanvasImageSource, width: 960, height: 500 };
    setLobbyShopBackdrop(still);
    let options: ShopOpenOptions | undefined;
    await openReadyShop(ready, undefined, async value => { options = value; return { close() {} }; });
    assert.equal(options?.overLobby, undefined);
    assert.equal(options?.backdrop, still, "the frame without the lobby's rider");
    assert.equal(typeof options?.topBar, "function");
    options!.onClose();
  } finally {
    clearAccountSession();
  }
});
