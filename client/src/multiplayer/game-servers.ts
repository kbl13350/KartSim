/**
 * Game server list, one-time entry tickets and the remembered choice.
 *
 * The configured backend origin is the single data service. It lists the live
 * game nodes and signs a ticket for one of them; the browser then opens that
 * node's WebSocket and proves its identity with the ticket, so the session
 * token never reaches a game node.
 */

/** localStorage key of the last game server the player picked. */
export const GAME_SERVER_STORAGE_KEY = "kartsim.multiplayer.game-server";
export const NO_GAME_SERVER_MESSAGE = "暂无可用的游戏服务器。";

/** One entry of GET /multiplayer/game-servers. A null origin means the data service origin. */
export interface GameServer {
  nodeId: string;
  name: string;
  origin: string | null;
  players: number;
  rooms: number;
  capacity: number;
  full: boolean;
}

export interface GameServerList {
  dataNode: string;
  servers: GameServer[];
}

/** Body of POST /multiplayer/game-servers/ticket. */
export interface GameServerTicket {
  ticket: string;
  nodeId: string;
  origin: string | null;
  dataNode: string;
  expiresAt: number;
}

/** What one connection attempt needs: where to connect and the ticket for hello. */
export interface GameServerEntry {
  nodeId: string;
  offerUrl: string;
  ticket: string;
}

/** A listed server with the reason it cannot be chosen, if any. */
export interface GameServerOption {
  server: GameServer;
  unavailable?: string;
}

export interface GameServerResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export interface GameServerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface GameServerDependencies {
  /** URL of a path below /multiplayer/ on the data service. */
  endpoint(path: string): string;
  /** The validated data service origin; used for servers without their own origin. */
  backendOrigin(): string;
  pageUrl(): string;
  fetch(url: string, init: Record<string, unknown>): Promise<GameServerResponse>;
  storage(): GameServerStorage;
  pick(root: unknown, options: GameServerOption[], selected: string,
    signal: AbortSignal): Promise<GameServer>;
}

const NODE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const TICKET = /^[A-Za-z0-9._-]{1,2048}$/;
const ERROR_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;
const MAX_SERVERS = 256;
const MAX_COUNT = 1_000_000;

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

/** The data node ID is informational for the browser; only reject garbage. */
function dataNode(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256 &&
    !CONTROL.test(value);
}

function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 &&
    (value as number) <= MAX_COUNT;
}

/**
 * An HTTP(S) origin in the browser's canonical form, or undefined. The game
 * node and data service keep the configured spelling (host case, an explicit
 * default port, IPv6 or Unicode hosts), so normalize instead of comparing bytes;
 * anything beyond scheme, host and port is still rejected.
 */
function httpOrigin(value: string): string | undefined {
  if (!/^https?:\/\//i.test(value) || CONTROL.test(value)) return undefined;
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username ||
        url.password || url.pathname !== "/" || url.search || url.hash) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function originField(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? httpOrigin(value) : undefined;
}

function serverFrom(value: unknown): GameServer | undefined {
  const entry = record(value);
  if (!entry || typeof entry.nodeId !== "string" || !NODE_ID.test(entry.nodeId) ||
      typeof entry.name !== "string" || CONTROL.test(entry.name) ||
      entry.name.trim() === "" || [...entry.name].length > 32 ||
      !count(entry.players) || !count(entry.rooms) || !count(entry.capacity) ||
      typeof entry.full !== "boolean") return undefined;
  const origin = originField(entry.origin);
  if (origin === undefined) return undefined;
  return { nodeId: entry.nodeId, name: entry.name, origin,
    players: entry.players, rooms: entry.rooms, capacity: entry.capacity,
    full: entry.full || entry.players >= entry.capacity };
}

/**
 * Validate the server list. Malformed entries and repeated node IDs are
 * dropped so one bad registration cannot hide the healthy servers.
 */
export function parseGameServerList(value: unknown): GameServerList {
  const body = record(value);
  if (!body || !dataNode(body.dataNode) || !Array.isArray(body.servers)) {
    throw new Error("游戏服务器列表格式无效。");
  }
  const servers: GameServer[] = [];
  const seen = new Set<string>();
  for (const entry of body.servers.slice(0, MAX_SERVERS)) {
    const server = serverFrom(entry);
    if (!server || seen.has(server.nodeId)) continue;
    seen.add(server.nodeId);
    servers.push(server);
  }
  return { dataNode: body.dataNode, servers };
}

/** Validate a ticket response and require it to be for the requested node. */
export function parseGameServerTicket(value: unknown, nodeId: string): GameServerTicket {
  const body = record(value);
  const origin = body ? originField(body.origin) : undefined;
  if (!body || typeof body.ticket !== "string" || !TICKET.test(body.ticket) ||
      typeof body.nodeId !== "string" || !NODE_ID.test(body.nodeId) ||
      origin === undefined || !dataNode(body.dataNode) ||
      !Number.isSafeInteger(body.expiresAt) ||
      (body.expiresAt as number) <= 0) {
    throw new Error("入场票据格式无效。");
  }
  if (body.nodeId !== nodeId) throw new Error("入场票据与所选游戏服务器不符。");
  return { ticket: body.ticket, nodeId: body.nodeId, origin,
    dataNode: body.dataNode, expiresAt: body.expiresAt as number };
}

const SERVER_FULL_REASON = "已满";
const HTTPS_REQUIRED_REASON = "需要 HTTPS";
/** A server this lobby already failed to enter; it is not offered again. */
const CONNECT_FAILED_REASON = "连接失败";

/** Why a server cannot be used from this page, if it cannot. */
export function gameServerUnavailableReason(server: GameServer,
  pageUrl: string): string | undefined {
  if (server.full) return SERVER_FULL_REASON;
  if (server.origin && new URL(pageUrl).protocol === "https:" &&
      !server.origin.startsWith("https:")) return HTTPS_REQUIRED_REASON;
  return undefined;
}

const UNAVAILABLE_CAUSES: Record<string, { all: string; some: string }> = {
  [SERVER_FULL_REASON]: { all: "所有游戏服务器均已满，请稍后再试。", some: "已满" },
  [HTTPS_REQUIRED_REASON]: {
    all: "在线的游戏服务器未启用 HTTPS，HTTPS 网页无法连接（请为游戏服务器配置 https:// 地址）。",
    some: "未启用 HTTPS（HTTPS 网页无法连接，请为游戏服务器配置 https:// 地址）",
  },
  [CONNECT_FAILED_REASON]: { all: "刚才无法进入所选游戏服务器，请稍后再试。", some: "刚才无法进入" },
};

/**
 * "暂无可用的游戏服务器。" plus why the listed servers cannot be used, so an
 * HTTPS page facing only HTTP servers is not mistaken for an empty cluster.
 */
function noUsableServerMessage(options: GameServerOption[]): string {
  const counts = new Map<string, number>();
  for (const { unavailable } of options) {
    if (unavailable) counts.set(unavailable, (counts.get(unavailable) ?? 0) + 1);
  }
  if (!counts.size) return NO_GAME_SERVER_MESSAGE;
  if (counts.size === 1) {
    const [reason] = counts.keys();
    return NO_GAME_SERVER_MESSAGE + (UNAVAILABLE_CAUSES[reason!]?.all ?? `${reason}。`);
  }
  return `${NO_GAME_SERVER_MESSAGE}在线的游戏服务器中，${[...counts]
    .map(([reason, total]) => `${total} 台${UNAVAILABLE_CAUSES[reason]?.some ?? reason}`)
    .join("；")}。`;
}

/**
 * The /multiplayer/offer URL the WebSocket client converts to /multiplayer/ws.
 * A null origin is reached through the data service origin (same-origin proxy).
 */
export function gameServerOfferUrl(origin: string | null, backendOrigin: string,
  pageUrl: string): string {
  const target = httpOrigin(origin ?? backendOrigin);
  if (!target) throw new Error("游戏服务器地址必须是完整的 HTTP(S) 域名，不含路径。");
  if (new URL(pageUrl).protocol === "https:" && !target.startsWith("https:")) {
    throw new Error("HTTPS 网页必须连接 HTTPS 游戏服务器。");
  }
  return `${target}/multiplayer/offer`;
}

export function loadRememberedGameServer(storage: () => GameServerStorage):
  string | undefined {
  try {
    const value = storage().getItem(GAME_SERVER_STORAGE_KEY);
    return value && NODE_ID.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function rememberGameServer(nodeId: string,
  storage: () => GameServerStorage): void {
  try { storage().setItem(GAME_SERVER_STORAGE_KEY, nodeId); }
  catch { /* Private browsing may disable storage; the choice is optional. */ }
}

/** Fetch JSON from the data service; failures become Error(code). */
async function requestJson(deps: GameServerDependencies, path: string,
  init: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
  const url = deps.endpoint(path);
  let response: GameServerResponse;
  try {
    response = await deps.fetch(url, { credentials: "same-origin", ...init, signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("无法连接数据服务，请检查后端服务。");
  }
  let body: unknown;
  try { body = await response.json(); }
  catch { body = undefined; }
  if (!response.ok) {
    const code = record(body)?.error;
    throw new Error(typeof code === "string" && ERROR_CODE.test(code)
      ? code : `HTTP_${response.status}`);
  }
  return body;
}

export async function fetchGameServerList(deps: GameServerDependencies,
  signal: AbortSignal): Promise<GameServerList> {
  let body: unknown;
  try {
    body = await requestJson(deps, "game-servers", { cache: "no-store" }, signal);
  } catch (error) {
    // The Java service and other pre-split backends have no server list.
    if (error instanceof Error && ["NOT_FOUND", "HTTP_404"].includes(error.message)) {
      throw new Error("联机后端尚未更新到多服务器版本，请同步更新后端。");
    }
    throw error;
  }
  return parseGameServerList(body);
}

/** Request a one-time ticket; the session token is sent only to the data service. */
export async function requestGameServerTicket(deps: GameServerDependencies,
  nodeId: string, sessionToken: string | undefined,
  signal: AbortSignal): Promise<GameServerTicket> {
  const body = await requestJson(deps, "game-servers/ticket", {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json",
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
    body: JSON.stringify({ nodeId }),
  }, signal);
  return parseGameServerTicket(body, nodeId);
}

/**
 * Choose the game server: none usable is an error, a single usable server is
 * entered directly, and several open the picker with the last choice selected.
 * `failed` lists node IDs this lobby could not enter; they are shown but not
 * offered again.
 */
export async function chooseGameServer(deps: GameServerDependencies, root: unknown,
  signal: AbortSignal, failed: ReadonlySet<string> = new Set()): Promise<GameServer> {
  if (signal.aborted) throw new Error("ACCOUNT_CANCELLED");
  const { servers } = await fetchGameServerList(deps, signal);
  const pageUrl = deps.pageUrl();
  const options = servers.map(server => {
    const unavailable = gameServerUnavailableReason(server, pageUrl) ??
      (failed.has(server.nodeId) ? CONNECT_FAILED_REASON : undefined);
    return unavailable ? { server, unavailable } : { server };
  });
  const usable = options.filter(option => !option.unavailable).map(option => option.server);
  if (!usable.length) throw new Error(noUsableServerMessage(options));
  if (usable.length === 1) return usable[0]!;
  const remembered = loadRememberedGameServer(deps.storage);
  const selected = usable.find(server => server.nodeId === remembered) ?? usable[0]!;
  const chosen = await deps.pick(root, options, selected.nodeId, signal);
  if (!usable.includes(chosen)) throw new Error("所选游戏服务器不可用。");
  rememberGameServer(chosen.nodeId, deps.storage);
  return chosen;
}

/** Get a fresh ticket for one connection attempt and the URL to connect to. */
export async function requestGameServerEntry(deps: GameServerDependencies,
  server: GameServer, sessionToken: string | undefined,
  signal: AbortSignal): Promise<GameServerEntry> {
  const ticket = await requestGameServerTicket(deps, server.nodeId, sessionToken, signal);
  return { nodeId: ticket.nodeId, ticket: ticket.ticket,
    offerUrl: gameServerOfferUrl(ticket.origin, deps.backendOrigin(), deps.pageUrl()) };
}
