import { formatMultiplayerError } from "./errors";
import type { Gameplay, RoomSummary } from "./lobby-actions";

export interface LobbyOpenView {
  show(): void;
  dispose(): void;
}

export interface LobbyOpenClient {
  connect(url: string, nickname: string, version: string, equipment: unknown,
    initial: string, raceRuntime: boolean, token: string | undefined):
    Promise<{ type: string; playerId?: string }>;
  dispose(): void;
}

export interface LobbyOpenHost {
  options: {
    root: unknown;
    nickname?: string;
    version: string;
    initialEquipment: unknown;
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
  loadAccount(root: unknown, signal: AbortSignal): Promise<{ nickname: string } | undefined>;
  chooseNickname(root: unknown, suggestion: string, signal: AbortSignal,
    retry?: boolean): Promise<string>;
  loadLobby(options: Record<string, unknown>): Promise<LobbyOpenView>;
  notice(options: unknown, title: string, message: string): unknown;
  sessionToken(pageUrl: string): string | undefined;
  rememberNickname(nickname: string): void;
  createClient(): LobbyOpenClient;
}

/** Authenticate, mount the lobby and establish the room control connection. */
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

  progress.close();
  if (host.disposed) return;
  host.accountNickname = account?.nickname ?? await deps.chooseNickname(
    host.options.root, host.options.nickname ?? "", host.accountAbort.signal);
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

  try {
    let response: { type: string; playerId?: string };
    for (;;) {
      try {
        const pageUrl = deps.pageUrl();
        response = await host.client.connect(
          deps.endpoint("offer", pageUrl), host.accountNickname,
          host.options.version, host.options.initialEquipment,
          host.options.initial, !!host.options.raceLoader,
          deps.sessionToken(pageUrl));
        break;
      } catch (error) {
        if (account || host.disposed || !(error instanceof Error) ||
            !["GUEST_NAME_TAKEN", "INVALID_GUEST_NAME"].includes(error.message)) {
          throw error;
        }
        host.client.dispose();
        host.client = deps.createClient();
        host.bindClient();
        host.accountNickname = await deps.chooseNickname(host.options.root,
          host.accountNickname ?? "", host.accountAbort.signal, true);
      }
    }
    if (host.disposed) return;
    if (response.type !== "welcome") throw new Error("房间服务身份未确认");
    if (!account) deps.rememberNickname(host.accountNickname);
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
