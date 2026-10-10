#!/usr/bin/env node
// Self-contained account-economy check (server-go/ECONOMY.md): builds and
// launches its own kart-data (KART_REGISTRATION=open, guests off, a test
// admin in KART_ADMIN_USERNAMES, rates 1.0, 10000 starting lucci) and two
// kart-game nodes on free loopback ports, with a temporary MySQL database
// and user plus a unique Redis key prefix, then verifies:
//
//   open registration (token returned, password 8–128, first registrant is
//   not an admin, per-IP rate limit 429 TOO_MANY_ATTEMPTS), the admin
//   username listed in KART_ADMIN_USERNAMES (400 INVALID_INVITE without the
//   bootstrap invite KART_BOOTSTRAP_INVITE, which kart-data logs; registered
//   with it), auth/config fields, guest tickets/hello refused
//   (LOGIN_REQUIRED), tickets before onboarding (403 ONBOARDING_REQUIRED),
//   the starter claim (whitelist, idempotent, inventory), /api/account
//   (wallet, level, stats), the shop catalog (ETag/304), purchases
//   (INSUFFICIENT_FUNDS → admin grant → 409 PRICE_CHANGED for a stale
//   expectedPrice/expectedCurrency → OK → ALREADY_OWNED, EXP_REQUIRED,
//   OFFER_NOT_FOUND, rental purchase and extension, idempotent requestId
//   replay, 409 REQUEST_ID_CONFLICT for another offer), the account profile
//   (409 ITEM_NOT_OWNED), unowned equipment on hello/create/join/equipment
//   (ITEM_NOT_OWNED), one live session per account (NICKNAME_TAKEN on the
//   same node, ACCOUNT_ONLINE on another node and for a renamed account),
//   two-account races (an instant finish earns only the unfinished reward;
//   after 10 s of server time a finish counts unless its elapsedMs is more
//   than 3 s shorter than the time the node observed) credited once
//   (including a redelivered settlement), the settlement rates
//   (expRate/lucciRate), stale (> 24 h) and oversized settlement entries
//   stored without rewards, level-up gifts, ledger consistency in MySQL,
//   time-attack rewards and personal bests (400 INVALID_ELAPSED_MS,
//   400 INVALID_TRACK, 429 TOO_MANY_ATTEMPTS pacing, replay), the admin page
//   and admin APIs (refused for non-admins; grant requestId replay is
//   duplicate:true, reuse with other parameters 409 REQUEST_ID_CONFLICT), and
//   persistence across a kart-data restart in KART_REGISTRATION=closed mode.
//   Everything it creates is removed at the end, also on SIGINT/SIGTERM/SIGHUP.
//
// The races wait for 10 s of server time and the time-attack runs respect
// the 10 s pacing, so the script takes about a minute.
//
//   KART_SMOKE_MYSQL_ADMIN='-h127.0.0.1 -P3307 -uroot' KART_SMOKE_REDIS_ADDR=127.0.0.1:6380 \
//     node test/economy-smoke.mjs
//
// Environment: see test/lib/local-cluster.mjs (KART_SMOKE_MYSQL_ADMIN is
// required, otherwise the test is skipped; KART_SMOKE_MYSQL_ADDR,
// KART_SMOKE_REDIS_ADDR/_PASSWORD/_DB, KART_SMOKE_SKIP_BUILD=1, KART_BIN_DIR,
// KART_SMOKE_PORTS=18800-18849, KART_SMOKE_KEEP=1, KART_SMOKE_VERBOSE=1,
// KART_SMOKE_TIMEOUT_MS, KART_SMOKE_SETTLE_TIMEOUT_MS).
//
// Registration is rate limited per client IP (5 per hour). kart-data runs
// with KART_TRUSTED_PROXIES=127.0.0.1/32 and every account sends its own
// X-Forwarded-For address, so the limit applies per scripted player; one
// step deliberately exhausts the limit of a single address.
//
// Expected numbers come from test/lib/economy.mjs (a port of
// internal/shared/rewards and the committed levels.json).
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
  ControlSocket, Player, assertApiError, assertApiErrorIn, assertClientError, assertRaceRewards, claimStarter,
  createPlayer, enterGameWhenFree, equipmentFromInventory, equipmentWith, expectRejectedEntry, expectRejectedHello,
  expectSettlement, helloFields, http, httpOk, issueTicket, poll, randomForwardedFor, randomPassword, register,
  unownedEquipment, waitUntilRaceCounts,
} from "./lib/kart-client.mjs";
import {
  CURRENCIES, RACE, STARTING_LUCCI, afterEarning, findItem, levelForExp, loadLevels, maxLevel, raceRewards,
  timeAttackPacingMs, timeAttackRewards,
} from "./lib/economy.mjs";
import { runLocalCluster, sqlString } from "./lib/local-cluster.mjs";

const DAY_MS = 86_400_000;
const tag = randomBytes(3).toString("hex");
const adminUsername = `econ_admin_${tag}`;
// Listed admin usernames register only with an invite, in every mode; kart-data
// makes sure this one exists at startup and logs it.
const bootstrapInvite = `ECON-BOOT-${tag}`;
const levels = loadLevels();
const rates = { exp: 1, lucci: 1 };
const channelName = "speedIndiCombine";

await runLocalCluster("economy-smoke", {
  dataEnv: {
    KART_REGISTRATION: "open", KART_ALLOW_GUESTS: "false", KART_ADMIN_USERNAMES: adminUsername,
    KART_BOOTSTRAP_INVITE: bootstrapInvite,
    KART_EXP_RATE: String(rates.exp), KART_LUCCI_RATE: String(rates.lucci),
    KART_STARTING_LUCCI: String(STARTING_LUCCI),
  },
  // Game nodes learn the rates from heartbeat responses (contract.HeartbeatResponse.ExpRate).
  // Its racers finish without driving the track, which the anti-cheat
  // would kick (ANTICHEAT.md): it only records here.
  gameEnv: { KART_ALLOW_GUESTS: "false", KART_ANTICHEAT: "log" },
  nodes: [{ nodeId: "econ-a", name: "Economy A" }, { nodeId: "econ-b", name: "Economy B" }],
}, async ctx => {
  const { dataOrigin, cluster, timeoutMs, settleMs, dataNode } = ctx;
  const nodeA = ctx.node("econ-a");
  const nodeB = ctx.node("econ-b");
  const target = { dataOrigin, timeoutMs, forwardedFor: true };
  const get = (path, options = {}) => http(dataOrigin, path, { timeoutMs, ...options });
  console.log(`✓ data service and two game nodes started (${dataOrigin}); admin ${adminUsername}`);

  // ------------------------------------------------------------ registration
  const config = await httpOk(dataOrigin, "/multiplayer/auth/config", { timeoutMs });
  assert.equal(config.registration, "open", `auth/config: ${JSON.stringify(config)}`);
  assert.equal(config.loginRequired, true, "auth/config.loginRequired");
  assert.equal(config.guests, false, "auth/config.guests");

  /** Registers without claiming the starter kit; returns [Player, register body]. */
  const registerPlayer = async (prefix, { passwordValue = randomPassword() } = {}) => {
    const nickname = `${prefix}${tag}`;
    const username = `econ_${prefix.toLowerCase()}_${tag}`;
    const forwardedFor = randomForwardedFor();
    const result = await register(target, { username, nickname, password: passwordValue, forwardedFor });
    assert.equal(result.status, 200, `register ${username}: HTTP ${result.status} ${result.text}`);
    assert.match(result.body?.token ?? "", /^[A-Za-z0-9_-]{43}$/,
      `open registration must return a session token: ${result.text}`);
    assert.equal(result.body.account?.nickname, nickname);
    return [new Player({ dataOrigin, timeoutMs, username, nickname, password: passwordValue,
      token: result.body.token, forwardedFor }), result.body];
  };
  // The first account of the deployment: no longer an automatic admin.
  const [alice, aliceRegistration] = await registerPlayer("EcoA");
  assert.equal(aliceRegistration.account.admin, false, "the first registrant must not become an admin");
  const shortPassword = await register(target, { username: `econ_short_${tag}`, nickname: `Short${tag}`,
    password: "1234567", forwardedFor: randomForwardedFor() });
  assertApiError(shortPassword, 400, "INVALID_ACCOUNT_FIELDS", "7-character password");
  const longPassword = await register(target, { username: `econ_long_${tag}`, nickname: `Long${tag}`,
    password: "x".repeat(129), forwardedFor: randomForwardedFor() });
  assertApiError(longPassword, 400, "INVALID_ACCOUNT_FIELDS", "129-character password");
  const [dora] = await registerPlayer("EcoD", { passwordValue: "8chars!!" });
  // A listed admin username needs an invite even with open registration (no squatting).
  assert.ok(ctx.data.logs.includes(bootstrapInvite),
    "kart-data must log the bootstrap invite for the unregistered admin username");
  const adminFields = invite => ({ username: adminUsername, nickname: `Admin${tag}`, password: randomPassword(),
    forwardedFor: randomForwardedFor(), ...(invite === undefined ? {} : { invite }) });
  assertApiError(await register(target, adminFields()), 400, "INVALID_INVITE", "admin username without an invite");
  assertApiError(await register(target, { ...adminFields(), username: adminUsername.toUpperCase() }),
    400, "INVALID_INVITE", "admin username in other case without an invite");
  assertApiError(await register(target, adminFields(`wrong-${tag}`)), 400, "INVALID_INVITE",
    "admin username with a wrong invite");
  const [admin, adminRegistration] = await (async () => {
    const fields = adminFields(bootstrapInvite);
    const result = await register(target, fields);
    assert.equal(result.status, 200, result.text);
    return [new Player({ dataOrigin, timeoutMs, username: adminUsername, nickname: fields.nickname,
      token: result.body.token, forwardedFor: fields.forwardedFor }), result.body];
  })();
  assert.equal(adminRegistration.account.admin, true, "KART_ADMIN_USERNAMES must make the account an admin");
  assertApiError(await register(target, { username: `econ_reuse_${tag}`, nickname: `Reuse${tag}`,
    password: randomPassword(), invite: bootstrapInvite, forwardedFor: randomForwardedFor() }),
  400, "INVALID_INVITE", "the used bootstrap invite");
  console.log("✓ open registration returns a session; passwords 8–128; admins come from KART_ADMIN_USERNAMES " +
    "and need the logged bootstrap invite (400 INVALID_INVITE without it)");

  // ------------------------------------------------- before onboarding / guests
  assertApiError(await alice.call("/api/account", { token: null }), 401, "LOGIN_REQUIRED", "/api/account without a session");
  assertApiError(await alice.call("/api/inventory", { token: null }), 401, "LOGIN_REQUIRED", "/api/inventory without a session");
  const fresh = await alice.summary();
  assert.equal(fresh.onboarded, false);
  assert.deepEqual(fresh.wallet, { coupon: 0, lucci: STARTING_LUCCI, koin: 0 }, "starting wallet");
  const level1 = levelForExp(levels, 0);
  assert.equal(fresh.progress.level, 1);
  assert.equal(fresh.progress.exp, 0);
  assert.equal(fresh.progress.maxLevel, maxLevel(levels));
  assert.equal(fresh.progress.nextLevelExp, level1.nextLevelExp);
  assert.equal(fresh.progress.gloveName, level1.gloveName);
  assert.deepEqual(fresh.stats, { races: 0, wins: 0, podiums: 0, points: 0 });
  assert.equal(fresh.account.username, alice.username);
  assert.equal(fresh.account.nickname, alice.nickname);
  assert.equal(fresh.account.admin, false);
  assert.ok(Number.isSafeInteger(fresh.account.createdAt), "account.createdAt");
  const freshInventory = await alice.callOk("/api/inventory");
  assert.deepEqual(freshInventory.items, [], "inventory before the starter claim");
  assert.ok(Number.isSafeInteger(freshInventory.serverTime), "inventory.serverTime");
  const ticketPath = "/multiplayer/game-servers/ticket";
  assertApiError(await alice.call(ticketPath, { method: "POST", body: { nodeId: nodeA.nodeId } }),
    403, "ONBOARDING_REQUIRED", "ticket before onboarding");
  assertApiError(await alice.call(ticketPath, { method: "POST", body: { nodeId: nodeA.nodeId }, token: null }),
    401, "LOGIN_REQUIRED", "guest ticket");
  const now = Date.now();
  await expectRejectedHello(cluster, nodeA, helloFields(`Guest${tag}`, ctx.forgeTicket({
    v: 1, node: nodeA.nodeId, data: dataNode, nonce: randomBytes(16).toString("base64url"),
    iat: now, exp: now + 120_000, guest: true,
  })), "LOGIN_REQUIRED");
  console.log("✓ new account: 10000 lucci, Lv.1, empty inventory; guests and un-onboarded tickets refused");

  // ------------------------------------------------------------- starter kit
  const starterPath = "/api/account/starter";
  for (const choice of [{ character: 1, paint: 6, dye: 6 }, { character: 2, paint: 1, dye: 6 },
    { character: 2, paint: 6, dye: 1 }, { character: 3, paint: 6 }, {}]) {
    const result = await alice.call(starterPath, { method: "POST", body: choice });
    assert.equal(result.status, 400, `starter ${JSON.stringify(choice)} must be refused: ${result.status} ${result.text}`);
    assertClientError(result, `starter ${JSON.stringify(choice)}`);
  }
  assert.deepEqual((await alice.callOk("/api/inventory")).items, [], "a refused claim must grant nothing");
  const aliceChoice = { character: 3, paint: 5, dye: 7 };
  await claimStarter(alice, aliceChoice);
  await claimStarter(alice, aliceChoice);
  const other = await alice.call(starterPath, { method: "POST", body: { character: 2, paint: 6, dye: 4 } });
  assert.ok((other.status >= 200 && other.status < 300) || other.status === 409,
    `a second claim with other choices must be idempotent or 409: ${other.status} ${other.text}`);
  const starterItems = await alice.inventory();
  const shape = items => items.map(item => `${item.category}/${item.itemId}/${item.systemKey ?? ""}`).sort();
  assert.deepEqual(shape(starterItems), ["1/3/", "2/5/", "3/0/practiceKart", "70/7/"],
    `starter inventory: ${JSON.stringify(starterItems)}`);
  for (const item of starterItems) {
    assert.equal(item.expiresAt, null, `starter items are permanent: ${JSON.stringify(item)}`);
    assert.ok(Number.isSafeInteger(item.quantity) && item.quantity >= 1, `quantity: ${JSON.stringify(item)}`);
    assert.equal(typeof item.source, "string");
  }
  alice.equipment = equipmentFromInventory(starterItems, aliceChoice);
  const onboarded = await alice.summary();
  assert.equal(onboarded.onboarded, true);
  assert.deepEqual(onboarded.wallet, fresh.wallet, "the starter claim is free");
  await issueTicket(cluster, nodeA, alice);
  console.log("✓ starter kit: whitelist enforced, idempotent, practice kart + character + paint + dye");

  // ----------------------------------------------------------------- catalog
  const catalogResult = await alice.call("/api/shop/catalog");
  assert.equal(catalogResult.status, 200, catalogResult.text.slice(0, 300));
  const catalog = catalogResult.body;
  const etag = catalogResult.headers.get("etag");
  assert.match(catalog.version, /^[0-9a-f]{64}$/, "catalog.version");
  assert.ok(etag && etag.includes(catalog.version), `ETag ${etag} must carry catalog version ${catalog.version}`);
  // Node's fetch sends Accept-Encoding: gzip, deflate and inflates the body itself.
  assert.equal(catalogResult.headers.get("content-encoding"), "gzip", "the catalog is served gzip-compressed");
  const notModified = await alice.call("/api/shop/catalog", { headers: { "If-None-Match": etag } });
  assert.equal(notModified.status, 304, "If-None-Match with the current ETag");
  assert.deepEqual(catalog.starter.characters, [2, 3]);
  assert.equal(catalog.starter.kart.systemKey, "practiceKart");
  assert.ok(Array.isArray(catalog.items) && catalog.items.length > 0, "catalog.items");
  console.log(`✓ catalog ${catalog.version.slice(0, 12)}… with ${catalog.items.length} items; ETag/304`);

  const itemKey = item => `${item.category}:${item.itemId}`;
  const starterKeys = new Set(["3:0", "1:2", "1:3", ...[6, 4, 5, 7].flatMap(id => [`2:${id}`, `70:${id}`])]);
  /** Cheapest matching offer of an unowned single item, characters first. */
  const pickOffer = (predicate, exclude = []) => {
    const candidates = [];
    for (const item of catalog.items) {
      if (item.isAdditional || starterKeys.has(itemKey(item)) || exclude.includes(itemKey(item))) continue;
      for (const offer of item.offers) if (offer.count === 1 && predicate(offer)) candidates.push({ item, offer });
    }
    candidates.sort((a, b) => (a.item.category === 1 ? 0 : 1) - (b.item.category === 1 ? 0 : 1) ||
      a.offer.price - b.offer.price);
    return candidates[0];
  };
  const permanent = pickOffer(offer => offer.currency === "coupon" && offer.days === 0 && !offer.minExp);
  assert.ok(permanent, "the catalog has no coupon permanent offer");
  const rental = pickOffer(offer => offer.currency === "lucci" && offer.days > 0 && !offer.minExp &&
    offer.price * 2 <= STARTING_LUCCI - 1000, [itemKey(permanent.item)]);
  assert.ok(rental, "the catalog has no affordable lucci rental offer");
  const gated = pickOffer(offer => offer.currency === "coupon" && offer.minExp > 0,
    [itemKey(permanent.item), itemKey(rental.item)]);
  const unownedCharacter = catalog.items.find(item => item.category === 1 && !starterKeys.has(itemKey(item)) &&
    itemKey(item) !== itemKey(permanent.item) && itemKey(item) !== itemKey(rental.item));
  console.log(`  offers: permanent ${permanent.offer.offerId} (${permanent.item.name}, ${permanent.offer.price} coupon), ` +
    `rental ${rental.offer.offerId} (${rental.item.name}, ${rental.offer.days} days, ${rental.offer.price} lucci)` +
    (gated ? `, exp-gated ${gated.offer.offerId} (minExp ${gated.offer.minExp})` : ""));

  // --------------------------------------------------------------- purchases
  const purchasePath = "/api/shop/purchase";
  const purchase = (player, offerId, requestId = randomUUID(), expected = {}) =>
    player.call(purchasePath, { method: "POST", body: { offerId, requestId, ...expected } });
  const grant = (body, by = admin) => by.call("/api/admin/grant", { method: "POST",
    body: { note: `economy-smoke ${tag}`, ...body } });
  const walletOf = async player => (await player.summary()).wallet;

  assertApiError(await alice.call(purchasePath, { method: "POST", token: null,
    body: { offerId: permanent.offer.offerId, requestId: randomUUID() } }), 401, "LOGIN_REQUIRED", "purchase without a session");
  assertApiErrorIn(await purchase(alice, "s999999999"), [400, 404], "OFFER_NOT_FOUND", "unknown offer");
  assertApiErrorIn(await purchase(alice, permanent.offer.offerId), [400, 402, 403, 409], "INSUFFICIENT_FUNDS",
    "coupon purchase with 0 coupons");
  assert.deepEqual(await walletOf(alice), fresh.wallet, "a refused purchase must not charge");

  // Admin APIs refuse everyone else.
  assertApiError(await grant({ username: alice.username, currency: "coupon", amount: 1000 }, alice),
    403, "ADMIN_REQUIRED", "grant by a non-admin");
  assertApiError(await alice.call("/api/admin/grant", { method: "POST", token: null,
    body: { username: alice.username, currency: "coupon", amount: 1000, note: "x" } }), 401, "LOGIN_REQUIRED",
  "grant without a session");
  assertApiError(await alice.call(`/api/admin/accounts?q=${alice.username}`), 403, "ADMIN_REQUIRED",
    "account search by a non-admin");
  assert.deepEqual(await walletOf(alice), fresh.wallet);

  const price = permanent.offer.price;
  const granted = await grant({ username: alice.username, currency: "coupon", amount: price });
  assert.ok(granted.status >= 200 && granted.status < 300, `admin grant: ${granted.status} ${granted.text}`);
  assert.equal((await walletOf(alice)).coupon, price, "granted coupons");
  // The shop sends the price it showed; a stale one is refused before anything is charged.
  const shown = { expectedPrice: price, expectedCurrency: permanent.offer.currency };
  assertApiError(await purchase(alice, permanent.offer.offerId, randomUUID(), { ...shown, expectedPrice: price + 1 }),
    409, "PRICE_CHANGED", "purchase with a stale expectedPrice");
  assertApiError(await purchase(alice, permanent.offer.offerId, randomUUID(), { ...shown, expectedCurrency: "lucci" }),
    409, "PRICE_CHANGED", "purchase with a stale expectedCurrency");
  assert.deepEqual(await walletOf(alice), { ...fresh.wallet, coupon: price }, "PRICE_CHANGED must not charge");
  assert.equal(findItem(await alice.inventory(), permanent.item.category, permanent.item.itemId), undefined,
    "PRICE_CHANGED must not grant the item");
  const permanentRequest = randomUUID();
  const bought = await purchase(alice, permanent.offer.offerId, permanentRequest, shown);
  assert.equal(bought.status, 200, `purchase ${permanent.offer.offerId}: ${bought.status} ${bought.text}`);
  assert.deepEqual(bought.body.wallet, { ...fresh.wallet, coupon: 0 }, "wallet after the coupon purchase");
  assert.equal(bought.body.item?.category, permanent.item.category);
  assert.equal(bought.body.item?.itemId, permanent.item.itemId);
  assert.equal(bought.body.item?.expiresAt, null, "a permanent offer grants a permanent item");
  assert.ok(bought.body.purchaseId !== undefined && bought.body.purchaseId !== null, "purchaseId");
  assert.ok(findItem(await alice.inventory(), permanent.item.category, permanent.item.itemId),
    "the bought item must be in the inventory");
  await grant({ username: alice.username, currency: "coupon", amount: price });
  assertApiError(await purchase(alice, permanent.offer.offerId), 409, "ALREADY_OWNED", "permanent item bought twice");
  assert.equal((await walletOf(alice)).coupon, price, "ALREADY_OWNED must not charge");
  const replayedPermanent = await purchase(alice, permanent.offer.offerId, permanentRequest);
  assert.equal(replayedPermanent.status, 200, `replayed requestId: ${replayedPermanent.status} ${replayedPermanent.text}`);
  assert.equal(String(replayedPermanent.body.purchaseId), String(bought.body.purchaseId), "a replay returns the original purchase");
  assert.equal((await walletOf(alice)).coupon, price, "a replayed requestId must not charge again");
  // Reusing a requestId for another offer must never buy that offer.
  assertApiError(await purchase(alice, rental.offer.offerId, permanentRequest), 409, "REQUEST_ID_CONFLICT",
    "a requestId reused for another offer");
  assert.equal((await walletOf(alice)).lucci, fresh.wallet.lucci, "a reused requestId must not charge");
  assert.equal(findItem(await alice.inventory(), rental.item.category, rental.item.itemId), undefined,
    "a reused requestId must not grant another item");
  console.log("✓ INSUFFICIENT_FUNDS → admin grant → PRICE_CHANGED (stale price/currency) → purchase → " +
    "ALREADY_OWNED; requestId replay is idempotent, reuse for another offer 409 REQUEST_ID_CONFLICT");

  if (gated) {
    const needed = Math.max(0, gated.offer.price - price);
    if (needed > 0) await grant({ username: alice.username, currency: "coupon", amount: needed });
    const before = await walletOf(alice);
    assertApiErrorIn(await purchase(alice, gated.offer.offerId), [400, 403, 409], "EXP_REQUIRED",
      `offer with minExp ${gated.offer.minExp}`);
    assert.deepEqual(await walletOf(alice), before, "EXP_REQUIRED must not charge");
    console.log("✓ offers with an experience requirement answer EXP_REQUIRED");
  }

  const beforeRental = await walletOf(alice);
  const days = rental.offer.days;
  const startedAt = Date.now();
  const rented = await purchase(alice, rental.offer.offerId);
  const rentedAt = Date.now();
  assert.equal(rented.status, 200, `rental purchase: ${rented.status} ${rented.text}`);
  const firstExpiry = rented.body.item?.expiresAt;
  assert.ok(Number.isSafeInteger(firstExpiry) && firstExpiry >= startedAt + days * DAY_MS - 5000 &&
    firstExpiry <= rentedAt + days * DAY_MS + 5000, `rental expiresAt ${firstExpiry} is not now + ${days} days`);
  assert.equal(rented.body.wallet.lucci, beforeRental.lucci - rental.offer.price);
  const extendRequest = randomUUID();
  const extended = await purchase(alice, rental.offer.offerId, extendRequest);
  assert.equal(extended.status, 200, `rental extension: ${extended.status} ${extended.text}`);
  const secondExpiry = extended.body.item?.expiresAt;
  assert.ok(Math.abs(secondExpiry - (firstExpiry + days * DAY_MS)) <= 1000,
    `a second rental must extend from the old expiry: ${firstExpiry} + ${days} days ≠ ${secondExpiry}`);
  assert.equal(extended.body.wallet.lucci, beforeRental.lucci - 2 * rental.offer.price);
  const replayedRental = await purchase(alice, rental.offer.offerId, extendRequest);
  assert.equal(replayedRental.status, 200, replayedRental.text);
  assert.equal(String(replayedRental.body.purchaseId), String(extended.body.purchaseId));
  assert.equal((await walletOf(alice)).lucci, beforeRental.lucci - 2 * rental.offer.price,
    "a replayed rental must not charge again");
  assert.equal(findItem(await alice.inventory(), rental.item.category, rental.item.itemId)?.expiresAt, secondExpiry,
    "a replayed rental must not extend again");
  console.log(`✓ rental ${days} days, extension from the old expiry, replay changes nothing`);

  // ----------------------------------------------------------------- profile
  const profilePath = "/api/account/profile";
  const profileDocument = equipment => ({ equipment, initial: "", favoriteTracks: [], favoriteItems: [],
    lockedItems: [], myRoom: { environmentId: 16, displayName: "我的小屋", message: "" } });
  const profileRead = await alice.call(profilePath);
  assert.ok([200, 404].includes(profileRead.status), `GET ${profilePath}: ${profileRead.status} ${profileRead.text}`);
  assertApiError(await alice.call(profilePath, { method: "PUT", body: profileDocument(unownedEquipment()) }),
    409, "ITEM_NOT_OWNED", "profile with an unowned kart");
  if (unownedCharacter) {
    assertApiError(await alice.call(profilePath, { method: "PUT",
      body: profileDocument(equipmentWith(alice.equipment, { 1: unownedCharacter.itemId })) }),
    409, "ITEM_NOT_OWNED", "profile with an unowned character");
  }
  const ownedEquipment = equipmentWith(alice.equipment, { [permanent.item.category]: permanent.item.itemId },
    { systemKart: "practiceKart" });
  const saved = await alice.call(profilePath, { method: "PUT", body: profileDocument(ownedEquipment) });
  assert.ok(saved.status >= 200 && saved.status < 300, `PUT ${profilePath}: ${saved.status} ${saved.text}`);
  const savedProfile = await alice.callOk(profilePath);
  const savedDocument = savedProfile.profile ?? savedProfile;
  assert.equal(savedDocument.equipment?.itemIds?.[String(permanent.item.category)], permanent.item.itemId,
    `saved profile equipment: ${JSON.stringify(savedProfile).slice(0, 400)}`);
  console.log("✓ account profile: unowned equipment answers 409 ITEM_NOT_OWNED, owned equipment is saved");

  // ------------------------------------------------------------- multiplayer
  const bobChoice = { character: 2, paint: 6, dye: 4 };
  const bob = await createPlayer(target, `EcoB${tag}`, { starter: bobChoice });
  // hello with equipment the account does not own.
  {
    const ticket = await issueTicket(cluster, nodeB, bob);
    const control = ctx.track(await ControlSocket.connect(nodeB.wsUrl, { timeoutMs, label: "bob-unowned" }));
    const reply = await control.send(helloFields(bob.nickname, ticket.ticket, unownedEquipment()));
    // Refused (the browser then re-reads its inventory, falls back to owned
    // gear and enters with a new ticket); nothing of it reaches a room.
    assert.equal(reply.type, "error", `hello with unowned equipment: ${JSON.stringify(reply)}`);
    assert.equal(reply.code, "ITEM_NOT_OWNED", `hello with unowned equipment: ${JSON.stringify(reply)}`);
    console.log("✓ hello with unowned equipment answers ITEM_NOT_OWNED");
    control.close();
  }

  const aliceIn = await enterGameWhenFree(cluster, nodeA, alice);
  ctx.track(aliceIn.control);
  const bobIn = await enterGameWhenFree(cluster, nodeA, bob, { timeoutMs: 20_000 });
  ctx.track(bobIn.control);
  const aliceId = aliceIn.welcome.playerId;
  const bobId = bobIn.welcome.playerId;

  // One live session per account: the node's own nickname check refuses a
  // second session on the same node, the data service's account claim one on
  // another node, and the node's account check one under a new nickname.
  await expectRejectedEntry(cluster, nodeA, alice, "NICKNAME_TAKEN");
  await expectRejectedEntry(cluster, nodeB, alice, "ACCOUNT_ONLINE");
  const renamed = `EcoR${tag}`;
  const rename = nickname => alice.callOk("/multiplayer/auth/nickname", { method: "POST", body: { nickname } });
  assert.equal((await rename(renamed)).account.nickname, renamed);
  try {
    await expectRejectedEntry(cluster, nodeA, alice, "ACCOUNT_ONLINE");
    await expectRejectedEntry(cluster, nodeB, alice, "ACCOUNT_ONLINE");
  } finally {
    await rename(alice.nickname);
  }
  console.log("✓ one session per account: NICKNAME_TAKEN on the same node, ACCOUNT_ONLINE on another node " +
    "and after a rename");

  const roomFields = { type: "create", name: `Eco${tag}`, capacity: 2, password: "", channelName,
    gameplay: "ordinary", mode: "individual", speed: 7, speedVersion: "国服" };
  await aliceIn.control.expectError({ ...roomFields, equipment: unownedEquipment() }, "ITEM_NOT_OWNED");
  const created = await aliceIn.control.request({ ...roomFields, equipment: alice.equipment });
  const roomId = created.room.roomId;
  await bobIn.control.expectError({ type: "join", roomId, password: "", equipment: unownedEquipment() }, "ITEM_NOT_OWNED");
  const joined = await bobIn.control.request({ type: "join", roomId, password: "", equipment: bob.equipment });
  assert.equal(joined.room.members.length, 2);
  await aliceIn.control.expectError({ type: "equipment", roomId, equipment: unownedEquipment() }, "ITEM_NOT_OWNED");
  const rentalEquipment = equipmentWith(alice.equipment, { [rental.item.category]: rental.item.itemId },
    { systemKart: "practiceKart" });
  const equipped = await aliceIn.control.request({ type: "equipment", roomId, equipment: rentalEquipment });
  assert.equal(equipped.room.members.find(member => member.playerId === aliceId)
    ?.equipment?.itemIds?.[String(rental.item.category)], rental.item.itemId, "rented item equipped in the room");
  console.log("✓ create/join/equipment refuse unowned items (ITEM_NOT_OWNED); bought and rented items are accepted");

  /**
   * One race of alice (host) and bob from the open room at `revision`:
   * ready, start, load, then `beforeFinish` (e.g. wait for 10 s of server
   * time), alice finishes, then bob. Returns the finished snapshot and the
   * revision of the room after both returned.
   */
  const runRace = async (revision, { aliceMs, bobMs, beforeFinish = async () => {} }) => {
    const ready = await bobIn.control.request({ type: "ready", roomId, revision, ready: true });
    const started = await aliceIn.control.request({ type: "start", roomId, revision: ready.room.revision });
    const raceId = started.room.race.raceId;
    await aliceIn.control.request({ type: "loaded", roomId, raceId });
    await bobIn.control.request({ type: "loaded", roomId, raceId });
    const racing = await aliceIn.control.waitFor(message => message.type === "room" &&
      message.room?.roomId === roomId && message.room?.phase === "racing", "racing phase");
    await beforeFinish(racing.room.race);
    await aliceIn.control.request({ type: "finish", roomId, raceId, elapsedMs: aliceMs });
    const finished = await bobIn.control.request({ type: "finish", roomId, raceId, elapsedMs: bobMs });
    assert.equal(finished.room.phase, "finished");
    assert.equal(finished.room.race.results.length, 2);
    await aliceIn.control.request({ type: "return-room", roomId, raceId });
    const back = await bobIn.control.request({ type: "return-room", roomId, raceId });
    assert.equal(back.room.phase, "open");
    return { raceId, race: finished.room.race, revision: back.room.revision };
  };
  /** Waits for `player`'s credited exp, then compares wallet, level and stats. */
  const expectCredited = async (player, before, earned, stats) => {
    const expected = afterEarning(levels, before, earned);
    const summary = await poll(async () => {
      const current = await player.summary();
      return current.progress.exp === expected.progress.exp ? current : undefined;
    }, { timeoutMs: settleMs, description: `${player.username} exp to reach ${expected.progress.exp}` });
    assert.deepEqual(summary.wallet, expected.wallet, `${player.username} wallet (level-up gifts ${JSON.stringify(expected.gifts)})`);
    for (const field of ["level", "levelExp", "nextLevelExp", "glove", "gloveName"]) {
      assert.equal(summary.progress[field], expected.progress[field], `${player.username} progress.${field}`);
    }
    if (stats) assert.deepEqual(summary.stats, stats, `${player.username} stats`);
    return summary;
  };

  // Race 1: both finish at once. race.results rank them as reported, but
  // less than 10 s of server time passed, so both earn the unfinished reward.
  const aliceBefore = await alice.summary();
  const bobBefore = await bob.summary();
  const instant = await runRace(equipped.room.revision, { aliceMs: 60_000, bobMs: 65_000 });
  assert.deepEqual(instant.race.results.map(row => row.playerId), [aliceId, bobId]);
  const instantRewards = raceRewards({ channel: channelName, rates, racers: [
    { playerId: aliceId, rank: 1, finished: false }, { playerId: bobId, rank: 2, finished: false }] });
  assert.deepEqual(instantRewards[aliceId], { exp: 11, lucci: 10 }, "unfinished reward x1.1 (Combine channel)");
  assertRaceRewards(instant.race, [aliceId, bobId], { expected: instantRewards, label: "instant race" });
  await expectSettlement(cluster, { raceId: instant.raceId, roomId, gameplay: "ordinary", timeoutMs: settleMs,
    racers: [
      { name: alice.nickname, playerId: aliceId, rank: 1, elapsedMs: 60_000, points: 10 },
      { name: bob.nickname, playerId: bobId, rank: 2, elapsedMs: 65_000, points: 8 },
    ] });
  const aliceMid = await expectCredited(alice, aliceBefore, instantRewards[aliceId],
    { races: 1, wins: 1, podiums: 1, points: 10 });
  const bobMid = await expectCredited(bob, bobBefore, instantRewards[bobId],
    { races: 1, wins: 0, podiums: 1, points: 8 });
  console.log(`✓ a race finished within 10 s of server time earns only the unfinished reward ` +
    `${JSON.stringify(instantRewards[aliceId])} (credited once)`);

  // Race 2: after 10 s of server time. Alice's finish counts; bob reports a
  // time more than 3 s shorter than the node observed, so he ranks first in
  // race.results (Java order) but earns only the unfinished reward, and
  // alice gets the winner's reward.
  const counted = await runRace(instant.revision, { aliceMs: 60_000, bobMs: 5_000,
    beforeFinish: race => waitUntilRaceCounts(aliceIn.control, race) });
  const raceId = counted.raceId;
  assert.deepEqual(counted.race.results.map(row => row.playerId), [bobId, aliceId]);
  const expectedRewards = raceRewards({ channel: channelName, rates, racers: [
    { playerId: aliceId, rank: 1, finished: true }, { playerId: bobId, rank: 2, finished: false }] });
  assert.deepEqual(expectedRewards[aliceId], { exp: 88, lucci: 120 }, "winner of 2 in a Combine channel");
  assertRaceRewards(counted.race, [aliceId, bobId], { expected: expectedRewards, label: "10-second race" });
  console.log(`✓ after 10 s of server time: race.rewards ${JSON.stringify(expectedRewards[aliceId])} for the ` +
    `finish, ${JSON.stringify(expectedRewards[bobId])} for an elapsedMs shorter than the observed time`);

  await expectSettlement(cluster, { raceId, roomId, gameplay: "ordinary", timeoutMs: settleMs, racers: [
    { name: bob.nickname, playerId: bobId, rank: 1, elapsedMs: 5_000, points: 10 },
    { name: alice.nickname, playerId: aliceId, rank: 2, elapsedMs: 60_000, points: 8 },
  ] });
  const aliceAfter = await expectCredited(alice, aliceMid, expectedRewards[aliceId],
    { races: 2, wins: 1, podiums: 2, points: 18 });
  const bobAfter = await expectCredited(bob, bobMid, expectedRewards[bobId],
    { races: 2, wins: 1, podiums: 2, points: 18 });
  console.log(`✓ settlement credited: ${alice.username} Lv.${aliceAfter.progress.level} ` +
    `(${aliceAfter.progress.level - aliceBefore.progress.level} level-ups), ${bob.username} Lv.${bobAfter.progress.level}`);

  // ------------------------------------------------------- ledger (MySQL)
  const accountIds = new Map();
  const accountIdOf = async player => {
    if (!accountIds.has(player.username)) {
      const rows = await ctx.query(`SELECT id FROM accounts WHERE username = ${sqlString(player.username)}`);
      assert.equal(rows.length, 1, `account row of ${player.username}`);
      accountIds.set(player.username, rows[0][0]);
    }
    return accountIds.get(player.username);
  };
  /**
   * wallet_ledger must chain (balance_after − delta = previous balance_after,
   * starting at 0 or the starting lucci), end at the API balance and never go
   * negative; exp_ledger must sum to progress.exp; wallets/account_progress
   * rows must agree with /api/account. Returns the row counts.
   */
  const checkLedger = async player => {
    const id = sqlString(await accountIdOf(player));
    const summary = await player.summary();
    const rows = await ctx.query(`SELECT currency, delta, balance_after FROM wallet_ledger ` +
      `WHERE account_id = ${id} ORDER BY id`);
    for (const currency of CURRENCIES) {
      const initial = currency === "lucci" ? STARTING_LUCCI : 0;
      const entries = rows.filter(row => row[0] === currency).map(row => ({ delta: Number(row[1]), after: Number(row[2]) }));
      if (entries.length === 0) {
        assert.equal(summary.wallet[currency], initial, `${player.username}: ${currency} without ledger rows`);
        continue;
      }
      const start = entries[0].after - entries[0].delta;
      assert.ok(start === 0 || start === initial, `${player.username}: ${currency} ledger starts at ${start}`);
      let balance = entries[0].after;
      for (const entry of entries.slice(1)) {
        assert.equal(entry.after - entry.delta, balance, `${player.username}: broken ${currency} ledger chain`);
        balance = entry.after;
      }
      assert.ok(entries.every(entry => entry.after >= 0), `${player.username}: negative ${currency} balance`);
      assert.equal(balance, summary.wallet[currency], `${player.username}: ${currency} ledger ≠ wallet`);
    }
    const walletRows = await ctx.query(`SELECT coupon, lucci, koin FROM wallets WHERE account_id = ${id}`);
    if (walletRows.length > 0) {
      assert.deepEqual(walletRows[0].map(Number), CURRENCIES.map(currency => summary.wallet[currency]),
        `${player.username}: wallets row ≠ /api/account`);
    }
    const expRows = await ctx.query(`SELECT delta, exp_after FROM exp_ledger WHERE account_id = ${id} ORDER BY id`);
    let exp = 0;
    for (const [delta, after] of expRows) {
      exp += Number(delta);
      assert.equal(Number(after), exp, `${player.username}: broken exp ledger chain`);
    }
    assert.equal(exp, summary.progress.exp, `${player.username}: exp ledger ≠ progress.exp`);
    const progressRows = await ctx.query(`SELECT exp, level FROM account_progress WHERE account_id = ${id}`);
    if (progressRows.length > 0) {
      assert.equal(Number(progressRows[0][0]), summary.progress.exp, `${player.username}: account_progress.exp`);
      if (summary.progress.exp > 0) {
        assert.equal(Number(progressRows[0][1]), summary.progress.level, `${player.username}: account_progress.level`);
      }
    } else {
      assert.equal(summary.progress.exp, 0, `${player.username}: no account_progress row`);
    }
    return { wallet: rows.length, exp: expRows.length };
  };
  const aliceRows = await checkLedger(alice);
  const bobRows = await checkLedger(bob);
  console.log("✓ wallet and exp ledgers chain to the balances shown by /api/account");

  // A redelivered settlement (same raceId) must not credit again.
  const settlement = (id, room, entries, extra = {}) => ({
    nodeId: nodeA.nodeId, raceId: id, roomId: room, mode: "individual", gameplay: "ordinary",
    trackId: "village_R01",
    snapshot: { roomId: room, mode: "individual", gameplay: "ordinary", race: { raceId: id, trackId: "village_R01",
      results: [], rewards: Object.fromEntries(entries.map(entry => [entry.playerId,
        { exp: entry.exp, lucci: entry.lucci }])) } },
    results: entries.map((entry, index) => ({ playerId: entry.playerId, accountId: entry.accountId,
      name: entry.name, rank: index + 1, elapsedMs: 60_000 + index * 5000, points: index === 0 ? 10 : 8 })),
    rewards: entries.map(entry => ({ playerId: entry.playerId, accountId: entry.accountId,
      exp: entry.exp, lucci: entry.lucci })),
    finishedAt: Date.now(),
    ...extra,
  });
  const postRace = async body => {
    const result = await ctx.internalPost("/internal/v1/races", body);
    assert.equal(result.status, 200, `internal races: ${result.status} ${result.text}`);
    return result.body;
  };
  const redelivered = await postRace(settlement(raceId, roomId, [
    { playerId: aliceId, accountId: await accountIdOf(alice), name: alice.nickname, ...expectedRewards[aliceId] },
    { playerId: bobId, accountId: await accountIdOf(bob), name: bob.nickname, ...expectedRewards[bobId] },
  ]));
  assert.deepEqual(redelivered, { stored: true, duplicate: true });
  assert.deepEqual(await alice.summary(), aliceAfter, "a redelivered race must not credit again");
  assert.deepEqual(await bob.summary(), bobAfter, "a redelivered race must not credit again");
  assert.deepEqual(await checkLedger(alice), aliceRows);
  assert.deepEqual(await checkLedger(bob), bobRows);
  const bobEntry = async reward => [{ playerId: randomUUID(), accountId: await accountIdOf(bob), name: bob.nickname,
    ...reward }];
  // A settlement carries the rates its rewards were shown with; the data
  // service credits with them (within [0, max(10, configured)]).
  const extra = settlement(randomUUID(), randomUUID(), await bobEntry({ exp: 10, lucci: 15 }),
    { expRate: 2, lucciRate: 1 });
  assert.deepEqual(await postRace(extra), { stored: true, duplicate: false });
  assert.deepEqual(await postRace(extra), { stored: true, duplicate: true });
  let bobExtra = await expectCredited(bob, bobAfter, { exp: 20, lucci: 15 },
    { races: 3, wins: 2, podiums: 3, points: 28 });
  // Finished more than 24 h ago, or above the per-entry maximum (exp 145 /
  // lucci 216 before rates): the race is stored and counted, nothing credited.
  const stale = settlement(randomUUID(), randomUUID(), await bobEntry({ exp: 10, lucci: 15 }),
    { finishedAt: Date.now() - RACE.staleSettlementMs - 60_000 });
  assert.deepEqual(await postRace(stale), { stored: true, duplicate: false });
  const oversized = settlement(randomUUID(), randomUUID(),
    await bobEntry({ exp: RACE.maxEntryExp + 1, lucci: 15 }));
  assert.deepEqual(await postRace(oversized), { stored: true, duplicate: false });
  const bobStored = await poll(async () => {
    const current = await bob.summary();
    return current.stats.races === 5 ? current : undefined;
  }, { timeoutMs: settleMs, description: "the stale and oversized settlements in bob's stats" });
  assert.deepEqual(bobStored.stats, { races: 5, wins: 4, podiums: 5, points: 48 });
  assert.deepEqual({ progress: bobStored.progress, wallet: bobStored.wallet },
    { progress: bobExtra.progress, wallet: bobExtra.wallet }, "stale and oversized entries credit nothing");
  bobExtra = bobStored;
  await checkLedger(bob);
  console.log("✓ settlements credit rewards once per raceId and account with the rates they carry; " +
    "stale (> 24 h) and oversized entries are stored without rewards");

  // ------------------------------------------------------------ time attack
  const settlePath = "/api/timeattack/settle";
  const settle = (player, elapsedMs, requestId = randomUUID(), trackId = "village_R01") =>
    player.call(settlePath, { method: "POST", body: { trackId, elapsedMs, requestId } });
  assertApiError(await settle(bob, 5000), 400, "INVALID_ELAPSED_MS", "time-attack run under 10 s");
  assertApiError(await settle(bob, 13_000, randomUUID(), `no_such_track_${tag}`), 400, "INVALID_TRACK",
    "time-attack run on a track outside tracks.json");
  assert.deepEqual(await bob.summary(), bobExtra, "an invalid run must not change the account");
  let bobState = bobExtra;
  // Pacing: the next run must come at least 10 s, and at least its own time
  // minus 3 s, after the previous settled one (429 TOO_MANY_ATTEMPTS).
  let lastSettled = 0;
  const run = async (elapsedMs, newRecord, requestId = randomUUID()) => {
    const wait = lastSettled + timeAttackPacingMs(elapsedMs) + 300 - Date.now();
    if (wait > 0) await delay(wait);
    const result = await settle(bob, elapsedMs, requestId);
    lastSettled = Date.now();
    assert.equal(result.status, 200, `time attack ${elapsedMs} ms: ${result.status} ${result.text}`);
    const expected = timeAttackRewards(newRecord, rates);
    assert.deepEqual({ exp: result.body.exp, lucci: result.body.lucci, newRecord: result.body.newRecord },
      { ...expected, newRecord }, `time attack ${elapsedMs} ms`);
    assert.equal(result.body.capped, false, "first runs of the day are not capped");
    return { result, expected, requestId };
  };
  const first = await run(13_000, true);
  bobState = await expectCredited(bob, bobState, first.expected);
  const replayedRun = await settle(bob, 13_000, first.requestId);
  assert.equal(replayedRun.status, 200, replayedRun.text);
  assert.deepEqual({ exp: replayedRun.body.exp, lucci: replayedRun.body.lucci, newRecord: replayedRun.body.newRecord },
    { ...first.expected, newRecord: true }, "a replayed settle returns the original result");
  assertApiError(await settle(bob, 14_000, first.requestId), 409, "REQUEST_ID_CONFLICT",
    "a settle requestId reused with another time");
  assertApiError(await settle(bob, 14_000), 429, "TOO_MANY_ATTEMPTS", "a run settled right after the previous one");
  assert.deepEqual(await bob.summary(), bobState, "replayed and refused settles must not credit");
  const slower = await run(14_000, false);
  bobState = await expectCredited(bob, bobState, slower.expected);
  const faster = await run(12_000, true);
  bobState = await expectCredited(bob, bobState, faster.expected);
  assert.equal(faster.result.body.bestMs, 12_000);
  await checkLedger(bob);
  console.log("✓ time attack: 10/20 per run, +20/+50 for a personal best, 400 INVALID_ELAPSED_MS/INVALID_TRACK, " +
    "429 TOO_MANY_ATTEMPTS within the pacing interval, replay-safe");

  // ------------------------------------------------------------------ admin
  const page = await get("/multiplayer/admin");
  assert.equal(page.status, 200, `GET /multiplayer/admin: ${page.status}`);
  assert.match(page.headers.get("content-type") ?? "", /text\/html/);
  assert.match(page.text, /<html|<!doctype html/i);
  const search = await admin.call(`/api/admin/accounts?q=${encodeURIComponent(alice.username)}`);
  assert.equal(search.status, 200, `admin account search: ${search.status} ${search.text}`);
  assert.ok(search.text.includes(alice.username), `admin account search lacks ${alice.username}: ${search.text.slice(0, 300)}`);
  const doraBefore = await dora.summary();
  const expGrant = await grant({ username: dora.username, currency: "exp", amount: 100 });
  assert.ok(expGrant.status >= 200 && expGrant.status < 300, `exp grant: ${expGrant.status} ${expGrant.text}`);
  const doraAfter = await dora.summary();
  assert.equal(doraAfter.progress.exp, 100);
  assert.equal(doraAfter.progress.level, levelForExp(levels, 100).level);
  assertClientError(await grant({ username: `nobody_${tag}`, currency: "lucci", amount: 1 }), "grant to an unknown account");
  assertClientError(await grant({ username: dora.username, currency: "gold", amount: 1 }), "grant of an unknown currency");
  const overdraw = await grant({ username: dora.username, currency: "lucci", amount: -(doraAfter.wallet.lucci + 1) });
  assertClientError(overdraw, "grant that would make a balance negative");
  assert.deepEqual((await dora.summary()).wallet, doraAfter.wallet, "a refused deduction changes nothing");
  const deduct = await grant({ username: dora.username, currency: "lucci", amount: -100 });
  assert.ok(deduct.status >= 200 && deduct.status < 300, `deduction: ${deduct.status} ${deduct.text}`);
  assert.equal((await dora.summary()).wallet.lucci, doraAfter.wallet.lucci - 100);
  // An admin grant with a requestId is applied once (the admin page retries safely).
  const grantRequest = randomUUID();
  const koinBefore = (await dora.summary()).wallet.koin;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await grant({ username: dora.username, currency: "koin", amount: 7, requestId: grantRequest });
    assert.ok(result.status >= 200 && result.status < 300, `koin grant: ${result.status} ${result.text}`);
    assert.equal(result.body.duplicate, attempt === 1, `koin grant attempt ${attempt + 1}: ${result.text}`);
  }
  assert.equal((await dora.summary()).wallet.koin, koinBefore + 7, "a repeated grant requestId applies once");
  // The requestId stands for one grant: other amount, currency or account → 409 REQUEST_ID_CONFLICT.
  for (const conflict of [{ username: dora.username, currency: "koin", amount: 8 },
    { username: dora.username, currency: "coupon", amount: 7 }, { username: alice.username, currency: "koin", amount: 7 }]) {
    assertApiError(await grant({ ...conflict, requestId: grantRequest }), 409, "REQUEST_ID_CONFLICT",
      `grant requestId reused for ${JSON.stringify(conflict)}`);
  }
  assert.equal((await dora.summary()).wallet.koin, koinBefore + 7, "a conflicting grant changes nothing");
  await checkLedger(dora);
  await checkLedger(alice);
  assert.equal(doraBefore.progress.exp, 0);
  console.log("✓ admin page, account search, exp/currency grants and deductions (never below zero); " +
    "grant requestId replay duplicate:true, reuse 409 REQUEST_ID_CONFLICT");

  // ------------------------------------------------- registration rate limit
  const sharedAddress = randomForwardedFor();
  let accepted = 0;
  let limited;
  for (let attempt = 1; attempt <= 12 && !limited; attempt++) {
    const result = await http(dataOrigin, "/multiplayer/auth/register", { method: "POST", timeoutMs,
      body: { username: `econ_rl${attempt}_${tag}`, nickname: `Rl${attempt}${tag}`, password: randomPassword() },
      headers: { "X-Forwarded-For": sharedAddress } });
    if (result.status === 429) limited = result;
    else {
      assert.equal(result.status, 200, `registration ${attempt}: ${result.status} ${result.text}`);
      accepted++;
    }
  }
  assert.ok(limited, "12 registrations from one address were never rate limited");
  assert.equal(limited.body?.error, "TOO_MANY_ATTEMPTS");
  assert.ok(accepted >= 1, "the first registration from an address must succeed");
  await registerPlayer("EcoE");
  console.log(`✓ registration limited to ${accepted} per address (429 TOO_MANY_ATTEMPTS); other addresses unaffected`);

  // ------------------------------------- restart with registration closed
  aliceIn.control.close();
  bobIn.control.close();
  // Let the nodes release both nicknames and accounts before the data service goes away.
  await poll(async () => {
    for (const player of [alice, bob]) {
      for (const key of [`presence:${player.nickname.toLowerCase()}`,
        `presence-account:${await accountIdOf(player)}`]) {
        if (await ctx.redis.command("GET", ctx.redisPrefix + key) !== null) return false;
      }
    }
    return true;
  }, { timeoutMs: 15_000, description: "the nicknames and accounts to be released after disconnect" });
  const aliceSnapshot = await alice.summary();
  const aliceItems = shape(await alice.inventory());
  await ctx.stopData();
  await ctx.startData({ KART_REGISTRATION: "closed" });
  const closedConfig = await httpOk(dataOrigin, "/multiplayer/auth/config", { timeoutMs });
  assert.equal(closedConfig.registration, "closed");
  assertApiError(await register(target, { username: `econ_closed_${tag}`, nickname: `Closed${tag}`,
    password: randomPassword(), forwardedFor: randomForwardedFor() }), 403, "REGISTRATION_CLOSED",
  "registration while closed");
  assert.deepEqual(await alice.summary(), aliceSnapshot, "account summary persisted across the restart");
  assert.deepEqual(shape(await alice.inventory()), aliceItems, "inventory persisted across the restart");
  const relogin = await http(dataOrigin, "/multiplayer/auth/login", { method: "POST", timeoutMs,
    body: { username: alice.username, password: alice.password }, headers: alice.headers });
  assert.equal(relogin.status, 200, `login while registration is closed: ${relogin.text}`);
  await ctx.waitNodesListed(20_000);
  const back = await enterGameWhenFree(cluster, nodeA, alice, { timeoutMs: 45_000 });
  ctx.track(back.control);
  await back.control.drain();
  back.control.close();
  console.log("✓ closed registration (403 REGISTRATION_CLOSED); wallet, inventory and sessions persisted");
  console.log("PASS: account economy — registration, onboarding, shop, inventory, rewards, ledger, admin");
});
