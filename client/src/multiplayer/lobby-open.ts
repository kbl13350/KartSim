import { formatMultiplayerError } from "./errors";
import type { GameServer, GameServerEntry } from "./game-servers";
import type { Gameplay, RoomSummary } from "./lobby-actions";

export interface LobbyOpenView {
  show(): void;
  dispose(): void;
}

export interface LobbyOpenClient {
  connect(url: string, nickname: string, version: string, equipment: unknown,
    initial: string, raceRuntime: boolean, ticket: string | undefined):
    Promise<{ type: string; playerId?: string }>;
  dispose(): void;
}

export interface LobbyOpenHost {
  options: {
    root: unknown;
    nickname?: string;
    version: string;
    initialEquipment: unknown;
    /** Equipment after the live profile changed (Ready passes the saved profile). */
    currentEquipment?(): unknown;
    initial: string;
    raceLoader?: unknown;
    prepareAudio?(): Promise<void> | void;
    onVisible?(): void;
    onPageAudio?(page: string): void;
    status(message: string, error?: boolean): void;
    [key: string]: unknown;
  };
  accountAbort: AbortController;
  accountNickname?: string;
  client: LobbyOpenClient;
  lobby?: LobbyOpenView;
  state: { room?: unknown };
  disposed: boolean;
  connected: boolean;
  busy: boolean;
  modalLoading: boolean;
  dialog?: unknown;
  playerId: string;
  channelName?: string;
  page: number;
  refresh?: ReturnType<typeof setInterval>;
  bindClient(): void;
  render(): void;
  list(channel: string, page: number, quiet?: boolean, gameplay?: Gameplay): Promise<void>;
  openDialog(factory: () => unknown): Promise<void>;
  dialogOptions(): unknown;
  create(): Promise<void>;
  join(room: RoomSummary): Promise<void>;
  quickJoin(): Promise<void>;
}

export interface LobbyOpenDependencies {
  protocolVersion: number;
  pageUrl(): string;
  endpoint(path: string, pageUrl: string): string;
  fetchHealth(url: string, signal: AbortSignal): Promise<{
    ok: boolean;
    json(): Promise<{ protocolVersion: unknown }>;
  }>;
  showAccountProgress(root: unknown, signal: AbortSignal): {
    close(): void;
    fail(message: string): Promise<void> | void;
  };
  /** The signed-in account (ECONOMY.md 0: no guests); undefined means not signed in. */
  loadAccount(root: unknown, signal: AbortSignal): Promise<{ nickname: string } | undefined>;
  loadLobby(options: Record<string, unknown>): Promise<LobbyOpenView>;
  notice(options: unknown, title: string, message: string): unknown;
  /**
   * List the game servers and let the player pick one (see game-servers.ts).
   * `failed` holds node IDs this lobby could not enter; they are not offered.
   */
  chooseGameServer(root: unknown, signal: AbortSignal,
    failed?: ReadonlySet<string>): Promise<GameServer>;
  /** Request a fresh one-time ticket from the data service for one attempt. */
  enterGameServer(server: GameServer, sessionToken: string | undefined,
    signal: AbortSignal): Promise<GameServerEntry>;
  sessionToken(pageUrl: string): string | undefined;
  createClient(): LobbyOpenClient;
  /**
   * hello refused equipment the account does not own (403 ITEM_NOT_OWNED):
   * refresh the inventory and replace unowned items in the live profile.
   */
  repairEquipment?(): Promise<void>;
}

/**
 * Ticket, upgrade and hello failures that concern the chosen game node only.
 * The lobby is already mounted when they arrive, so the player is offered the
 * other servers instead of being left in a disconnected lobby.
 */
const REPICK_CODES = [
  "GAME_SERVER_FULL", "GAME_SERVER_NOT_FOUND", "SERVER_FULL", "SERVER_BUSY",
  "SERVER_SHUTTING_DOWN", "TICKET_WRONG_NODE", "DATA_NODE_MISMATCH",
  "PROTOCOL_MISMATCH", "WebSocket connection failed", "WebSocket connection timeout",
];
const MAX_REPICKS = 3;

/** Pick a game server behind the service progress view, reporting failures in it. */
async function selectGameServer(host: LobbyOpenHost, deps: LobbyOpenDependencies,
  failed?: ReadonlySet<string>): Promise<GameServer> {
  const signal = host.accountAbort.signal;
  const progress = deps.showAccountProgress(host.options.root, signal);
  try {
    const server = await deps.chooseGameServer(host.options.root, signal, failed);
    progress.close();
    return server;
  } catch (error) {
    if (signal.aborted ||
        (error instanceof Error && error.message === "ACCOUNT_CANCELLED")) {
      progress.close();
    } else {
      await progress.fail(`无法进入游戏服务器：${formatMultiplayerError(error)}`);
    }
    throw error;
  }
}

/**
 * Authenticate with the data service, choose a game server, mount the lobby
 * and connect to that server with a fresh one-time ticket per attempt.
 */
export async function openMultiplayerLobby(host: LobbyOpenHost,
  deps: LobbyOpenDependencies): Promise<void> {
  const progress = deps.showAccountProgress(host.options.root, host.accountAbort.signal);
  let account: { nickname: string } | undefined;
  try {
    const response = await deps.fetchHealth(
      deps.endpoint("healthz", deps.pageUrl()), host.accountAbort.signal);
    if (!response.ok) throw new Error("无法验证联机服务版本，请检查后端服务。");
    const version = (await response.json()).protocolVersion;
    if (!Number.isInteger(version)) throw new Error("无法验证联机服务版本，请检查后端服务。");
    if (version !== deps.protocolVersion) {
      throw new Error(`联机前端版本 ${deps.protocolVersion}，后端版本 ${version}。请同步更新后端。`);
    }
    account = await deps.loadAccount(host.options.root, host.accountAbort.signal);
  } catch (error) {
    if (host.accountAbort.signal.aborted ||
        (error instanceof Error && error.message === "ACCOUNT_CANCELLED")) {
      progress.close();
    } else {
      await progress.fail(`无法打开多人登录：${formatMultiplayerError(error)}`);
    }
    throw error;
  }

  if (!account) {
    // Every player signs in at startup; there is no guest nickname path.
    await progress.fail(`无法打开多人游戏：${formatMultiplayerError(new Error("LOGIN_REQUIRED"))}`);
    throw new Error("LOGIN_REQUIRED");
  }
  progress.close();
  if (host.disposed) return;
  host.accountNickname = account.nickname;
  let server = await selectGameServer(host, deps);
  if (host.disposed) return;
  await host.options.prepareAudio?.();
  if (host.disposed) return;

  const lobby = await deps.loadLobby({
    ...host.options,
    onMode: (channel: string, page: number, gameplay?: Gameplay) => {
      void host.list(channel, page, false, gameplay ?? "ordinary");
    },
    onUnavailable: (title: string, message: string) => {
      void host.openDialog(() => deps.notice(host.dialogOptions(), title, message));
    },
    onCreate: () => { void host.create(); },
    onJoin: (room: RoomSummary) => { void host.join(room); },
    onQuickJoin: () => { void host.quickJoin(); },
  });
  if (host.disposed) {
    lobby.dispose();
    return;
  }
  host.lobby = lobby;
  lobby.show();
  host.options.onVisible?.();
  host.options.onPageAudio?.("lobby");
  host.bindClient();
  host.options.status("多人大厅已打开，正在连接房间服务…");

  const replaceClient = () => {
    host.client.dispose();
    host.client = deps.createClient();
    host.bindClient();
  };
  const failed = new Set<string>();
  let repicks = 0;
  let equipment = host.options.initialEquipment;
  let repaired = false;
  try {
    let response: { type: string; playerId?: string };
    for (;;) {
      try {
        // Tickets are single-use, so every attempt asks for a new one. Only the
        // data service sees the session token; the game server gets the ticket.
        const entry = await deps.enterGameServer(server,
          deps.sessionToken(deps.pageUrl()), host.accountAbort.signal);
        if (host.disposed) return;
        response = await host.client.connect(
          entry.offerUrl, host.accountNickname,
          host.options.version, equipment,
          host.options.initial, !!host.options.raceLoader, entry.ticket);
        break;
      } catch (error) {
        if (host.disposed || !(error instanceof Error)) throw error;
        if (error.message === "ITEM_NOT_OWNED" && deps.repairEquipment && !repaired) {
          // A rental ran out since the profile was read: fall back and retry once.
          repaired = true;
          replaceClient();
          await deps.repairEquipment();
          if (host.disposed) return;
          equipment = host.options.currentEquipment?.() ?? equipment;
          continue;
        }
        if (!REPICK_CODES.includes(error.message) || repicks >= MAX_REPICKS) throw error;
        // The chosen node refused this player; offer the others and try again.
        repicks++;
        failed.add(server.nodeId);
        replaceClient();
        host.options.status(`多人游戏：${formatMultiplayerError(error)}`, true);
        try {
          server = await selectGameServer(host, deps, failed);
        } catch (repick) {
          if (host.disposed) return;
          if (repick instanceof Error && repick.message === "ACCOUNT_CANCELLED") {
            host.options.status("多人游戏：未进入游戏服务器。请返回单人游戏，再重新进入多人游戏。", true);
            return;
          }
          throw repick;
        }
        if (host.disposed) return;
        host.options.status("多人大厅已打开，正在连接房间服务…");
      }
    }
    if (host.disposed) return;
    if (response.type !== "welcome") throw new Error("房间服务身份未确认");
    host.playerId = response.playerId!;
    host.connected = true;
    host.render();
    host.options.status("请选择比赛频道。");
    host.refresh = setInterval(() => {
      if (host.channelName && !host.disposed && !host.state.room && !host.busy &&
          !host.modalLoading && !host.dialog && host.connected) {
        void host.list(host.channelName, host.page, true);
      }
    }, 5_000);
  } catch (error) {
    if (!host.disposed) host.options.status(`多人游戏：${formatMultiplayerError(error)}`, true);
  }
}
