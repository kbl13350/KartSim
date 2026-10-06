import { formatMultiplayerError } from "./errors";
import type { CoordinatedRace, CoordinatedRoom, PreparedRace,
  RaceStartOptions } from "./race-start-coordinator";

interface PresentationBanner {
  present(signal: AbortSignal): Promise<void>;
  dispose(): void;
}

interface RaceConnection {
  readonly hasMotionRecipients: boolean;
  readonly motionRoundTripMs?: number;
  sendRaceChat(text: string): Promise<unknown>;
  subscribeRaceChat(listener: (message: unknown) => void): () => void;
  returnToRoom?(): Promise<unknown>;
  [key: string]: unknown;
}

interface RacePresentation {
  showWaiting?(): void;
  bindClock?(mapping: Record<string, unknown>): void;
  updateRoom?(room: CoordinatedRoom): void;
  scheduleStart(localTick: number): void;
  presentingResults?(): boolean;
  dispose(): void;
}

interface RacePresentationConnection extends RaceConnection {
  sendRaceChat(text: string): Promise<unknown>;
  subscribeRaceChat(listener: (message: unknown) => void): () => void;
  leaveRace(): Promise<unknown>;
  presentationClosed(): void;
}

export interface LobbyRaceHost {
  options: {
    library: unknown;
    root: unknown;
    raceLoader?: {
      prepare(room: CoordinatedRoom, race: CoordinatedRace, signal: AbortSignal,
        connection: RacePresentationConnection): Promise<RacePresentation>;
    };
    audioContext?(): unknown;
    onRaceVisibility?(visible: boolean): void;
    onPageAudio?(page: string): void;
    status(message: string, error?: boolean): void;
  };
  client: {
    raceConnection(roomId: string, raceId: string, signal: AbortSignal): RaceConnection;
    request(message: Record<string, unknown>): Promise<unknown>;
    subscribe(listener: (event: { type: string; roomId?: string;
      message?: unknown }) => void): () => void;
    captureClock(): Record<string, unknown> | undefined;
  };
  state: { room?: CoordinatedRoom };
  roomView?: { hide(): void; show(): void };
  startCoordinator?: { releasePresentedRace(): void };
  startMission?: PresentationBanner;
  rpNotice?: PresentationBanner;
  startPresentation?: { roomId: string; raceId: string;
    complete: boolean; signal: AbortSignal };
  playerId: string;
  disposed: boolean;
  raceVisible: boolean;
  autoReadyRoom?: string;
  autoReadyConsumed: boolean;
  syncLoadingView(): void;
  render(): void;
  maybeAutoReady(): void;
}

export interface LobbyRaceDependencies {
  createCoordinator(options: RaceStartOptions): {
    releasePresentedRace(): void;
  };
  preloadRpPet(library: unknown, race: CoordinatedRace,
    playerId: string, signal: AbortSignal): Promise<void>;
  loadRoadblock(library: unknown, root: unknown, race: CoordinatedRace,
    playerId: string): Promise<PresentationBanner>;
  loadRpNotice(library: unknown, root: unknown, race: CoordinatedRace,
    playerId: string, audioContext: unknown): Promise<PresentationBanner>;
}

/** Bind loading banners and the game renderer to one race coordinator. */
export function initializeLobbyRace(host: LobbyRaceHost,
  deps: LobbyRaceDependencies): void {
  const options = host.options;
  if (!options.raceLoader) return;
  const loader = options.raceLoader;
  host.startCoordinator = deps.createCoordinator({
    loader: { prepare: async (room, race, signal): Promise<PreparedRace> => {
      const presentation = { roomId: room.roomId, raceId: race.raceId,
        complete: false, signal };
      host.startPresentation = presentation;
      host.syncLoadingView();
      const petPreload = race.rp
        ? deps.preloadRpPet(options.library, race, host.playerId, signal).then(
            () => ({ ok: true as const }),
            error => ({ ok: false as const, error }))
        : undefined;

      if (race.roadblock) {
        const banner = await deps.loadRoadblock(options.library, options.root,
          race, host.playerId);
        try {
          if (signal.aborted || host.disposed) throw new Error("本局任务横幅已取消。");
          host.startMission = banner;
          host.syncLoadingView();
          await banner.present(signal);
        } finally {
          banner.dispose();
          if (host.startMission === banner) {
            host.startMission = undefined;
            host.syncLoadingView();
          }
        }
      }
      if (race.rp) {
        const banner = await deps.loadRpNotice(options.library, options.root,
          race, host.playerId, options.audioContext?.());
        try {
          if (signal.aborted || host.disposed) throw new Error("本局 RP 结果展示已取消。");
          host.rpNotice = banner;
          host.syncLoadingView();
          await banner.present(signal);
        } finally {
          banner.dispose();
          if (host.rpNotice === banner) {
            host.rpNotice = undefined;
            host.syncLoadingView();
          }
        }
      }
      if (signal.aborted || host.disposed) throw new Error("本局开始展示已取消。");
      presentation.complete = true;
      host.syncLoadingView();
      if (petPreload) {
        const result = await petPreload;
        if (signal.aborted || host.disposed) throw new Error("本局飞宠预读已取消。");
        if (!result.ok) throw result.error;
      }

      const connection = host.client.raceConnection(room.roomId, race.raceId, signal);
      let returnedToRoom = false;
      let sawFinished = false;
      let stage!: RacePresentation;
      const scoped: RacePresentationConnection = {
        ...connection,
        get hasMotionRecipients() { return connection.hasMotionRecipients; },
        get motionRoundTripMs() { return connection.motionRoundTripMs; },
        sendRaceChat: text => {
          const current = host.state.room;
          return signal.aborted || current?.roomId !== room.roomId
            ? Promise.reject(new Error("本局已结束。"))
            : current.phase === "open"
              ? host.client.request({ type: "chat", roomId: room.roomId, text })
              : connection.sendRaceChat(text);
        },
        subscribeRaceChat: listener => {
          const unbindRace = connection.subscribeRaceChat(message => {
            if (host.state.room?.phase !== "open") listener(message);
          });
          const unbindLobby = host.client.subscribe(event => {
            if (!signal.aborted && host.state.room?.roomId === room.roomId &&
                host.state.room.phase === "open" && event.type === "chat" &&
                event.roomId === room.roomId) listener(event.message);
          });
          return () => { unbindRace(); unbindLobby(); };
        },
        leaveRace: async () => {
          const current = host.state.room;
          if (signal.aborted || current?.roomId !== room.roomId ||
              current.race?.raceId !== race.raceId) {
            throw new Error("本局已结束。");
          }
          return host.client.request({ type: "leave", roomId: current.roomId,
            revision: current.revision });
        },
        presentationClosed: () => {
          if (signal.aborted || host.disposed || host.state.room?.roomId !== room.roomId ||
              host.state.room.phase !== "open" || stage.presentingResults?.()) return;
          void connection.returnToRoom?.().catch(error => {
            if (!host.disposed) options.status(`返房同步失败：${formatMultiplayerError(error)}`, true);
          });
          returnedToRoom = true;
          host.startCoordinator?.releasePresentedRace();
        },
      };
      stage = await loader.prepare(room, race, signal, scoped);
      let visible = false;
      const showRace = () => {
        if (visible) return;
        visible = true;
        host.raceVisible = true;
        host.roomView?.hide();
        host.syncLoadingView();
        options.onRaceVisibility?.(true);
      };
      return {
        showWaiting: () => {
          if (stage.showWaiting) {
            stage.showWaiting();
            showRace();
          }
        },
        bindClock: mapping => stage.bindClock?.(mapping),
        updateRoom: next => {
          if (next.phase === "finished") sawFinished = true;
          if (sawFinished && next.phase === "open" && !next.raceError) returnedToRoom = true;
          stage.updateRoom?.(next);
        },
        scheduleStart: localTick => { stage.scheduleStart(localTick); showRace(); },
        presentingResults: () => stage.presentingResults?.() ?? false,
        dispose: () => {
          stage.dispose();
          if (visible) {
            visible = false;
            host.raceVisible = false;
            options.onRaceVisibility?.(false);
            const current = host.state.room;
            if (!host.disposed && current?.roomId === room.roomId) {
              if ((returnedToRoom && current.phase === "open") ||
                  (current.phase === "finished" && current.race?.raceId === race.raceId &&
                    current.race.returnedIds?.includes(host.playerId))) {
                host.autoReadyRoom = current.roomId;
                host.autoReadyConsumed = current.hostId === host.playerId;
              }
              host.roomView?.show();
              host.render();
              options.onPageAudio?.("room");
              host.maybeAutoReady();
            }
          }
        },
      };
    } },
    send: message => host.client.request(message),
    captureClock: () => host.client.captureClock(),
    onError: error => {
      host.syncLoadingView();
      options.status(`比赛加载失败：${formatMultiplayerError(error)}`, true);
    },
  });
}
