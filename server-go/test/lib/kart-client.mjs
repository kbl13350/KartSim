// Shared helpers for the Node end-to-end scripts: data-service HTTP calls,
// accounts (register → starter kit → Bearer tickets), game-server discovery,
// one-time entry tickets and a small WebSocket control client. Requires
// Node.js 22+ (built-in fetch and WebSocket); no npm packages.
//
// Entry flow (server-go/DESIGN.md §1, ECONOMY.md §4): there are no guests by
// default (KART_ALLOW_GUESTS=false), so every scripted player is an account:
// POST /multiplayer/auth/register (open registration returns {account,
// token}) → POST /api/account/starter (practice kart + character + paint +
// dye; tickets are refused with 403 ONBOARDING_REQUIRED before this) →
// GET /multiplayer/game-servers → POST /multiplayer/game-servers/ticket
// {nodeId} with Authorization: Bearer → WebSocket <game origin>/multiplayer/ws
// → hello {ticket, equipment}. The equipment must be owned (the starter kit),
// otherwise the node answers ITEM_NOT_OWNED. Every connection attempt needs a
// fresh ticket. An account has at most one live session in the cluster: a
// second hello is refused with NICKNAME_TAKEN on the same node (its nickname
// check runs first) and ACCOUNT_ONLINE on another node (the data service's
// presence-account key).
//
// Registration is rate limited per client IP (5 per hour). Each scripted
// player therefore sends its own X-Forwarded-For address (198.18.0.0/15, a
// benchmarking range). kart-data honours it only from KART_TRUSTED_PROXIES
// (default: loopback, so a cluster started by run-full-local.sh/run-lan.sh
// and tested from the same machine works; never set it to a public range).
// Against a deployment that does not trust the test machine, pass existing
// onboarded accounts in KART_SMOKE_ACCOUNTS instead (see readSettings).
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

export const PROTOCOL_VERSION = 40;
export const RULESET = "launcher-room-v1";
export const RESOURCE_VERSION = "p3553";
export const EQUIPMENT_SLOTS = [
  1, 2, 3, 4, 8, 9, 10, 11, 12, 16, 17, 18, 20, 21, 52, 26, 27, 30,
  31, 32, 36, 43, 45, 44, 46, 58, 59, 61, 70, 68, 69, 71, 76, 77, 78,
];
/** The new-rider gift (ECONOMY.md §4): practice kart + character 2|3 + paint/dye 6|4|5|7. */
export const STARTER_KART_KEY = "practiceKart";
export const STARTER_CHARACTERS = [2, 3];
export const STARTER_COLORS = [6, 4, 5, 7];
const TICKET_PATTERN = /^kt1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const NODE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const RATE_LIMIT_HELP =
  "registration is rate limited per client IP (429 TOO_MANY_ATTEMPTS, 5 per hour). " +
  "The scripts send a distinct X-Forwarded-For per player: run kart-data with " +
  "KART_TRUSTED_PROXIES covering the address this script connects from (the default is " +
  "loopback, e.g. KART_TRUSTED_PROXIES=127.0.0.1/32), or pass existing onboarded accounts " +
  "with KART_SMOKE_ACCOUNTS=user1:password1,user2:password2,…";

const trimOrigin = value => value.trim().replace(/\/+$/, "");

/** Parses KART_SMOKE_ACCOUNTS ("user:password,user:password"; the password may contain ':'). */
export function parseAccountList(value = "") {
  return value.split(",").map(entry => entry.trim()).filter(Boolean).map(entry => {
    const separator = entry.indexOf(":");
    assert.ok(separator > 0 && separator < entry.length - 1,
      `KART_SMOKE_ACCOUNTS entries must be username:password, got ${JSON.stringify(entry.slice(0, 24))}`);
    return { username: entry.slice(0, separator), password: entry.slice(separator + 1) };
  });
}

/**
 * Settings shared by the scripts that test an already running cluster:
 *   KART_DATA_ORIGIN (legacy KART_SERVER_BASE / KART_SERVER_ORIGIN) data service, default http://127.0.0.1:8787
 *   KART_GAME_ORIGINS  comma-separated game-node origins to test instead of the origins in the list
 *   KART_GAME_NODE     nodeId used for the single-node flows (default: first server that is not full)
 *   KART_SMOKE_TIMEOUT_MS         per request/event timeout (default 8000)
 *   KART_SMOKE_SETTLE_TIMEOUT_MS  how long to wait for settlements to reach the data service (default 30000)
 *   KART_SMOKE_ACCOUNTS           existing accounts to use before registering new ones
 *                                 ("user:password,…"; their starter kit is claimed if needed)
 *   KART_SMOKE_FORWARDED_FOR=0    do not send per-player X-Forwarded-For headers
 */
export function readSettings(env = process.env) {
  const dataOrigin = trimOrigin(env.KART_DATA_ORIGIN ?? env.KART_SERVER_BASE ??
    env.KART_SERVER_ORIGIN ?? "http://127.0.0.1:8787");
  const timeoutMs = Number(env.KART_SMOKE_TIMEOUT_MS ?? 8000);
  const settleMs = Number(env.KART_SMOKE_SETTLE_TIMEOUT_MS ?? 30_000);
  assert.ok(Number.isFinite(timeoutMs) && timeoutMs >= 1000, "Invalid KART_SMOKE_TIMEOUT_MS");
  assert.ok(Number.isFinite(settleMs) && settleMs >= 1000, "Invalid KART_SMOKE_SETTLE_TIMEOUT_MS");
  const gameOrigins = (env.KART_GAME_ORIGINS ?? "").split(",")
    .map(trimOrigin).filter(Boolean);
  return { dataOrigin, timeoutMs, settleMs, gameOrigins,
    preferredNode: env.KART_GAME_NODE?.trim() || undefined,
    accounts: parseAccountList(env.KART_SMOKE_ACCOUNTS),
    forwardedFor: env.KART_SMOKE_FORWARDED_FOR !== "0" };
}

const blankItemIds = () => Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, 0]));

/**
 * The equipment of an account that only owns its starter kit: the practice
 * kart (itemIds[3] = 0 with systemKart "practiceKart") and the chosen
 * character, paint (category 2) and dye (category 70).
 */
export function starterEquipment({ character = 2, paint = 6, dye = 6 } = {}) {
  const itemIds = blankItemIds();
  Object.assign(itemIds, { 1: character, 2: paint, 3: 0, 70: dye });
  return { itemIds, kartSerial: 0, valueAt3E: 0, exceedType: 0, systemKart: STARTER_KART_KEY };
}

/**
 * The equipment a fresh guest browser profile used to send (character 2,
 * paint 1, kart 387, dye 1): well formed, but kart 387 and paint/dye 1 are
 * not part of the starter kit, so an account that did not buy them gets
 * ITEM_NOT_OWNED.
 */
export function unownedEquipment() {
  const itemIds = blankItemIds();
  Object.assign(itemIds, { 1: 2, 2: 1, 3: 387, 70: 1 });
  return { itemIds, kartSerial: 0, valueAt3E: 0, exceedType: 0 };
}

/**
 * Copy of `equipment` with some slots replaced ({slot: itemId}). Equipping a
 * real kart (slot 3 non-zero) drops systemKart; setting slot 3 to 0 needs
 * `systemKart`.
 */
export function equipmentWith(equipment, items, { systemKart } = {}) {
  const next = structuredClone(equipment);
  Object.assign(next.itemIds, items);
  if (next.itemIds[3] !== 0) {
    delete next.systemKart;
    delete next.systemKartVariant;
  } else if (systemKart !== undefined) {
    next.systemKart = systemKart;
  }
  return next;
}

/** HTTP JSON call; never throws on non-2xx so callers can assert error codes. */
export async function http(origin, path, { method = "GET", body, token, headers = {},
  timeoutMs = 8000 } = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let json;
  try { json = text ? JSON.parse(text) : undefined; } catch { json = undefined; }
  return { status: response.status, body: json, text, headers: response.headers };
}

/** HTTP call that must succeed with a JSON body. */
export async function httpOk(origin, path, options = {}) {
  const result = await http(origin, path, options);
  assert.ok(result.status >= 200 && result.status < 300,
    `${options.method ?? "GET"} ${path} returned HTTP ${result.status}: ${result.text}`);
  assert.ok(result.body !== undefined, `${path} did not return JSON: ${result.text}`);
  return result.body;
}

/** Asserts an {"error": code} response with an exact status. */
export function assertApiError(result, status, code, label = "request") {
  assert.equal(result.status, status,
    `${label}: expected HTTP ${status} ${code}, got ${result.status} ${result.text}`);
  assert.equal(result.body?.error, code, `${label}: expected ${code}, got ${result.text}`);
}

/**
 * Asserts an {"error": code} response whose HTTP status is one of
 * `statuses` (for codes whose status the design does not pin down).
 */
export function assertApiErrorIn(result, statuses, code, label = "request") {
  assert.ok(statuses.includes(result.status),
    `${label}: expected HTTP ${statuses.join("/")} ${code}, got ${result.status} ${result.text}`);
  assert.equal(result.body?.error, code, `${label}: expected ${code}, got ${result.text}`);
}

/** Asserts a 4xx {"error": "<any code>"} response and returns the code. */
export function assertClientError(result, label = "request") {
  assert.ok(result.status >= 400 && result.status < 500,
    `${label}: expected a 4xx error, got ${result.status} ${result.text}`);
  assert.ok(typeof result.body?.error === "string" && result.body.error.length > 0,
    `${label}: 4xx without an {"error": code} body: ${result.text}`);
  return result.body.error;
}

/** Retries check() until it returns a value other than undefined/false. */
export async function poll(check, { timeoutMs, intervalMs = 250, description }) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  for (;;) {
    try {
      const value = await check();
      if (value !== undefined && value !== false) return value;
    } catch (error) {
      lastError = error;
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timed out after ${timeoutMs} ms waiting for ${description}` +
        (lastError ? `: ${lastError.message}` : ""));
    }
    await delay(intervalMs);
  }
}

export const websocketUrl = origin =>
  `${origin.replace(/^http:/, "ws:").replace(/^https:/, "wss:")}/multiplayer/ws`;

function assertGameServerList(list) {
  assert.ok(list && typeof list === "object" && !Array.isArray(list), "game-servers is not an object");
  assert.ok(typeof list.dataNode === "string" && list.dataNode.length > 0, "game-servers lacks dataNode");
  assert.ok(Array.isArray(list.servers), "game-servers lacks a servers array");
  for (const server of list.servers) {
    assert.match(server.nodeId, NODE_ID_PATTERN, `Invalid nodeId ${JSON.stringify(server.nodeId)}`);
    assert.ok(typeof server.name === "string" && server.name.length > 0, `${server.nodeId}: invalid name`);
    assert.ok(server.origin === null || /^https?:\/\/[^/]+$/.test(server.origin),
      `${server.nodeId}: origin must be null or an HTTP(S) origin, got ${JSON.stringify(server.origin)}`);
    for (const field of ["players", "rooms", "capacity"]) {
      assert.ok(Number.isSafeInteger(server[field]) && server[field] >= 0,
        `${server.nodeId}: invalid ${field}`);
    }
    assert.equal(server.full, server.players >= server.capacity, `${server.nodeId}: inconsistent full flag`);
  }
  for (let index = 1; index < list.servers.length; index++) {
    assert.ok(list.servers[index - 1].name <= list.servers[index].name,
      "game-servers must be sorted by name");
  }
}

/**
 * Reads the data-service health and the live game-server list. Each returned
 * server carries `connectOrigin` (where the test connects: the listed origin,
 * the data origin for same-origin nodes, or the KART_GAME_ORIGINS override)
 * and `wsUrl`. The result also carries the account settings used by
 * createPlayer (accountPool, forwardedFor).
 */
export async function discoverCluster(settings) {
  const { dataOrigin, timeoutMs } = settings;
  const health = await httpOk(dataOrigin, "/multiplayer/healthz", { timeoutMs });
  assert.equal(health.protocolVersion, PROTOCOL_VERSION);
  assert.equal(health.service, "data", "KART_DATA_ORIGIN does not point at kart-data");
  const list = await httpOk(dataOrigin, "/multiplayer/game-servers", { timeoutMs });
  assertGameServerList(list);
  if (health.dataNode !== undefined) assert.equal(health.dataNode, list.dataNode);

  let servers;
  if (settings.gameOrigins?.length > 0) {
    servers = [];
    for (const origin of settings.gameOrigins) {
      const gameHealth = await httpOk(origin, "/multiplayer/healthz", { timeoutMs });
      assert.equal(gameHealth.service, "game", `${origin} is not a kart-game node`);
      const listed = list.servers.find(server => server.nodeId === gameHealth.nodeId);
      assert.ok(listed, `${origin} (${gameHealth.nodeId}) is missing from /multiplayer/game-servers`);
      servers.push({ ...listed, connectOrigin: origin });
    }
  } else {
    servers = list.servers.map(server => ({ ...server, connectOrigin: server.origin ?? dataOrigin }));
    for (const server of servers.filter(candidate => candidate.origin !== null)) {
      const gameHealth = await httpOk(server.connectOrigin, "/multiplayer/healthz", { timeoutMs });
      assert.equal(gameHealth.protocolVersion, PROTOCOL_VERSION);
      assert.equal(gameHealth.service, "game", `${server.connectOrigin} is not a kart-game node`);
      assert.equal(gameHealth.nodeId, server.nodeId, `${server.connectOrigin} reports another nodeId`);
    }
  }
  for (const server of servers) server.wsUrl = websocketUrl(server.connectOrigin);
  const open = servers.filter(server => !server.full);
  if (settings.preferredNode) {
    const index = open.findIndex(server => server.nodeId === settings.preferredNode);
    assert.ok(index >= 0, `KART_GAME_NODE=${settings.preferredNode} is not an available game server`);
    open.unshift(...open.splice(index, 1));
  }
  assert.ok(open.length > 0, "No available game server is registered with the data service");
  return { dataOrigin, dataNode: list.dataNode, servers: open, timeoutMs,
    accountPool: [...(settings.accounts ?? [])], forwardedFor: settings.forwardedFor ?? true };
}

/** A random client address in 198.18.0.0/15 (RFC 2544 benchmarking), one per scripted player. */
export function randomForwardedFor() {
  const [high, third, fourth] = randomBytes(3);
  return `198.${18 + (high & 1)}.${third}.${(fourth % 254) + 1}`;
}

/** A random password accepted by registration (8–128 characters). */
export const randomPassword = () => `pw-${randomBytes(15).toString("base64url")}`;

/**
 * A logged-in account. `call`/`callOk` reach the data service with its
 * Bearer token and X-Forwarded-For address; `token` and `headers` also make
 * it usable as the options of issueTicket().
 */
export class Player {
  constructor(fields) {
    Object.assign(this, fields);
  }

  get headers() {
    return this.forwardedFor ? { "X-Forwarded-For": this.forwardedFor } : {};
  }

  /** HTTP call with this player's session (pass token: null to omit it). */
  call(path, { method = "GET", body, headers = {}, token = this.token } = {}) {
    return http(this.dataOrigin, path, { method, body, token,
      headers: { ...this.headers, ...headers }, timeoutMs: this.timeoutMs });
  }

  async callOk(path, options = {}) {
    const result = await this.call(path, options);
    assert.ok(result.status >= 200 && result.status < 300,
      `${this.username}: ${options.method ?? "GET"} ${path} returned HTTP ${result.status}: ${result.text}`);
    assert.ok(result.body !== undefined, `${this.username}: ${path} did not return JSON: ${result.text}`);
    return result.body;
  }

  /** GET /api/account. */
  summary() {
    return this.callOk("/api/account");
  }

  /** GET /api/inventory → items. */
  async inventory() {
    const body = await this.callOk("/api/inventory");
    assert.ok(Array.isArray(body.items), `${this.username}: /api/inventory lacks items: ${JSON.stringify(body)}`);
    return body.items;
  }
}

/**
 * POST /multiplayer/auth/register. Returns the raw result; a 429 throws with
 * the KART_TRUSTED_PROXIES hint.
 */
export async function register(target, { username, nickname, password, invite, forwardedFor }) {
  const result = await http(target.dataOrigin, "/multiplayer/auth/register", {
    method: "POST", timeoutMs: target.timeoutMs,
    body: { username, nickname, password, ...(invite === undefined ? {} : { invite }) },
    headers: forwardedFor ? { "X-Forwarded-For": forwardedFor } : {},
  });
  if (result.status === 429) {
    throw new Error(`register ${username}: HTTP 429 ${result.body?.error ?? result.text}: ${RATE_LIMIT_HELP}`);
  }
  return result;
}

/** POST /multiplayer/auth/login → token. */
export async function login(target, { username, password, forwardedFor }) {
  const result = await http(target.dataOrigin, "/multiplayer/auth/login", {
    method: "POST", timeoutMs: target.timeoutMs, body: { username, password },
    headers: forwardedFor ? { "X-Forwarded-For": forwardedFor } : {},
  });
  assert.equal(result.status, 200, `login ${username}: HTTP ${result.status} ${result.text}`);
  assert.match(result.body?.token ?? "", /^[A-Za-z0-9_-]{43}$/, `login ${username}: no session token`);
  return result.body;
}

/**
 * Builds the starter-kit equipment from an inventory: the practice kart plus
 * an owned starter character, paint and dye (preferring `preferred`).
 */
export function equipmentFromInventory(items, preferred = {}) {
  const now = Date.now();
  const owned = (category, itemId, systemKey) => items.some(item => item.category === category &&
    item.itemId === itemId && (item.systemKey ?? "") === (systemKey ?? "") &&
    (item.expiresAt === null || item.expiresAt === undefined || item.expiresAt > now));
  assert.ok(owned(3, 0, STARTER_KART_KEY),
    `the inventory lacks the practice kart (3/0/${STARTER_KART_KEY}): ${JSON.stringify(items)}`);
  const pick = (category, wanted, whitelist) => {
    const choices = [wanted, ...whitelist].filter(itemId => itemId !== undefined);
    const found = choices.find(itemId => owned(category, itemId));
    assert.ok(found !== undefined, `the inventory has no starter item of category ${category}: ` +
      JSON.stringify(items));
    return found;
  };
  return starterEquipment({
    character: pick(1, preferred.character, STARTER_CHARACTERS),
    paint: pick(2, preferred.paint, STARTER_COLORS),
    dye: pick(70, preferred.dye, STARTER_COLORS),
  });
}

/**
 * POST /api/account/starter {character, paint, dye}. `already` allows the
 * answer of an account that claimed its kit before (any 409).
 */
export async function claimStarter(player, choice, { already = false } = {}) {
  const result = await player.call("/api/account/starter", { method: "POST", body: choice });
  if (already && result.status === 409) return result;
  assert.ok(result.status >= 200 && result.status < 300,
    `${player.username}: starter claim ${JSON.stringify(choice)} returned HTTP ${result.status} ${result.text}`);
  return result;
}

const usernameFor = nickname => `u_${nickname.replace(/[^A-Za-z0-9_]/g, "_")}`.slice(0, 24);

/**
 * An onboarded account ready to enter a game node: registers `nickname`
 * (≤ 16 characters; username u_<nickname>) with open registration, or uses
 * the next KART_SMOKE_ACCOUNTS entry; then claims the starter kit and builds
 * `player.equipment` from the inventory. Use player.nickname as the name in
 * assertions (a pooled account keeps its own nickname).
 */
export async function createPlayer(target, nickname, { starter = {}, invite, claim = true } = {}) {
  const forwardedFor = target.forwardedFor === false ? undefined : randomForwardedFor();
  const base = { dataOrigin: target.dataOrigin, timeoutMs: target.timeoutMs, forwardedFor };
  const choice = { character: starter.character ?? 2, paint: starter.paint ?? 6, dye: starter.dye ?? 6 };
  let player;
  const pooled = target.accountPool?.shift();
  if (pooled) {
    const session = await login(target, { ...pooled, forwardedFor });
    player = new Player({ ...base, ...pooled, nickname: session.account.nickname, token: session.token,
      account: session.account, pooled: true });
  } else {
    const username = usernameFor(nickname);
    const password = randomPassword();
    const result = await register(target, { username, nickname, password, invite, forwardedFor });
    if (["REGISTRATION_CLOSED", "INVALID_INVITE"].includes(result.body?.error) && invite === undefined) {
      throw new Error(`register ${username}: ${result.body.error}: registration is not open on this ` +
        "deployment; pass existing onboarded accounts with KART_SMOKE_ACCOUNTS=user:password,…");
    }
    assert.equal(result.status, 200, `register ${username}: HTTP ${result.status} ${result.text}`);
    assert.equal(result.body?.account?.nickname, nickname, `register ${username}: unexpected account`);
    const token = result.body.token ?? (await login(target, { username, password, forwardedFor })).token;
    assert.match(token, /^[A-Za-z0-9_-]{43}$/, `register ${username}: invalid session token`);
    player = new Player({ ...base, username, nickname, password, token, account: result.body.account });
  }
  if (claim) {
    await claimStarter(player, choice, { already: player.pooled === true });
    player.equipment = equipmentFromInventory(await player.inventory(), choice);
  }
  return player;
}

/** Decodes the (unverified) claims of a kt1 ticket. */
export function ticketClaims(ticket) {
  const [, body] = ticket.split(".");
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
}

/**
 * Requests a fresh one-time entry ticket for one node and checks its shape.
 * `options` is {token, headers} — a Player works as is.
 */
export async function issueTicket(cluster, server, { token, headers = {} } = {}) {
  const result = await http(cluster.dataOrigin, "/multiplayer/game-servers/ticket", {
    method: "POST", body: { nodeId: server.nodeId }, token, headers, timeoutMs: cluster.timeoutMs,
  });
  assert.equal(result.status, 200, `ticket for ${server.nodeId}: HTTP ${result.status} ${result.text}`);
  const response = result.body;
  assert.match(response.ticket, TICKET_PATTERN, "Malformed entry ticket");
  assert.equal(response.nodeId, server.nodeId);
  assert.equal(response.dataNode, cluster.dataNode);
  assert.equal(response.origin, server.origin, "Ticket origin differs from the game-server list");
  assert.ok(Number.isSafeInteger(response.expiresAt) && response.expiresAt > Date.now() - 60_000,
    "Ticket expiresAt is not a future Unix-millisecond time");
  const claims = ticketClaims(response.ticket);
  assert.equal(claims.v, 1);
  assert.equal(claims.node, server.nodeId);
  assert.equal(claims.data, cluster.dataNode);
  assert.equal(claims.exp, response.expiresAt);
  assert.equal(claims.guest, !token, token ? "Bearer ticket must be an account ticket" :
    "Ticket without Bearer must be a guest ticket");
  return response;
}

/** hello as the browser sends it; `ticket` is omitted when undefined. */
export function helloFields(name, ticket, equipment = starterEquipment()) {
  return {
    type: "hello", protocolVersion: PROTOCOL_VERSION, ruleset: RULESET,
    resourceVersion: RESOURCE_VERSION, name, equipment, initial: "", raceRuntime: true,
    ...(ticket === undefined ? {} : { ticket }),
  };
}

/**
 * JSON control channel over one WebSocket. Replies are matched by requestId;
 * everything else is buffered for waitFor(). `validate` (optional) is the
 * real frontend event validator; a rejected event fails every waiter and is
 * remembered, so drain() reports it even when nobody was waiting (e.g. a
 * broadcast that reaches a passive peer after its last request). Scripts call
 * drain() on every socket before printing PASS.
 */
export class ControlSocket {
  constructor(socket, { validate, timeoutMs = 8000, label = "socket" } = {}) {
    this.socket = socket;
    this.validate = validate;
    this.timeoutMs = timeoutMs;
    this.label = label;
    this.nextId = 0;
    this.events = [];
    this.waiters = new Set();
    this.failure = undefined;
    this.protocolFailure = undefined;
    this.closing = false;
    socket.addEventListener("message", event => {
      if (typeof event.data !== "string") return; // binary motion frames
      let message;
      try { message = JSON.parse(event.data); }
      catch { return this.protocolError(new Error(`${label}: server sent invalid JSON`)); }
      if (this.validate && !this.validate(message)) {
        return this.protocolError(
          new Error(`${label}: frontend rejected server event ${JSON.stringify(message)}`));
      }
      const waiter = [...this.waiters].find(entry => entry.predicate(message));
      if (waiter) waiter.resolve(message);
      else this.events.push(message);
    });
    socket.addEventListener("close", event => this.fail(new Error(this.closing
      ? `${label}: closed by the test` : `${label}: WebSocket closed (${event.code})`)));
    socket.addEventListener("error", () => this.fail(new Error(`${label}: WebSocket error`)));
  }

  static async connect(url, options = {}) {
    const timeoutMs = options.timeoutMs ?? 8000;
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error(`WebSocket open timed out: ${url}`));
      }, timeoutMs);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error(`WebSocket open failed: ${url}`));
      }, { once: true });
    });
    return new ControlSocket(socket, options);
  }

  fail(error) {
    this.failure ??= error;
    for (const waiter of [...this.waiters]) waiter.reject(error);
  }

  /** An invalid server event: fails the waiters and is reported by drain(). */
  protocolError(error) {
    this.protocolFailure ??= error;
    this.fail(error);
  }

  /**
   * Round-trips a clock request, which the server answers only after every
   * frame it queued earlier on this connection, then throws if any of those
   * events was invalid JSON or rejected by the frontend validator. Call it on
   * the success path before closing; close() itself never throws, so cleanup
   * in finally blocks cannot mask the real error.
   */
  async drain() {
    if (this.protocolFailure) throw this.protocolFailure;
    try {
      await this.request({ type: "clock", clientTick: 0 });
    } catch (error) {
      throw this.protocolFailure ?? error;
    }
    if (this.protocolFailure) throw this.protocolFailure;
  }

  waitFor(predicate, description = "control message") {
    const found = this.events.findIndex(predicate);
    if (found >= 0) return Promise.resolve(this.events.splice(found, 1)[0]);
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve: message => { clearTimeout(timer); this.waiters.delete(waiter); resolve(message); },
        reject: error => { clearTimeout(timer); this.waiters.delete(waiter); reject(error); },
      };
      const timer = setTimeout(() => waiter.reject(
        new Error(`${this.label}: timed out waiting for ${description}`)), this.timeoutMs);
      this.waiters.add(waiter);
    });
  }

  /** Sends a request and returns the reply, which may be an error. */
  async send(fields) {
    const requestId = String(++this.nextId);
    const reply = this.waitFor(message => message?.requestId === requestId, `${fields.type} reply`);
    this.socket.send(JSON.stringify({ ...fields, requestId }));
    return reply;
  }

  /** Sends a request that must succeed. */
  async request(fields) {
    const message = await this.send(fields);
    assert.notEqual(message.type, "error", `${this.label}: ${fields.type} failed: ${message.code}`);
    return message;
  }

  /** Sends a request that must fail with `code`. */
  async expectError(fields, code) {
    const message = await this.send(fields);
    assert.equal(message.type, "error",
      `${this.label}: ${fields.type} should fail with ${code}, got ${JSON.stringify(message)}`);
    assert.equal(message.code, code, `${this.label}: ${fields.type} failed with ${message.code}, expected ${code}`);
    return message;
  }

  close() {
    this.closing = true;
    this.socket.close();
  }
}

/** A hello that the game node answered with {"type":"error"}; `code` is its code. */
export class EntryError extends Error {
  constructor(label, code) {
    super(`${label}: hello failed: ${code}`);
    this.code = code;
  }
}

/**
 * Requests a ticket with the player's session, connects to the node and
 * completes hello with the player's (owned) equipment. Throws EntryError when
 * the node refuses the hello.
 */
export async function enterGame(cluster, server, player, { validate, equipment = player.equipment,
  name = player.nickname } = {}) {
  assert.ok(player?.token, "enterGame needs an onboarded account (createPlayer)");
  const ticket = await issueTicket(cluster, server, player);
  const label = `${player.nickname}@${server.nodeId}`;
  const control = await ControlSocket.connect(server.wsUrl, { validate, timeoutMs: cluster.timeoutMs, label });
  try {
    const welcome = await control.send(helloFields(name, ticket.ticket, equipment));
    if (welcome.type === "error") throw new EntryError(label, welcome.code);
    assert.equal(welcome.type, "welcome");
    assert.equal(welcome.protocolVersion, PROTOCOL_VERSION);
    assert.equal(welcome.ruleset, RULESET);
    assert.ok(typeof welcome.playerId === "string" && welcome.playerId.length > 0);
    assert.ok(Array.isArray(welcome.capabilities));
    return { control, welcome, ticket, server, player };
  } catch (error) {
    control.close();
    throw error;
  }
}

/** hello refusals of an account whose previous session is still being released. */
const STILL_ONLINE = new Set(["NICKNAME_TAKEN", "ACCOUNT_ONLINE"]);

/**
 * enterGame, retried while the node answers NICKNAME_TAKEN or ACCOUNT_ONLINE:
 * the nickname and account of a connection that was just closed are released
 * asynchronously.
 */
export async function enterGameWhenFree(cluster, server, player, { timeoutMs = 15_000, ...options } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await enterGame(cluster, server, player, options);
    } catch (error) {
      if (!(error instanceof EntryError) || !STILL_ONLINE.has(error.code) || Date.now() >= deadline) {
        throw error;
      }
      await delay(250);
    }
  }
}

/** Opens a connection whose hello must fail with `code`, then closes it. */
export async function expectRejectedHello(cluster, server, fields, code, { validate } = {}) {
  const control = await ControlSocket.connect(server.wsUrl,
    { validate, timeoutMs: cluster.timeoutMs, label: `${fields.name}@${server.nodeId}` });
  try {
    await control.expectError(fields, code);
  } finally {
    control.close();
  }
}

/** Like expectRejectedHello, with a fresh valid ticket of `player` for that node. */
export async function expectRejectedEntry(cluster, server, player, code, { validate,
  equipment = player.equipment } = {}) {
  const ticket = await issueTicket(cluster, server, player);
  await expectRejectedHello(cluster, server, helloFields(player.nickname, ticket.ticket, equipment), code,
    { validate });
}

/**
 * POST /multiplayer/auth/guest-name and return `available`; undefined when
 * the deployment no longer serves the endpoint (guests disabled).
 */
export async function guestNameAvailable(cluster, name) {
  const result = await http(cluster.dataOrigin, "/multiplayer/auth/guest-name", {
    method: "POST", body: { name }, timeoutMs: cluster.timeoutMs,
  });
  if (result.status === 404 || result.status === 410) return undefined;
  assert.equal(result.status, 200, `auth/guest-name: HTTP ${result.status} ${result.text}`);
  assert.equal(typeof result.body?.available, "boolean");
  return result.body.available;
}

/**
 * Checks race.rewards ({playerId: {exp, lucci}}, ECONOMY.md 2.1) of a
 * finished snapshot: one entry per expected player with non-negative
 * integers. With `expected` ({playerId: {exp, lucci}}) the values must match.
 */
export function assertRaceRewards(race, playerIds, { expected, label = "race" } = {}) {
  const rewards = race?.rewards;
  assert.ok(rewards && typeof rewards === "object" && !Array.isArray(rewards),
    `${label}: the finished snapshot lacks race.rewards: ${JSON.stringify(race)}`);
  for (const playerId of playerIds) {
    const reward = rewards[playerId];
    assert.ok(reward, `${label}: race.rewards has no entry for ${playerId}: ${JSON.stringify(rewards)}`);
    for (const field of ["exp", "lucci"]) {
      assert.ok(Number.isSafeInteger(reward[field]) && reward[field] >= 0,
        `${label}: race.rewards[${playerId}].${field} is not a non-negative integer`);
    }
  }
  if (expected) {
    for (const [playerId, reward] of Object.entries(expected)) {
      assert.deepEqual({ exp: rewards[playerId]?.exp, lucci: rewards[playerId]?.lucci }, reward,
        `${label}: race.rewards[${playerId}]`);
    }
  }
  return rewards;
}

/** Server-observed race time before a finish counts for the rewards (ECONOMY.md 2.1). */
export const MIN_REWARDED_RACE_MS = 10_000;

/**
 * Waits until a race (its snapshot `race`, with startAt on the node's
 * monotonic clock) has run MIN_REWARDED_RACE_MS of server time, read with a
 * clock request on `control`, so a finish sent afterwards earns the finished
 * reward. A finish sent earlier only earns the unfinished one.
 */
export async function waitUntilRaceCounts(control, race, { marginMs = 300 } = {}) {
  assert.ok(Number.isFinite(race?.startAt), `race without startAt: ${JSON.stringify(race)}`);
  const { serverTick } = await control.request({ type: "clock", clientTick: 0 });
  const remaining = race.startAt + MIN_REWARDED_RACE_MS - serverTick;
  if (remaining > 0) await delay(remaining + marginMs);
}

/**
 * Waits until a finished race reached the data service through the game
 * node's outbox: the outcome in /api/race-outcomes and, for each expected
 * racer, a ranked row in /api/race-results.
 */
export async function expectSettlement(cluster, { raceId, roomId, gameplay, racers = [], timeoutMs }) {
  const outcome = await poll(async () => {
    const outcomes = await httpOk(cluster.dataOrigin,
      `/api/race-outcomes?gameplay=${encodeURIComponent(gameplay)}`, { timeoutMs: cluster.timeoutMs });
    assert.ok(Array.isArray(outcomes), "race-outcomes is not an array");
    return outcomes.find(entry => entry.raceId === raceId);
  }, { timeoutMs, intervalMs: 500, description: `race ${raceId} in /api/race-outcomes` });
  assert.equal(outcome.roomId, roomId);
  assert.equal(outcome.gameplay, gameplay);
  assert.ok(typeof outcome.trackId === "string" && outcome.trackId.length > 0);
  assert.ok(Number.isSafeInteger(outcome.createdAt));
  assert.equal(outcome.snapshot?.roomId, roomId);
  assert.equal(outcome.snapshot?.gameplay, gameplay);
  assert.equal(outcome.snapshot?.race?.raceId, raceId);

  const rows = [];
  for (const racer of racers) {
    const row = await poll(async () => {
      const results = await httpOk(cluster.dataOrigin,
        `/api/race-results?name=${encodeURIComponent(racer.name)}`, { timeoutMs: cluster.timeoutMs });
      assert.ok(Array.isArray(results), "race-results is not an array");
      return results.find(entry => entry.raceId === raceId);
    }, { timeoutMs, intervalMs: 500, description: `${racer.name} in /api/race-results` });
    assert.equal(row.roomId, roomId);
    assert.equal(row.name, racer.name);
    if (racer.playerId !== undefined) assert.equal(row.playerId, racer.playerId);
    if (racer.rank !== undefined) assert.equal(row.rank, racer.rank);
    if (racer.elapsedMs !== undefined) assert.equal(row.elapsedMs, racer.elapsedMs);
    if (racer.points !== undefined) assert.equal(row.points, racer.points);
    rows.push(row);
  }
  return { outcome, rows };
}

/** Waits until /api/room-rules lists the room. */
export async function expectRoomRules(cluster, roomId, timeoutMs) {
  return poll(async () => {
    const rules = await httpOk(cluster.dataOrigin, "/api/room-rules", { timeoutMs: cluster.timeoutMs });
    assert.ok(Array.isArray(rules), "room-rules is not an array");
    return rules.find(entry => entry.roomId === roomId);
  }, { timeoutMs, intervalMs: 500, description: `room ${roomId} in /api/room-rules` });
}

/**
 * Entry-ticket, nickname and one-session-per-account rules that every
 * deployment must enforce, using the onboarded account `holder` (which must
 * not be online). Uses the first
 * two available nodes; cross-node checks are skipped (and logged) when only
 * one node is registered. Guest tickets must be refused unless auth/config
 * reports guests: true.
 */
export async function checkAdmission(cluster, { holder, suffix, validate, settleMs, log = console.log }) {
  assert.ok(holder?.token && holder.equipment, "checkAdmission needs an onboarded account (createPlayer)");
  const [nodeA, nodeB] = cluster.servers;
  const ticketPath = "/multiplayer/game-servers/ticket";
  assertApiError(await holder.call(ticketPath, { method: "POST", body: { nodeId: `missing-${suffix}` } }),
    404, "GAME_SERVER_NOT_FOUND", "ticket for an unknown node");
  assertApiError(await http(cluster.dataOrigin, ticketPath, {
    method: "POST", body: { nodeId: nodeA.nodeId }, token: "A".repeat(43), timeoutMs: cluster.timeoutMs,
  }), 401, "LOGIN_REQUIRED", "ticket with an invalid session");
  const config = await httpOk(cluster.dataOrigin, "/multiplayer/auth/config", { timeoutMs: cluster.timeoutMs });
  if (config.guests === true) {
    log("- auth/config reports guests: true (KART_ALLOW_GUESTS=true); guest-ticket refusal not checked");
  } else {
    assertApiError(await http(cluster.dataOrigin, ticketPath, {
      method: "POST", body: { nodeId: nodeA.nodeId }, timeoutMs: cluster.timeoutMs,
    }), 401, "LOGIN_REQUIRED", "ticket without a session (guest)");
  }
  log("✓ ticket API rejects unknown nodes, invalid sessions and guests");

  const name = holder.nickname;
  await expectRejectedHello(cluster, nodeA, helloFields(name, undefined, holder.equipment), "TICKET_REQUIRED",
    { validate });
  await expectRejectedHello(cluster, nodeA, helloFields(name, "kt1.e30.forged", holder.equipment),
    "TICKET_INVALID", { validate });
  // Flip the first signature character: it carries six full bits of the MAC.
  const genuine = await issueTicket(cluster, nodeA, holder);
  const signatureAt = genuine.ticket.lastIndexOf(".") + 1;
  const tampered = genuine.ticket.slice(0, signatureAt) +
    (genuine.ticket[signatureAt] === "A" ? "B" : "A") + genuine.ticket.slice(signatureAt + 1);
  await expectRejectedHello(cluster, nodeA, helloFields(name, tampered, holder.equipment),
    "TICKET_INVALID", { validate });
  log(`✓ ${nodeA.nodeId}: hello requires a valid ticket`);

  const held = await enterGameWhenFree(cluster, nodeA, holder, { validate, timeoutMs: Math.min(settleMs, 15_000) });
  try {
    await expectRejectedHello(cluster, nodeA, helloFields(name, held.ticket.ticket, holder.equipment),
      "TICKET_REUSED", { validate });
    log("✓ an entry ticket cannot be reused");
    // Same node: the node's own nickname check comes before its account check.
    await expectRejectedEntry(cluster, nodeA, holder, "NICKNAME_TAKEN", { validate });
    log("✓ an account that is online cannot enter a second time (same node: NICKNAME_TAKEN)");
    if (nodeB) {
      const forA = await issueTicket(cluster, nodeA, holder);
      await expectRejectedHello(cluster, nodeB, helloFields(name, forA.ticket, holder.equipment),
        "TICKET_WRONG_NODE", { validate });
      // Another node: the data service's presence claim finds the account online first.
      await expectRejectedEntry(cluster, nodeB, holder, "ACCOUNT_ONLINE", { validate });
      log(`✓ ${nodeB.nodeId} rejects a ticket for ${nodeA.nodeId} and an account online on ` +
        `${nodeA.nodeId} (ACCOUNT_ONLINE)`);
    } else {
      log("- only one game server available: cross-node ticket/nickname checks skipped " +
        "(start two nodes or set KART_GAME_ORIGINS)");
    }
    await held.control.drain();
  } finally {
    held.control.close();
  }
  const again = await enterGameWhenFree(cluster, nodeB ?? nodeA, holder,
    { validate, timeoutMs: Math.min(settleMs, 15_000) });
  try {
    await again.control.drain();
  } finally {
    again.control.close();
  }
  log(`✓ nickname released after disconnect and usable again${nodeB ? " on another node" : ""}`);
}
