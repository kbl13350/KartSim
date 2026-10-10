#!/usr/bin/env node
// End-to-end check of the account economy through the REAL browser modules
// (client/src, loaded with tsx) against a temporary local cluster: one
// kart-data with reward rates other than 1 and two kart-game nodes started by
// lib/local-cluster.mjs (temporary MySQL database and user, unique Redis
// prefix, all removed afterwards, also on SIGINT/SIGTERM/SIGHUP).
//
// It drives what the game does in the browser, with the browser's own code:
//   login gate (ensureAccountSession + registerAccount; the admin username of
//   KART_ADMIN_USERNAMES only with the bootstrap invite, entered through the
//   collapsed 有邀请码？ field of open registration) → onboarding
//   (BrowserAccountSession.claimStarter) → inventory and the garage ownership
//   filter (garage-ownership.ts / ownership.ts) → account profile load, first
//   login migration and ordered saves including the 409 ITEM_NOT_OWNED repair
//   (account-profile.ts / account-runtime.ts) → shop catalog with ETag/304
//   and purchases (shop-api.ts ShopPurchaser sending expectedPrice, a stale
//   price → PRICE_CHANGED, shop-model.ts) with an admin grant in between →
//   game-server choice and tickets (game-servers.ts) → the WebSocket client
//   (client-websocket.ts with the strict server-event and room validators)
//   entering with starter or bought equipment (a second session of an
//   account on another node → ACCOUNT_ONLINE) → a race between two accounts
//   that lasts 10 s of server time (shorter races earn only the unfinished
//   reward) → race.rewards parsing (account/rewards.ts) → account refresh
//   after the outbox credited exp/lucci (incl. level-up notices) →
//   time-attack settlement (timeattack/timeattack-settle.ts, paced 10 s apart;
//   TOO_MANY_ATTEMPTS and INVALID_TRACK earn nothing without an error).
//
// The race and the time-attack pacing wait for real time: about a minute.
//
//   KART_SMOKE_MYSQL_ADMIN='-h127.0.0.1 -P3307 -uroot' KART_SMOKE_REDIS_ADDR=127.0.0.1:6380 \
//     node test/frontend-economy-check.mjs
//
// Needs `npm ci` in client/ (skipped otherwise). Environment: see
// lib/local-cluster.mjs (KART_SMOKE_PORTS, KART_SMOKE_SKIP_BUILD=1,
// KART_BIN_DIR, KART_SMOKE_KEEP=1, KART_SMOKE_VERBOSE=1, …).
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import {
  RACE, afterEarning, findItem, loadLevels, raceRewards, timeAttackPacingMs, timeAttackRewards,
} from "./lib/economy.mjs";
import { poll, randomForwardedFor, randomPassword } from "./lib/kart-client.mjs";
import { runLocalCluster, serverDir, sqlString } from "./lib/local-cluster.mjs";

const rewriteDir = resolve(serverDir, "../client");
const tsxApi = join(rewriteDir, "node_modules/tsx/dist/esm/api/index.mjs");
if (!existsSync(tsxApi)) {
  console.log("SKIP frontend-economy-check: run npm ci in client/ first");
  process.exit(0);
}
const { tsImport } = await import(pathToFileURL(tsxApi).href);
const modules = await tsImport(new URL("./lib/frontend-modules.ts", import.meta.url).href, import.meta.url);
const {
  accountApi, runtime, ownership, shopApi, shopModel, gameServers, clientControl, localProfile,
} = modules;
const { ensureAccountSession, startupLoginOptions } = modules.loginGate;
const { tokenAccess } = modules.tokenStore;
const { garageViewCatalog } = modules.garageOwnership;
const { loadAccountProfile } = modules.accountProfile;
const { parseRaceRewards, formatRaceReward } = modules.rewards;
const { connectWebSocketGameClient } = modules.clientWebsocket;
const { initializeMultiplayerClientState } = modules.clientState;
const { GameMotionDecoder } = modules.payload;
const { ClockSynchronizer, MotionRoundTripTracker } = modules.networkTiming;
const { parseServerEvent } = modules.serverEvents;
const { isValidRoomSnapshot } = modules.roomValidation;
const { formatMultiplayerError } = modules.multiplayerErrors;
const { settleTimeAttackRun } = modules.timeAttackSettle;

const tag = randomBytes(3).toString("hex");
const adminUsername = `fe_admin_${tag}`;
const bootstrapInvite = `FE-BOOT-${tag}`;
const rates = { exp: 1.5, lucci: 2 };
const channelName = "speedIndiCombine";
const pageOrigin = "http://127.0.0.1:18780";
const levels = loadLevels();

/** In-memory localStorage stand-in. */
function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: key => { values.delete(key); },
    values,
  };
}

/**
 * fetch for one simulated browser: its own X-Forwarded-For (the cluster
 * trusts 127.0.0.1, so the per-IP registration limit applies per player) and
 * a log of every request for the ETag checks.
 */
function browserFetch(log = []) {
  const forwardedFor = randomForwardedFor();
  const fetchImpl = async (url, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set("X-Forwarded-For", forwardedFor);
    const response = await fetch(url, { ...init, headers });
    log.push({ url: String(url), method: init.method ?? "GET", status: response.status,
      ifNoneMatch: headers.get("If-None-Match"), etag: response.headers.get("ETag") });
    return response;
  };
  return Object.assign(fetchImpl, { log });
}

/**
 * The startup login gate with a dialog that registers a new account (with
 * `invite` as typed into the 有邀请码？ field, when given).
 */
async function registerThroughLoginGate(dataOrigin, { username, nickname, invite }) {
  const fetchImpl = browserFetch();
  const storage = memoryStorage();
  const password = randomPassword();
  let registration;
  const session = await ensureAccountSession({
    backendOrigin: () => dataOrigin,
    pageOrigin: () => pageOrigin,
    fetch: fetchImpl,
    tokens: tokenAccess({ cache: new Map(), storage: () => storage }),
    signIn: async (mode, origin) => {
      registration = mode;
      return accountApi.registerAccount(fetchImpl, origin,
        { username, nickname, password, ...(invite === undefined ? {} : { invite }) });
    },
    retry: async message => { throw new Error(`login gate failed: ${message}`); },
  });
  assert.equal(registration, "open", "auth/config registration");
  assert.equal(session.summary()?.account.username, username);
  return Object.assign(session, { password, fetchLog: fetchImpl.log, storage });
}

/** game-servers.ts dependencies of one browser; pick() chooses `nodeId`. */
function serverDeps(dataOrigin, fetchImpl, nodeId) {
  const storage = memoryStorage();
  return {
    endpoint: path => `${dataOrigin}/multiplayer/${path}`,
    backendOrigin: () => dataOrigin,
    pageUrl: () => `${pageOrigin}/`,
    fetch: (url, init) => fetchImpl(url, init),
    storage: () => storage,
    pick: async (_root, options, selected) => {
      assert.ok(options.some(option => option.server.nodeId === selected), "picker preselects a listed server");
      return options.find(option => option.server.nodeId === nodeId).server;
    },
  };
}

const channelRules = {
  speedIndiCombine: { mode: "individual", speed: 7 }, speedTeamCombine: { mode: "team", speed: 7 },
  speedIndiInfinit: { mode: "individual", speed: 4 }, speedTeamInfinit: { mode: "team", speed: 4 },
};
const validation = {
  validRoom: isValidRoomSnapshot,
  validChannel: (channel, mode, speed) =>
    channel in channelRules && channelRules[channel].mode === mode && channelRules[channel].speed === speed,
  validGameplay: gameplay => gameplay === undefined || gameplay === "ordinary",
  validRandomTrackCode: code => [0, 3, 4, 5, 6, 7, 8, 30, 40].includes(code),
};

/** A multiplayer client host like the generated LT class, with the browser's transport code. */
function gameClient() {
  const host = {};
  initializeMultiplayerClientState(host, {
    createDecoder: () => new GameMotionDecoder(),
    createLatencyTracker: () => new MotionRoundTripTracker(),
    createClock: () => new ClockSynchronizer(),
  });
  const rejected = [];
  Object.assign(host, {
    request: message => clientControl.sendControlRequest(host, message),
    acceptMotion: () => {},
    acceptMotionMessage: () => {},
    dispose: () => clientControl.disposeClient(host),
    rejected,
    events: [],
  });
  clientControl.subscribeControl(host, message => host.events.push(message));
  return host;
}

/** Enter a game server like the lobby: fresh ticket, WebSocket hello with the profile equipment. */
async function enterGame(deps, server, session, equipment) {
  const entry = await gameServers.requestGameServerEntry(deps, server, session.sessionToken,
    new AbortController().signal);
  const client = gameClient();
  const welcome = await connectWebSocketGameClient(client, entry.offerUrl, "ignored", "p3553", equipment, "",
    true, entry.ticket, {
      validateControlMessage: value => {
        const parsed = parseServerEvent(value, validation);
        if (!parsed) client.rejected.push(value);
        return parsed;
      },
      now: () => performance.now(),
    });
  assert.equal(welcome.type, "welcome");
  return client;
}

/** Waits for a pushed room snapshot matching `predicate`. */
function waitForRoom(client, predicate, description, timeoutMs = 15_000) {
  return poll(() => client.events.find(message => message.type === "room" && predicate(message.room))?.room,
    { timeoutMs, intervalMs: 50, description });
}

const errorCodeOf = async promise => {
  try {
    await promise;
  } catch (error) {
    return error?.code ?? error?.message;
  }
  assert.fail("expected a rejection");
};

await runLocalCluster("frontend-economy-check", {
  dataEnv: {
    KART_REGISTRATION: "open", KART_ALLOW_GUESTS: "false", KART_ADMIN_USERNAMES: adminUsername,
    KART_BOOTSTRAP_INVITE: bootstrapInvite,
    KART_EXP_RATE: String(rates.exp), KART_LUCCI_RATE: String(rates.lucci), KART_STARTING_LUCCI: "10000",
  },
  // Its racers finish without driving the track, which the anti-cheat
  // would kick (ANTICHEAT.md): it only records here.
  gameEnv: { KART_ALLOW_GUESTS: "false", KART_ANTICHEAT: "log" },
  nodes: [{ nodeId: "fe-a", name: "前端 A" }, { nodeId: "fe-b", name: "前端 B" }],
}, async ctx => {
  const { dataOrigin } = ctx;
  const sessions = [];
  const clients = [];
  try {
    // --------------------------------------------------------------- login
    const alice = await registerThroughLoginGate(dataOrigin, { username: `fe_alice_${tag}`, nickname: `阿丽${tag}` });
    const bob = await registerThroughLoginGate(dataOrigin, { username: `fe_bob_${tag}`, nickname: `阿博${tag}` });
    // Open registration still offers the invite field (collapsed): listed admin
    // usernames need the bootstrap invite that kart-data logs.
    assert.equal(startupLoginOptions("open").invite, "collapsed");
    assert.equal(startupLoginOptions("invite").invite, "required");
    assert.equal(await errorCodeOf(accountApi.registerAccount(browserFetch(), dataOrigin,
      { username: adminUsername, nickname: `管理${tag}`, password: randomPassword() })), "INVALID_INVITE");
    const admin = await registerThroughLoginGate(dataOrigin,
      { username: adminUsername, nickname: `管理${tag}`, invite: bootstrapInvite });
    sessions.push(alice, bob, admin);
    assert.equal(alice.summary().onboarded, false);
    assert.equal(alice.summary().wallet.lucci, 10_000, "starting lucci");
    assert.equal(alice.summary().progress.level, 1);
    assert.equal(alice.summary().account.admin, false, "open registration: the first account is not an admin");
    assert.equal(admin.summary().account.admin, true, "KART_ADMIN_USERNAMES");
    assert.deepEqual(alice.inventory(), [], "no inventory before the starter gift");
    console.log(`✓ login gate registered ${alice.summary().account.username}, ${bob.summary().account.username} ` +
      "and an admin (open registration, token kept in the shared token store; the admin username only with " +
      "the bootstrap invite, INVALID_INVITE without)");

    const aliceServers = serverDeps(dataOrigin, browserFetch(), "fe-a");
    const bobServers = serverDeps(dataOrigin, browserFetch(), "fe-a");
    const signal = new AbortController().signal;
    assert.equal(await errorCodeOf(gameServers.requestGameServerTicket(aliceServers, "fe-a", alice.sessionToken, signal)),
      "ONBOARDING_REQUIRED");
    assert.equal(await errorCodeOf(gameServers.requestGameServerTicket(aliceServers, "fe-a", undefined, signal)),
      "LOGIN_REQUIRED");
    console.log("✓ tickets: 403 ONBOARDING_REQUIRED before the starter gift, 401 LOGIN_REQUIRED without a login");

    // ------------------------------------------- first-login profile migration
    runtime.installAccountSession(alice);
    assert.equal(runtime.activeBrowserSession(), alice);
    const profileStorage = memoryStorage();
    const profileDeps = {
      normalizeGarage: garage => garage, validateGarage: () => {}, garageKart: () => ({}),
      systemKarts: [{ key: "practiceKart" }], resolveVariant: () => undefined,
    };
    const anonymous = { ...localProfile.defaultLocalProfile(), favoriteTracks: [{ themeId: 3, trackId: 12 }],
      initial: "KS" };
    const profileOptions = {
      storage: profileStorage, profileKey: localProfile.LOCAL_PROFILE_KEY,
      loadLocal: () => anonymous,
      parse: serialized => localProfile.parseLocalProfile(serialized, profileDeps),
      defaultProfile: () => localProfile.defaultLocalProfile(),
    };
    const firstLoad = await loadAccountProfile(alice, profileOptions);
    assert.equal(firstLoad.fromServer, false, "PROFILE_NOT_FOUND before onboarding");
    assert.equal(firstLoad.migrated, true, "anonymous preferences migrate on the first login");
    assert.deepEqual(firstLoad.profile.favoriteTracks, anonymous.favoriteTracks);
    // Saves wait for the starter gift (canWrite), so nothing is stored yet.
    runtime.accountProfileSync().enqueue(firstLoad.profile);
    await runtime.accountProfileSync().flush();
    const notYet = await alice.authorizedFetch("/api/account/profile");
    assert.equal(notYet.status, 404, "no profile write before onboarding");
    assert.equal((await notYet.json()).error, "PROFILE_NOT_FOUND");
    console.log("✓ first login: no server profile (404 PROFILE_NOT_FOUND), favorites migrated, no write before onboarding");

    // ------------------------------------------------------------ onboarding
    await alice.claimStarter({ character: 3, paint: 6, dye: 5 });
    assert.equal(alice.summary().onboarded, true);
    const starterRows = alice.inventory().map(({ category, itemId, systemKey, expiresAt, source }) =>
      ({ category, itemId, systemKey, expiresAt, source }));
    assert.deepEqual(starterRows.sort((a, b) => a.category - b.category), [
      { category: 1, itemId: 3, systemKey: undefined, expiresAt: null, source: "starter" },
      { category: 2, itemId: 6, systemKey: undefined, expiresAt: null, source: "starter" },
      { category: 3, itemId: 0, systemKey: "practiceKart", expiresAt: null, source: "starter" },
      { category: 70, itemId: 5, systemKey: undefined, expiresAt: null, source: "starter" },
    ]);
    assert.deepEqual(ownership.starterChoice(alice), { character: 3, paint: 6, dye: 5 },
      "the fallback character/paint/dye come from the source:\"starter\" rows");
    await alice.claimStarter({ character: 2, paint: 4, dye: 4 }); // repeat: 200 + summary, nothing granted
    assert.equal(alice.inventory().length, 4, "a repeated claim grants nothing");
    assert.deepEqual(ownership.starterChoice(alice), { character: 3, paint: 6, dye: 5 });
    await bob.claimStarter({ character: 2, paint: 4, dye: 4 });
    console.log("✓ starter gift: practice kart + 皮蛋/黑妞 + colors, all permanent with source \"starter\"; repeat claim tolerated");

    // ----------------------------------------------- garage ownership filter
    const catalog = await shopApi.fetchShopCatalog(alice);
    const garageCatalog = {
      karts: [{ itemId: 0, systemKey: "practiceKart", path: "kart_/practiceV1" },
        ...catalog.items.filter(item => item.category === 3).map(item => ({ itemId: item.itemId }))],
      characters: catalog.items.filter(item => item.category === 1).map(item => ({ itemId: item.itemId })),
      // The garage equips no item changer voucher (category 7, sold in the shop only).
      equipment: [...catalog.items.filter(item => item.category !== 1 && item.category !== 3 && item.category !== 7)
        .map(item => ({ category: item.category, itemId: item.itemId })),
      { category: 43, itemId: 5 }, { category: 68, itemId: 1 }],
    };
    const ids = list => list.map(entry => entry.category === undefined ? entry.itemId : `${entry.category}:${entry.itemId}`);
    let view = garageViewCatalog(garageCatalog);
    assert.deepEqual(ids(view.karts), [0]);
    assert.deepEqual(ids(view.characters), [3]);
    assert.deepEqual(ids(view.equipment).sort(), ["2:6", "43:5", "68:1", "70:5"].sort(),
      "owned shop items plus the free garage categories");
    assert.deepEqual(ids(garageViewCatalog(garageCatalog, { kartItemId: 387 }).karts), [0, 387],
      "the current selection stays listed");
    console.log(`✓ garage views list only owned items (${garageCatalog.karts.length} karts → practice kart; ` +
      "free categories 43/68 stay)");

    // ------------------------------------------------ account profile saves
    let repairs = 0;
    runtime.setEquipmentRepairHandler(async rejected => {
      repairs++;
      const repaired = ownership.sanitizeProfileEquipment(rejected, alice);
      runtime.accountProfileSync().enqueue(repaired);
    });
    const afterClaim = await loadAccountProfile(alice, profileOptions);
    assert.equal(afterClaim.fromServer, true, "the starter claim stored the starter equipment");
    const equipment = afterClaim.profile.equipment;
    assert.equal(equipment.itemIds[3], 0);
    assert.equal(equipment.systemKart, "practiceKart");
    assert.deepEqual([equipment.itemIds[1], equipment.itemIds[2], equipment.itemIds[70]], [3, 6, 5]);
    assert.deepEqual(ownership.unownedSlots(equipment, alice), [], "the starter equipment is owned");
    // The real onboarding saves the migrated preferences with the starter equipment.
    const starterProfile = { ...firstLoad.profile, equipment: { ...equipment, itemIds: { ...equipment.itemIds, 43: 5, 68: 1 } } };
    runtime.accountProfileSync().enqueue(starterProfile);
    await runtime.accountProfileSync().flush();
    let stored = await alice.requestJson("/api/account/profile");
    assert.deepEqual(stored.favoriteTracks, anonymous.favoriteTracks, "migrated favorites saved to the account");
    assert.equal(stored.equipment.itemIds[43], 5, "free garage slot 43 passes the ownership check");
    // Unowned kart and paint: 409 ITEM_NOT_OWNED → refresh → repair → saved.
    const unowned = { ...starterProfile, equipment: { ...starterProfile.equipment, kartSerial: 0,
      itemIds: { ...starterProfile.equipment.itemIds, 3: 387, 2: 1 } } };
    delete unowned.equipment.systemKart;
    runtime.accountProfileSync().enqueue(unowned);
    await poll(async () => {
      await runtime.accountProfileSync().flush();
      return repairs === 1;
    }, { timeoutMs: 10_000, intervalMs: 50, description: "ITEM_NOT_OWNED repair" });
    await runtime.accountProfileSync().flush();
    stored = await alice.requestJson("/api/account/profile");
    assert.deepEqual([stored.equipment.itemIds[3], stored.equipment.systemKart, stored.equipment.itemIds[2],
      stored.equipment.itemIds[43]], [0, "practiceKart", 6, 5], "repaired to the practice kart and the starter paint");
    console.log("✓ account profile: migrated preferences saved after onboarding; 409 ITEM_NOT_OWNED repaired " +
      "to the starter kit and stored; free slots kept");

    // ------------------------------------------------------- shop catalog
    clearRequests(alice);
    shopApi.clearShopCatalogCache();
    const fresh = await shopApi.fetchShopCatalog(alice);
    const again = await shopApi.fetchShopCatalog(alice);
    const catalogRequests = alice.fetchLog.filter(entry => entry.url.endsWith("/api/shop/catalog"));
    // 6,032 garage items and the two item changer vouchers (7:3, 7:4).
    assert.equal(fresh.items.length, 6034, "6,034 sellable items");
    assert.deepEqual(fresh.items.filter(item => item.category === 7).map(item => item.itemId), [3, 4]);
    assert.equal(again, fresh, "a 304 keeps the cached catalog object");
    assert.deepEqual(catalogRequests.map(entry => entry.status), [200, 304]);
    assert.equal(catalogRequests[1].ifNoneMatch, `"${fresh.version}"`);
    assert.equal(catalogRequests[0].etag, `"${fresh.version}"`);
    console.log(`✓ shop catalog: ${fresh.items.length} items, ETag "${fresh.version.slice(0, 12)}…" revalidated with 304`);

    // ------------------------------------------------------------ purchase
    const index = new shopModel.ShopIndex(fresh);
    const now = () => alice.serverNow();
    const permanentCoupon = item => item.offers.find(offer => offer.currency === "coupon" && offer.days === 0 &&
      !offer.minExp && offer.price > 0);
    const kart = fresh.items.find(item => item.category === 3 && permanentCoupon(item));
    const kartOffer = permanentCoupon(kart);
    const context = () => ({ wallet: alice.summary().wallet, exp: alice.summary().progress.exp,
      ownership: shopModel.ownershipOf(kart, shopModel.inventoryIndex(alice.inventory(), now()), now(),
        (category, itemId) => alice.owns(category, itemId)) });
    assert.equal(shopModel.offerAvailability(kart, kartOffer, context()).blocked, "funds");
    const purchaser = new shopApi.ShopPurchaser(alice, { retryDelaysMs: [] });
    const insufficient = await errorCodeOf(purchaser.purchase(kartOffer));
    assert.equal(insufficient, "INSUFFICIENT_FUNDS");
    assert.equal(shopApi.shopErrorMessage(insufficient), "余额不足，无法购买该道具。");
    const grant = await admin.requestJson("/api/admin/grant", { method: "POST", body: JSON.stringify({
      username: alice.summary().account.username, currency: "coupon", amount: kartOffer.price, note: "frontend check" }) });
    assert.equal(grant.applied, kartOffer.price);
    await alice.refresh();
    assert.equal(alice.summary().wallet.coupon, kartOffer.price);
    assert.equal(shopModel.offerAvailability(kart, kartOffer, context()).blocked, undefined);
    // A dialog opened on a stale catalog sends the old price: refused, nothing charged.
    const stale = await errorCodeOf(new shopApi.ShopPurchaser(alice, { retryDelaysMs: [] })
      .purchase({ ...kartOffer, price: kartOffer.price + 1 }));
    assert.equal(stale, "PRICE_CHANGED");
    assert.equal(shopApi.shopErrorMessage(stale), "价格已变化，请刷新商店后重试。");
    await alice.refresh();
    assert.equal(alice.summary().wallet.coupon, kartOffer.price, "PRICE_CHANGED charges nothing");
    const bought = await purchaser.purchase(kartOffer);
    assert.equal(bought.wallet.coupon, 0);
    assert.deepEqual([bought.item.category, bought.item.itemId, bought.item.expiresAt, bought.item.source],
      [3, kart.itemId, null, "shop"]);
    alice.applyInventoryItem(bought.item);
    assert.ok(alice.owns(3, kart.itemId));
    assert.equal(shopModel.offerAvailability(kart, kartOffer, context()).blocked, "owned");
    assert.equal(await errorCodeOf(purchaser.purchase(kartOffer)), "ALREADY_OWNED");
    await alice.refresh();
    assert.ok(findItem(alice.inventory(), 3, kart.itemId), "the bought kart is in GET /api/inventory");
    view = garageViewCatalog(garageCatalog);
    assert.deepEqual(ids(view.karts), [0, kart.itemId], "the bought kart appears in the garage");
    // A lucci rental of a character, from the 10,000 starting lucci.
    const character = fresh.items.find(item => item.category === 1 && item.itemId !== 3 &&
      item.offers.some(offer => offer.currency === "lucci" && offer.days > 0 && offer.price <= 10_000 && !offer.minExp));
    const characterOffer = character.offers.find(offer => offer.currency === "lucci" && offer.days > 0 &&
      offer.price <= 10_000 && !offer.minExp);
    const rented = await new shopApi.ShopPurchaser(alice).purchase(characterOffer);
    // What ready-shop.ts onPurchased does: apply the row, then re-read the account.
    alice.applyInventoryItem(rented.item);
    await alice.refresh();
    assert.equal(alice.summary().wallet.lucci, rented.wallet.lucci);
    assert.equal(rented.wallet.lucci, 10_000 - characterOffer.price);
    assert.ok(rented.item.expiresAt > Date.now() + (characterOffer.days - 1) * 86_400_000);
    assert.match(ownership.remainingLabel(rented.item.expiresAt, alice.serverNow()), /^剩余 \d+ 天$/);
    assert.equal(index.entries.length, fresh.items.length);
    console.log(`✓ purchase: ${kart.name} ${kartOffer.price} 点券 → INSUFFICIENT_FUNDS → admin grant → ` +
      "stale price PRICE_CHANGED → bought " +
      `(ALREADY_OWNED again); ${character.name} rented ${characterOffer.days} 天 for ${characterOffer.price} 金币`);

    // Equip the bought kart and the rented character; the profile PUT accepts owned items.
    const raceEquipment = { ...stored.equipment, kartSerial: 0, exceedType: 0,
      itemIds: { ...stored.equipment.itemIds, 3: kart.itemId, 1: character.itemId, 43: 5, 68: 1 } };
    delete raceEquipment.systemKart;
    delete raceEquipment.systemKartVariant;
    await alice.requestJson("/api/account/profile", { method: "PUT",
      body: JSON.stringify({ ...stored, equipment: raceEquipment }) });
    console.log("✓ profile PUT accepts the bought kart, the rented character and free slots 43/68");

    // ----------------------------------------------------- tickets and join
    const server = await gameServers.chooseGameServer(aliceServers, null, signal);
    assert.equal(server.nodeId, "fe-a");
    const aliceClient = await enterGame(aliceServers, server, alice, raceEquipment);
    clients.push(aliceClient);
    const bobProfile = await loadAccountProfile(bob, { ...profileOptions, storage: memoryStorage(), loadLocal: () => undefined });
    assert.equal(bobProfile.fromServer, true);
    const bobEquipment = bobProfile.profile.equipment;
    assert.equal(bobEquipment.systemKart, "practiceKart");
    const bobClient = await enterGame(bobServers, server, bob, bobEquipment);
    clients.push(bobClient);
    console.log("✓ tickets from the data service; both accounts entered fe-a with their equipment " +
      "(bought kart / practice kart)");
    // One live session per account: bob's second session on fe-b is refused.
    const serverB = (await gameServers.fetchGameServerList(bobServers, signal)).servers
      .find(entry => entry.nodeId === "fe-b");
    assert.ok(serverB, "fe-b is listed");
    const twice = await errorCodeOf(enterGame(bobServers, serverB, bob, bobEquipment));
    assert.equal(twice, "ACCOUNT_ONLINE");
    assert.match(formatMultiplayerError(new Error(twice)), /其他地方在线/);
    console.log("✓ a second session of an online account on fe-b → ACCOUNT_ONLINE (Chinese message)");

    const roomFields = { type: "create", name: `前端${tag}`, capacity: 2, password: "", channelName,
      gameplay: "ordinary", mode: "individual", speed: 7, speedVersion: "国服" };
    const created = await aliceClient.request({ ...roomFields, equipment: raceEquipment });
    const roomId = created.room.roomId;
    assert.equal(created.room.members[0].name, alice.summary().account.nickname,
      "the game node names account players by their nickname from the ticket");
    const aliceId = aliceClient.playerId;
    const bobId = bobClient.playerId;
    const refused = await errorCodeOf(bobClient.request({ type: "join", roomId,
      equipment: { ...bobEquipment, itemIds: { ...bobEquipment.itemIds, 3: kart.itemId }, systemKart: undefined } }));
    assert.equal(refused, "ITEM_NOT_OWNED");
    assert.match(formatMultiplayerError(new Error(refused)), /未拥有/);
    let joined = await bobClient.request({ type: "join", roomId, equipment: { ...bobEquipment,
      itemIds: { ...bobEquipment.itemIds, 43: 5, 76: 2 } } });
    const aliceMember = joined.room.members.find(member => member.playerId === aliceId);
    assert.equal(aliceMember.equipment.itemIds["3"], kart.itemId, "the bought kart is in the room");
    joined = await bobClient.request({ type: "equipment", roomId, revision: joined.room.revision, equipment: bobEquipment });
    console.log("✓ create/join: unowned kart refused (ITEM_NOT_OWNED → Chinese message), practice kart and " +
      "free slots 43/76 accepted");

    // ---------------------------------------------------------------- race
    const aliceBefore = alice.summary();
    const bobBefore = bob.summary();
    const levelUps = [];
    alice.onLevelUp(change => levelUps.push(change));
    const ready = await bobClient.request({ type: "ready", roomId, revision: joined.room.revision, ready: true });
    const started = await aliceClient.request({ type: "start", roomId, revision: ready.room.revision });
    const raceId = started.room.race.raceId;
    await aliceClient.request({ type: "loaded", roomId, raceId });
    await bobClient.request({ type: "loaded", roomId, raceId });
    await waitForRoom(aliceClient, room => room.roomId === roomId && room.phase === "racing", "racing phase");
    // Finishes count for the rewards only after 10 s of server time (ECONOMY.md 2.1).
    await delay(RACE.minRewardedRaceMs + 500);
    await aliceClient.request({ type: "finish", roomId, raceId, elapsedMs: 60_000 });
    const finished = await bobClient.request({ type: "finish", roomId, raceId, elapsedMs: 65_000 });
    assert.equal(finished.room.phase, "finished");
    const shown = parseRaceRewards(finished.room.race.rewards);
    const expected = raceRewards({ channel: channelName, rates, racers: [
      { playerId: aliceId, rank: 1, finished: true }, { playerId: bobId, rank: 2, finished: true }] });
    assert.deepEqual(Object.fromEntries(shown), expected, "race.rewards show the rates the data service credits");
    assert.deepEqual(expected[aliceId], { exp: 132, lucci: 240 }, "88 × 1.5 exp, 120 × 2 lucci");
    console.log(`✓ race finished; result rows show ${formatRaceReward(shown.get(aliceId))} / ` +
      `${formatRaceReward(shown.get(bobId))} (rates ×${rates.exp} exp, ×${rates.lucci} lucci)`);
    await aliceClient.request({ type: "return-room", roomId, raceId });
    await bobClient.request({ type: "return-room", roomId, raceId });

    // ------------------------------------------- credited through the outbox
    const expectCredited = async (session, before, reward) => {
      const want = afterEarning(levels, before, reward);
      await poll(async () => {
        await session.refresh();
        return session.summary().progress.exp === want.progress.exp;
      }, { timeoutMs: ctx.settleMs, description: `${before.account.username} exp ${want.progress.exp}` });
      assert.deepEqual(session.summary().wallet, want.wallet, `${before.account.username} wallet`);
      assert.equal(session.summary().progress.level, want.progress.level);
      return want;
    };
    const aliceWant = await expectCredited(alice, aliceBefore, shown.get(aliceId));
    const bobWant = await expectCredited(bob, bobBefore, shown.get(bobId));
    assert.equal(levelUps.length, aliceWant.levelUps > 0 ? 1 : 0, "one level-up notice per account read");
    if (levelUps.length) assert.deepEqual([levelUps[0].from, levelUps[0].to], [1, aliceWant.progress.level]);
    assert.deepEqual(alice.summary().stats, { races: 1, wins: 1, podiums: 1, points: 10 });
    console.log(`✓ account refresh after the race: credited exactly what was shown; ${alice.summary().account.username} ` +
      `Lv.${aliceWant.progress.level} (level-up notice ${levelUps.map(c => `${c.from}→${c.to}`).join(", ") || "none"}), ` +
      `${bob.summary().account.username} Lv.${bobWant.progress.level}`);

    // ----------------------------------------------------------- time attack
    const patches = [];
    const reports = [];
    const notices = [];
    // The data service paces runs (10 s apart, and no closer than their own
    // time minus 3 s); `paced` waits like a player starting the next run.
    let lastSettled = 0;
    const settle = (elapsedMs, trackId = "village_R01") => settleTimeAttackRun({ session: alice, trackId, elapsedMs,
      result: { patch: values => patches.push(values) }, report: message => reports.push(message),
      notify: message => notices.push(message), retryDelayMs: 10 });
    const paced = async elapsedMs => {
      const wait = lastSettled + timeAttackPacingMs(elapsedMs) + 300 - Date.now();
      if (wait > 0) await delay(wait);
      const settled = await settle(elapsedMs);
      lastSettled = Date.now();
      return settled;
    };
    let before = alice.summary();
    const first = await paced(12_345);
    assert.equal(first.newRecord, true);
    assert.deepEqual({ exp: first.exp, lucci: first.lucci }, timeAttackRewards(true, rates));
    assert.deepEqual(patches.at(-1), { rewardExp: first.exp, rewardLucci: first.lucci });
    assert.ok(first.summary, "the settle response carries the account summary");
    assert.equal(alice.summary().progress.exp, before.progress.exp + first.exp, "summary applied to the session");
    // Right after the previous run (429 TOO_MANY_ATTEMPTS) or on a track
    // without rewards (400 INVALID_TRACK): no reward, the panel keeps " +0",
    // and no error is shown.
    const patchCount = patches.length;
    assert.equal(await settle(13_000), undefined, "a run within the pacing interval earns nothing");
    assert.equal(await settle(13_000, `no_such_track_${tag}`), undefined, "a track outside tracks.json earns nothing");
    assert.equal(patches.length, patchCount, "refused runs patch nothing");
    const slower = await paced(13_000);
    assert.equal(slower.newRecord, false);
    assert.deepEqual({ exp: slower.exp, lucci: slower.lucci }, timeAttackRewards(false, rates));
    // Under 10 s: the browser does not settle at all, and the service would refuse it.
    assert.equal(await settle(9_000), undefined);
    assert.deepEqual(reports, [], "no settlement error shown");
    const short = await alice.authorizedFetch("/api/timeattack/settle", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: "village_R01", elapsedMs: 9_000, requestId: crypto.randomUUID() }) });
    assert.equal(short.status, 400);
    assert.equal((await short.json()).error, "INVALID_ELAPSED_MS");
    // Level-up from a settlement: one below the next level, then a run.
    before = alice.summary();
    const next = before.progress.nextLevelExp;
    const gap = next - before.progress.exp - 1;
    await admin.requestJson("/api/admin/grant", { method: "POST", body: JSON.stringify({
      username: before.account.username, currency: "exp", amount: gap, note: "frontend check level-up" }) });
    await alice.refresh();
    assert.equal(alice.summary().progress.level, before.progress.level, "one exp below the next level");
    const levelBefore = alice.summary();
    const noticesBefore = levelUps.length;
    const levelRun = await paced(14_000);
    const levelWant = afterEarning(levels, levelBefore, { exp: levelRun.exp, lucci: levelRun.lucci });
    assert.equal(levelWant.levelUps, 1);
    assert.equal(alice.summary().progress.level, levelBefore.progress.level + 1);
    assert.deepEqual(alice.summary().wallet, levelWant.wallet, "level-up gift credited with the run");
    assert.equal(levelUps.length, noticesBefore + 1, "the settlement's summary raised the level-up notice");
    assert.deepEqual(notices, [], "no daily-limit notice");
    assert.deepEqual(reports, [], "no settlement error shown");
    console.log(`✓ time attack: new record ${first.exp}/${first.lucci}, slower run ${slower.exp}/${slower.lucci}, ` +
      `<10 s refused, runs within 10 s of the last one or on unknown tracks quietly earn nothing; ` +
      `a settlement crossing Lv.${levelBefore.progress.level}→${alice.summary().progress.level} ` +
      `shows the level-up and credits ${levelWant.gifts.lucci} 金币`);

    // ------------------------------------------- expiry repair (GET profile)
    const accountId = (await ctx.query(`SELECT id FROM accounts WHERE username = ${sqlString(before.account.username)}`))[0][0];
    await ctx.query(`UPDATE inventory_items SET expires_at = ${Date.now() - 1000} WHERE account_id = ${sqlString(accountId)} ` +
      `AND category = 1 AND item_id = ${character.itemId}`);
    await alice.refresh();
    assert.equal(alice.owns(1, character.itemId), false, "the expired rental left the inventory");
    const reloaded = await loadAccountProfile(alice, profileOptions);
    assert.equal(reloaded.profile.equipment.itemIds[1], 3, "GET /api/account/profile replaced the expired character");
    assert.equal(reloaded.profile.equipment.itemIds[3], kart.itemId, "the permanent kart stays equipped");
    assert.deepEqual(ownership.unownedSlots(reloaded.profile.equipment, alice), []);
    console.log("✓ an expired rental is replaced by the starter character on profile load");
    // lobby-open.ts: a hello refused with ITEM_NOT_OWNED repairs the gear and retries with a new ticket.
    aliceClient.dispose();
    await poll(async () => (await gameServers.fetchGameServerList(aliceServers, signal)).servers
      .find(entry => entry.nodeId === "fe-a")?.players === 1, { timeoutMs: 15_000, description: "alice left fe-a" });
    const expiredGear = await errorCodeOf(enterGame(aliceServers, server, alice, raceEquipment));
    assert.equal(expiredGear, "ITEM_NOT_OWNED", "hello with an expired rental is refused");
    const repairedGear = ownership.sanitizeEquipment(raceEquipment, alice);
    assert.equal(repairedGear.itemIds[1], 3);
    clients.push(await enterGame(aliceServers, server, alice, repairedGear));
    console.log("✓ hello with the expired rental → ITEM_NOT_OWNED; the repaired gear enters with a new ticket");

    for (const client of clients) {
      assert.deepEqual(client.rejected, [], "every server event passed the browser validators");
    }
    console.log("\nPASS frontend-economy-check");
  } finally {
    for (const client of clients) client.dispose();
    runtime.clearAccountSession();
    for (const session of sessions) await session.logout().catch(() => {});
  }
});

function clearRequests(session) {
  session.fetchLog.length = 0;
}
