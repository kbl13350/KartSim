import assert from "node:assert/strict";
import test from "node:test";

import {
  accountProfileSync, clearAccountSession, installAccountSession, recordProfileLoad,
} from "../account/account-runtime";
import type { InventoryItem } from "../account/account-session";
import {
  accountService, item, summaryFixture, TEST_ORIGIN, TEST_TOKEN,
} from "../account/account-test-fixtures";
import { BrowserAccountSession } from "../account/browser-session";
import { FakeDocument, type FakeElement } from "../ui/fake-dom";
import { defaultLocalProfile } from "../ui/local-profile";
import {
  accountNeedsRiderRegistration, registerAccountRider, repairAccountEquipment,
  PROFILE_NOT_SAVED_MESSAGE, retryStartupProfile, sanitizeStartupProfile,
  setAccountProfileWriter, type AccountStartupHost,
} from "./account-startup";
import { AccountServiceError } from "../account/account-api";
import { resolveStartupSelection } from "./boot-support";
import {
  loadStartupResources, type RiderCatalog, type RiderProfile, type StartupHost,
  type StartupLibrary,
} from "./startup-resources";

const catalog: RiderCatalog = {
  karts: [
    { itemId: 387, title: "尖锋6.5", path: "kart_/saber10/model.1s" },
    { itemId: 0, systemKey: "practiceKart", title: "练习用卡丁车 V1", path: "kart_/practiceV1/model.1s" },
  ],
  characters: [
    { itemId: 2, title: "皮蛋", path: "character_/dao/model.1s" },
    { itemId: 3, title: "黑妞", path: "character_/dizni/model.1s" },
    { itemId: 4, title: "其他", path: "character_/other/model.1s" },
  ],
  equipment: [1, 4, 5, 6, 7].flatMap(itemId => [
    { kind: "color", itemId, title: `喷漆${itemId}` },
    { kind: "dye", itemId, title: `染色${itemId}` },
  ]),
};

async function signIn(onboarded: boolean, inventory: InventoryItem[] = [],
  configure?: (service: ReturnType<typeof accountService>) => void) {
  const service = accountService(summaryFixture({ onboarded }), inventory);
  configure?.(service);
  const session = new BrowserAccountSession({ backendOrigin: TEST_ORIGIN, token: TEST_TOKEN,
    fetch: service.fetch });
  await session.refresh();
  installAccountSession(session);
  return { service, session };
}

function profile(itemIds: Record<number, number>): RiderProfile {
  const base = defaultLocalProfile();
  return { ...base, equipment: { ...base.equipment, itemIds: { ...base.equipment.itemIds, ...itemIds } } };
}

const selectionOps = {
  defaultProfile: () => defaultLocalProfile(),
  resolveSystemKart: () => undefined,
  isSpecialKartId: () => false,
  displayKartName: () => "",
  startTrack: { mapPath: "track_/village_R01/track.1s", trackId: "village_R01" },
};

test("without an account the startup profile is untouched", () => {
  clearAccountSession();
  const saved: RiderProfile[] = [];
  const value = profile({});
  assert.equal(sanitizeStartupProfile(value, catalog, next => saved.push(next)), value);
  assert.equal(accountNeedsRiderRegistration(), false);
});

test("a fresh account starts on the practice kart and the default starter rider", async () => {
  await signIn(false);
  try {
    const saved: RiderProfile[] = [];
    const next = sanitizeStartupProfile(profile({ 8: 9 }), catalog, value => saved.push(value));
    assert.deepEqual([next.equipment.itemIds[3], next.equipment.itemIds[1],
      next.equipment.itemIds[2], next.equipment.itemIds[70], next.equipment.itemIds[8]],
    [0, 2, 4, 4, 0]);
    assert.equal(next.equipment.systemKart, "practiceKart");
    // Nothing is written before the starter kit is claimed.
    assert.deepEqual(saved, []);
    assert.equal(accountNeedsRiderRegistration(), true);
    const startup = resolveStartupSelection(catalog as never, [{ path: "track_/village_R01/track.1s" }],
      next as never, selectionOps);
    assert.equal(startup.selection.vehicleSystemKey, "practiceKart");
    assert.equal(startup.selection.characterItemId, 2);
  } finally {
    clearAccountSession();
  }
});

test("an expired rental falls back and the corrected profile is saved", async () => {
  await signIn(true, [item(3, 0, { systemKey: "practiceKart", source: "starter" }),
    item(1, 3, { source: "starter" }), item(2, 6, { source: "starter" }),
    item(70, 7, { source: "starter" }), item(3, 387, { expiresAt: Date.now() - 1000 })]);
  try {
    const saved: RiderProfile[] = [];
    const next = sanitizeStartupProfile(profile({ 1: 3, 2: 6, 3: 387, 70: 7 }), catalog,
      value => saved.push(value));
    assert.equal(next.equipment.itemIds[3], 0);
    assert.equal(next.equipment.itemIds[1], 3);
    assert.deepEqual(saved, [next]);
  } finally {
    clearAccountSession();
  }
});

async function until(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200 && !check(); attempt++)
    await new Promise(resolve => setTimeout(resolve, 1));
  assert.ok(check(), "condition not reached");
}

test("onboarding: starter-only choices, nickname change, starter claim and Ready rebuild", async () => {
  let claimed = false;
  const { service, session } = await signIn(false, [], service => {
    service.on("GET /api/account", () => ({ status: 200,
      body: summaryFixture({ onboarded: claimed, nickname: claimed ? "新车手" : "车手甲" }) }));
    service.on("GET /api/inventory", () => ({ status: 200, body: { items: claimed ? [
      item(3, 0, { systemKey: "practiceKart", source: "starter" }),
      item(1, 3, { source: "starter" }), item(2, 6, { source: "starter" }),
      item(70, 7, { source: "starter" }),
    ] : [] } }));
    service.on("POST /multiplayer/auth/nickname", call =>
      (call.body as { nickname: string }).nickname === "已占用"
        ? { status: 409, body: { error: "NICKNAME_TAKEN" } } : { status: 200, body: { account: {} } });
    service.on("POST /api/account/starter", () => { claimed = true; return { status: 200, body: {} }; });
  });
  try {
    const document = new FakeDocument();
    const events: unknown[] = [];
    const opens: unknown[] = [];
    const choices = [
      { name: "已占用", characterItemId: 3, paintItemId: 6, dyeItemId: 7 },
      { name: "新车手", characterItemId: 3, paintItemId: 6, dyeItemId: 7 },
    ];
    let dialogOptions: unknown;
    const host: AccountStartupHost = {
      root: { ownerDocument: document } as unknown as HTMLElement,
      hud: { showDebugText: message => events.push(["debug", message]) },
      userProfile: profile({ 1: 2, 2: 4, 3: 0, 70: 4 }),
      localNickname: "",
      rhoLibrary: { timeAttackGarageCatalog: async () => catalog } as unknown as StartupLibrary,
      shell: { current: "Ready" },
      session: { selection: { trackId: "village_R01", mapPath: "track_/village_R01/track.1s",
        vehicleItemId: 0, vehiclePath: "kart_/practiceV1/model.1s", vehicleSystemKey: "practiceKart",
        characterItemId: 2, characterPath: "character_/dao/model.1s" }, vehicleTitle: "" },
      toonStageBinding: { retain: () => events.push("retain") },
      enterTimeAttackReady: async () => { events.push("enterReady"); },
    };
    const pending = registerAccountRider(host, {
      loadEnvironment: async () => ({ dispose: () => events.push("environment.dispose") }),
      loadDialog: async (_library, _root, options, context) => {
        dialogOptions = { ...options, kart: (context.kartItem as { systemKey?: string }).systemKey };
        return {
          open: async (value?: { name?: string; maxLength?: number }) => {
            opens.push(value);
            return choices.shift()!;
          },
          dispose: () => events.push("dialog.dispose"),
        };
      },
      saveProfile: value => events.push(["saveProfile", value.equipment.itemIds[3],
        value.equipment.itemIds[1], value.equipment.itemIds[2], value.equipment.itemIds[70]]),
      saveNickname: name => events.push(["saveNickname", name]),
    });
    // The taken nickname is reported; 重新填写 reopens the dialog.
    await until(() => document.body.children.length > 0);
    const message = document.body.children[0]!;
    assert.match(message.text(), /昵称已被使用/);
    const retry = message.querySelectorAll("button")[0] as FakeElement;
    retry.click();
    await pending;

    assert.deepEqual(dialogOptions, {
      characters: [{ itemId: 2, title: "皮蛋" }, { itemId: 3, title: "黑妞" }],
      paints: [4, 5, 6, 7].map(itemId => ({ itemId, title: `喷漆${itemId}` })),
      dyes: [4, 5, 6, 7].map(itemId => ({ itemId, title: `染色${itemId}` })),
      defaults: { character: 2, paint: 4, dye: 4 },
      kart: "practiceKart",
    });
    assert.deepEqual(opens, [{ name: "车手甲", maxLength: 16 }, { name: "已占用", maxLength: 16 }]);
    assert.deepEqual(service.calls.filter(call => call.method === "POST").map(call => [call.path, call.body]), [
      ["/multiplayer/auth/nickname", { nickname: "已占用" }],
      ["/multiplayer/auth/nickname", { nickname: "新车手" }],
      ["/api/account/starter", { character: 3, paint: 6, dye: 7 }],
    ]);
    assert.equal(session.summary()?.onboarded, true);
    assert.equal(host.userProfile.equipment.systemKart, "practiceKart");
    assert.equal(host.localNickname, "新车手");
    assert.equal(host.session.selection?.characterPath, "character_/dizni/model.1s");
    assert.deepEqual(events.filter(event => event !== "retain"), [
      ["saveProfile", 0, 3, 6, 7], ["saveNickname", "新车手"], "enterReady",
      "dialog.dispose", "environment.dispose",
    ]);
  } finally {
    clearAccountSession();
  }
});

test("an onboarded account keeps its name when the first-rider dialog is asked for again", async () => {
  await signIn(true);
  try {
    const events: unknown[] = [];
    const host = {
      root: { ownerDocument: new FakeDocument() }, hud: { showDebugText: (message: string) => events.push(message) },
      localNickname: "", userProfile: profile({}), session: { vehicleTitle: "" },
      toonStageBinding: { retain() {} }, enterTimeAttackReady: async () => {},
    } as unknown as AccountStartupHost;
    await registerAccountRider(host, {
      loadEnvironment: async () => { throw new Error("must not load"); },
      loadDialog: async () => { throw new Error("must not load"); },
      saveProfile: () => {}, saveNickname: () => {},
    });
    assert.equal(host.localNickname, "车手甲");
    assert.equal(events.length, 1);
  } finally {
    clearAccountSession();
  }
});

test("startup signs in before the profile loads and asks the account about onboarding", async () => {
  const events: string[] = [];
  const library: StartupLibrary = {
    files: ["file"], archives: ["archive"], errors: [], warnings: [],
    timeAttackGarageCatalog: async () => { events.push("catalog"); return catalog; },
    mapCatalog: async () => [],
    trackMetadata: async () => ({}),
  };
  const host = {
    assets: { beginGeneration: () => 1, isCurrent: () => true, install: () => events.push("install") },
    hud: { chooseResourceSource: async () => undefined, setLoadingProgress: () => {},
      showDebugText: () => {}, finishLoading: () => events.push("finishLoading"),
      showLoadingError: (message: string) => events.push(`error:${message}`) },
    userProfile: profile({}), session: { vehicleTitle: "" },
    prepareStartupReady: async () => { events.push("prepareReady"); },
    applyNewRiderRegistration: async () => { events.push("registerRider"); },
  } as unknown as StartupHost;
  await loadStartupResources(host, {
    localResourcesSupported: () => false,
    recoverLocalSource: async () => undefined,
    defaultSourceName: "Data",
    versionId: version => version,
    loadVersionedSources: async () => ({ sources: [], archiveIndexes: [] }),
    loadLibrary: async () => library,
    loadProfile: () => { events.push("loadProfile"); return profile({ 3: 387 }); },
    defaultProfile: () => profile({}),
    resolveSelection: (_catalog, _maps, value) => {
      events.push(`resolve:${value.equipment.itemIds[3]}`);
      return { selection: { trackId: "village_R01", mapPath: "m", vehicleItemId: 0 }, vehicleTitle: "" };
    },
    isSpecialKartId: () => false,
    displayKartName: () => "",
    // An empty local nickname would open the release dialog; the account decides instead.
    localNickname: () => "",
    ensureAccount: async () => { events.push("ensureAccount"); },
    sanitizeProfile: value => { events.push("sanitize"); return profile({ ...value.equipment.itemIds, 3: 0 }); },
    needsRiderRegistration: () => { events.push("needsRider"); return false; },
  });
  assert.deepEqual(events, ["catalog", "ensureAccount", "loadProfile", "sanitize", "resolve:0",
    "install", "prepareReady", "finishLoading", "needsRider"]);
});

test("an item that expires while in the multiplayer lobby is repaired there without rebuilding Ready", async () => {
  const now = Date.now();
  await signIn(true, [
    item(3, 0, { systemKey: "practiceKart", source: "starter" }), item(1, 2, { source: "starter" }),
    item(2, 4, { source: "starter" }), item(70, 4, { source: "starter" }),
    item(8, 9, { expiresAt: now - 1_000 }), // goggle rental, expired after hello
  ]);
  const saved: RiderProfile[] = [];
  setAccountProfileWriter(value => saved.push(value));
  try {
    let rebuilt = 0;
    const host = {
      root: { ownerDocument: new FakeDocument() }, hud: { showDebugText() {} },
      userProfile: { ...profile({ 3: 0, 1: 2, 2: 4, 70: 4, 8: 9 }),
        equipment: { ...profile({ 3: 0, 1: 2, 2: 4, 70: 4, 8: 9 }).equipment, systemKart: "practiceKart" } },
      localNickname: "", shell: { current: "MultiplayerLobby" }, session: { vehicleTitle: "" },
      toonStageBinding: { retain() {} },
      rhoLibrary: { timeAttackGarageCatalog: async () => catalog },
      enterTimeAttackReady: async () => { rebuilt++; },
    } as unknown as AccountStartupHost;
    await repairAccountEquipment(host);
    assert.equal(host.userProfile.equipment.itemIds[8], 0, "create/join no longer send it");
    assert.equal(saved.length, 1);
    assert.equal(rebuilt, 0, "Ready is rebuilt when the lobby closes");

    // During the race itself the repair still waits.
    host.userProfile = { ...host.userProfile, equipment: { ...host.userProfile.equipment,
      itemIds: { ...host.userProfile.equipment.itemIds, 8: 9 } } };
    (host.shell as { current: string }).current = "MultiplayerRacing";
    await repairAccountEquipment(host);
    assert.equal(host.userProfile.equipment.itemIds[8], 9);
  } finally {
    setAccountProfileWriter(() => {});
    clearAccountSession();
  }
});

test("a profile that cannot be read at startup is explained in Chinese and offers 重试", async () => {
  await signIn(true);
  try {
    const document = new FakeDocument();
    const events: string[] = [];
    const library: StartupLibrary = {
      files: ["file"], archives: [], errors: [], warnings: [],
      timeAttackGarageCatalog: async () => catalog, mapCatalog: async () => [],
      trackMetadata: async () => ({}),
    };
    const host = {
      root: { ownerDocument: document },
      assets: { beginGeneration: () => 1, isCurrent: () => true, install: () => {} },
      hud: { chooseResourceSource: async () => undefined, setLoadingProgress: () => {},
        showDebugText: () => {}, finishLoading: () => events.push("finishLoading"),
        showLoadingError: (message: string) => events.push(`error:${message}`) },
      userProfile: profile({}), session: { vehicleTitle: "" },
      prepareStartupReady: async () => { events.push("prepareReady"); },
      applyNewRiderRegistration: async () => {},
    } as unknown as StartupHost;
    let attempts = 0;
    const pending = loadStartupResources(host, {
      localResourcesSupported: () => false, recoverLocalSource: async () => undefined,
      defaultSourceName: "Data", versionId: version => version,
      loadVersionedSources: async () => ({ sources: [], archiveIndexes: [] }),
      loadLibrary: async () => library,
      loadProfile: async () => {
        attempts++;
        if (attempts === 1) throw new AccountServiceError("DATA_SERVICE_UNAVAILABLE", 503);
        return profile({ 3: 0 });
      },
      defaultProfile: () => profile({}),
      resolveSelection: () => ({ selection: { trackId: "t", mapPath: "m", vehicleItemId: 0 },
        vehicleTitle: "" }),
      isSpecialKartId: () => false, displayKartName: () => "", localNickname: () => "x",
      retryProfile: error => retryStartupProfile(host as unknown as AccountStartupHost, error),
    });
    await until(() => document.body.children.length > 0);
    const message = document.body.children[0]!;
    assert.match(message.text(), /无法读取账号档案：数据服务暂时不可用，请稍后再试。/);
    assert.doesNotMatch(message.text(), /DATA_SERVICE_UNAVAILABLE/);
    const retry = message.querySelectorAll("button")[0] as FakeElement;
    assert.equal(retry.textContent, "重试");
    retry.click();
    await pending;
    assert.equal(attempts, 2);
    assert.equal(host.userProfile.equipment.itemIds[3], 0);
    assert.deepEqual(events, ["prepareReady", "finishLoading"]);
  } finally {
    clearAccountSession();
  }
});

const starterKit = () => [
  item(3, 0, { systemKey: "practiceKart", source: "starter" }), item(1, 3, { source: "starter" }),
  item(2, 6, { source: "starter" }), item(70, 7, { source: "starter" }),
];

test("cached preferences merged into a starter-only server profile are saved at startup", async () => {
  await signIn(true, starterKit());
  try {
    const owned = { ...profile({ 1: 3, 2: 6, 3: 0, 70: 7 }) };
    owned.equipment = { ...owned.equipment, systemKart: "practiceKart" };
    const saved: RiderProfile[] = [];
    recordProfileLoad({ fromServer: true, migrated: false, mergedLocal: true });
    assert.equal(sanitizeStartupProfile(owned, catalog, value => saved.push(value)), owned);
    assert.deepEqual(saved, [owned]);
    // A plain server profile that needs no repair is not written back.
    recordProfileLoad({ fromServer: true, migrated: false });
    sanitizeStartupProfile(owned, catalog, value => saved.push(value));
    assert.equal(saved.length, 1);
  } finally {
    clearAccountSession();
  }
});

test("a salvaged server profile is not overwritten with defaults at startup", async () => {
  await signIn(true, starterKit());
  try {
    const saved: RiderProfile[] = [];
    recordProfileLoad({ fromServer: true, migrated: false, salvaged: true });
    // The default equipment (kart 387) replaced an invalid section: repaired here, not saved.
    const next = sanitizeStartupProfile(profile({ 1: 3, 2: 6, 3: 387, 70: 7 }), catalog,
      value => saved.push(value));
    assert.equal(next.equipment.itemIds[3], 0);
    assert.deepEqual(saved, []);
  } finally {
    clearAccountSession();
  }
});

test("onboarding waits for the first profile save and reports when it failed", async () => {
  let claimed = false;
  await signIn(false, [], service => {
    service.on("GET /api/account", () => ({ status: 200,
      body: summaryFixture({ onboarded: claimed }) }));
    service.on("GET /api/inventory", () => ({ status: 200,
      body: { items: claimed ? starterKit() : [] } }));
    service.on("POST /api/account/starter", () => { claimed = true; return { status: 200, body: {} }; });
    service.on("PUT /api/account/profile", { status: 400, body: { error: "INVALID_PROFILE" } });
  });
  try {
    const document = new FakeDocument();
    const debug: string[] = [];
    const host: AccountStartupHost = {
      root: { ownerDocument: document } as unknown as HTMLElement,
      hud: { showDebugText: message => debug.push(message) },
      userProfile: profile({ 1: 2, 2: 4, 3: 0, 70: 4 }), localNickname: "",
      rhoLibrary: { timeAttackGarageCatalog: async () => catalog } as unknown as StartupLibrary,
      shell: { current: "Ready" },
      session: { selection: { trackId: "t", mapPath: "m", vehicleItemId: 0,
        vehiclePath: "kart_/practiceV1/model.1s", vehicleSystemKey: "practiceKart",
        characterItemId: 2, characterPath: "character_/dao/model.1s" }, vehicleTitle: "" },
      toonStageBinding: { retain() {} },
      enterTimeAttackReady: async () => {},
    };
    await registerAccountRider(host, {
      loadEnvironment: async () => ({ dispose() {} }),
      loadDialog: async () => ({
        open: async () => ({ name: "车手甲", characterItemId: 3, paintItemId: 6, dyeItemId: 7 }),
        dispose() {},
      }),
      saveProfile: value => accountProfileSync()?.enqueue(value),
      saveNickname: () => {},
    });
    assert.ok(document.body.children.some(child => child.text() === PROFILE_NOT_SAVED_MESSAGE));
    assert.ok(debug.includes(PROFILE_NOT_SAVED_MESSAGE));
  } finally {
    clearAccountSession();
  }
});
