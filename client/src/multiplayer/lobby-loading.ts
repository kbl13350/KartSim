import { formatMultiplayerError } from "./errors";
import type { LobbyRoom } from "./lobby-actions";

export interface RaceLoadingView {
  show(loadedCount: number, memberCount: number): void;
  hide(): void;
  dispose(): void;
}

export interface LobbyLoadingHost {
  state: { room?: LobbyRoom };
  options: {
    raceLoader?: unknown;
    library?: unknown;
    root?: unknown;
    status(message: string, error?: boolean): void;
  };
  roomView?: { setStartPresentation?(presenting: boolean): void };
  loadingView?: RaceLoadingView;
  loadingViewPending?: Promise<void>;
  loadingViewFailed: boolean;
  startPresentation?: {
    complete: boolean;
    signal: AbortSignal;
    roomId: string;
    raceId: string;
  };
  disposed: boolean;
  connected: boolean;
  raceVisible: boolean;
  startMission?: unknown;
  rpNotice?: unknown;
  syncLoadingView(): void;
}

/** Load the multiplayer race overlay once and match it to the current race. */
export function syncRaceLoadingView(host: LobbyLoadingHost,
  load: (library: unknown, root: unknown) => Promise<RaceLoadingView>): void {
  const room = host.state.room;
  if (room && host.options.raceLoader && host.options.library && host.options.root &&
      !host.loadingView && !host.loadingViewPending && !host.loadingViewFailed && !host.disposed) {
    host.loadingViewPending = load(host.options.library, host.options.root)
      .then(view => {
        if (host.disposed) {
          view.dispose();
          return;
        }
        host.loadingView = view;
        host.syncLoadingView();
      })
      .catch(error => {
        host.loadingViewFailed = true;
        if (!host.disposed) host.options.status(`比赛加载画面资源失败：${formatMultiplayerError(error)}`, true);
      })
      .finally(() => {
        host.loadingViewPending = undefined;
      });
  }
  const presentation = host.startPresentation;
  const isPresenting = !!(presentation && !presentation.complete &&
    !presentation.signal.aborted && presentation.roomId === room?.roomId &&
    presentation.raceId === room?.race?.raceId);
  host.roomView?.setStartPresentation?.(isPresenting);
  const overlay = host.loadingView;
  if (!overlay) return;
  const bannerReady = !(room?.race?.rp || room?.race?.roadblock) || !!(
    presentation?.complete && !presentation.signal.aborted &&
    presentation.roomId === room?.roomId && presentation.raceId === room?.race?.raceId);
  if (!host.disposed && host.connected && !host.raceVisible && bannerReady &&
      !host.startMission && !host.rpNotice &&
      (room?.phase === "loading" || room?.phase === "countdown")) {
    overlay.show(room.race?.loadedIds.length ?? 0, room.members.length);
  } else {
    overlay.hide();
  }
}
