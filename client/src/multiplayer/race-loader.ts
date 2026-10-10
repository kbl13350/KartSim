import { downloadRaceTrack } from "../resources/resource-manager";
/** Resource and connection assembly for a live multiplayer race. */
import { isItemRace, itemTrackCardModeKey } from "./lobby-item-mode";
export interface MultiplayerRaceLoaderDependencies {
  createToonStageBinding(): unknown;
  loadRaceAssets(assets: unknown, config: any, room: any, audio: unknown,
    player: unknown, signal: AbortSignal): Promise<any>;
  loadCharacterAnimations(library: unknown, multiplayer: boolean): Promise<any>;
  createNetworkDriver(assets: any, room: any, connection: any,
    now: () => number, fail: (error: unknown) => void, clientFramerate: unknown): any;
  loadTimeGap(library: unknown, assets: any, playerId: unknown): Promise<any>;
  loadCountdownAudio(library: unknown, audio: unknown, multiplayer: boolean): Promise<any>;
  loadRoadblockFlag(library: unknown, assets: any): Promise<any>;
  loadTrackCard(options: unknown): Promise<any>;
  loadRoadblockHud(library: unknown, root: HTMLElement, room: any, playerId: unknown): Promise<any>;
  loadRoadblockResult(library: unknown, root: HTMLElement, room: any): Promise<any>;
  loadRoadblockOverlay(library: unknown, root: HTMLElement): Promise<any>;
  loadRaceResult(library: unknown, root: HTMLElement, room: any,
    playerId: unknown, teamMode: boolean | "item-team"): Promise<any>;
  findKart(garage: unknown, kartId: unknown, serial: unknown): any;
  bannerKind(kart: unknown, engineGrade: unknown, mode: string, speed: unknown): unknown;
  loadBanner(library: unknown, root: HTMLElement): Promise<any>;
  createPresenter(...args: any[]): any;
  loadRaceChat(library: unknown, root: HTMLElement, connection: any, status: unknown): Promise<any>;
  createSession(driver: any, presenter: any, host: any, chat: any, overlay: any): any;
  now(): number;
}

export interface MultiplayerRaceLoaderHost {
  assets(): any;
  audio(): any;
  profile(): unknown;
  bgm(): any;
  renderer: { domElement: { parentElement: HTMLElement | null } };
  clientFramerate: unknown;
  status: unknown;
  raceAnonymous?(): boolean;
  classicHud?(): boolean;
  raceTimeGap?(): boolean;
  flyingPetVisible?(): boolean;
  [key: string]: unknown;
}

/** Builds the same `prepare` contract consumed by the game-ready host. */
export function createMultiplayerRaceLoader(
  host: MultiplayerRaceLoaderHost,
  deps: MultiplayerRaceLoaderDependencies,
) {
  return {
    async prepare(config: any, room: any, signal: AbortSignal, connection: any): Promise<any> {
      const source = host.assets();
      const audio = host.audio();
      const library = source.getLibrary();
      if (!connection?.leaveRace || !audio || !library)
        throw new Error("多人驾驶缺少资源、音频或本局连接。");

      const checkCancellation = () => {
        if (signal.aborted) throw new Error("本局装配已取消。");
      };
      checkCancellation();
      // The room's track downloads as the race loads (resource-manager).
      await downloadRaceTrack(room?.trackId);
      checkCancellation();
      const raceAssets = await deps.loadRaceAssets(
        { ...source, toonStageBinding: deps.createToonStageBinding() },
        config, room, audio,
        {
          playerId: connection.playerId,
          profile: host.profile(),
          anonymous: host.raceAnonymous?.() ?? false,
          classicHud: host.classicHud?.() ?? false,
        }, signal,
      );

      let roadblockFlag: any;
      let result: any;
      let roadblockHud: any;
      let roadblockOverlay: any;
      let countdownAudio: any;
      let timeGap: any;
      let driver: any;
      let presenter: any;
      let session: any;
      let chat: any;
      let banner: any;
      let trackCard: any;
      try {
        const animations = await deps.loadCharacterAnimations(library, true);
        checkCancellation();
        driver = deps.createNetworkDriver(
          raceAssets, room, connection, () => deps.now(),
          error => { if (session) session.fail(error); else throw error; },
          host.clientFramerate,
        );
        timeGap = await deps.loadTimeGap(library, raceAssets, connection.playerId);
        checkCancellation();
        countdownAudio = await deps.loadCountdownAudio(library, audio, true);
        checkCancellation();
        const bgm = host.bgm();
        if (!bgm) throw Error("比赛缺少 BGM owner。");
        await bgm.selectRace(library, raceAssets.map.metadata);
        checkCancellation();
        if (!room.roadblock) {
          roadblockFlag = await deps.loadRoadblockFlag(library, raceAssets);
          checkCancellation();
          roadblockFlag.bind(connection, raceAssets);
        }

        const root = host.renderer.domElement.parentElement;
        if (!root) throw new Error("缺少结果界面容器。");
        const directory = raceAssets.map.path.replaceAll("\\", "/").split("/").at(-2);
        if (!directory) throw new Error("赛道信息卡缺少赛道目录。");
        const team = config.mode === "team"
          ? room.roster.find((player: any) => player.playerId === connection.playerId)?.team
          : undefined;
        if (config.mode === "team" && team !== 1 && team !== 2)
          throw new Error("组队赛卡片缺少本机红蓝队身份。");
        const item = isItemRace(raceAssets.drivingMode);
        trackCard = await deps.loadTrackCard({
          library, root, trackId: room.trackId, trackDirectory: directory,
          trackTitle: raceAssets.map.metadata.cnTitle ?? "",
          difficulty: raceAssets.map.metadata.difficulty,
          game: {
            modeKey: item ? itemTrackCardModeKey(config.mode === "team")
              : config.mode === "team" ? "SpeedTeam" : "SpeedIndi",
            speed: config.speed,
            team: team === 1 || team === 2 ? team : undefined,
          },
        });
        checkCancellation();
        trackCard?.setVisible(false);
        if (host.raceTimeGap?.() && !room.roadblock) {
          await timeGap.loadTimeGap(library, root);
          checkCancellation();
        }
        if (room.roadblock) {
          roadblockHud = await deps.loadRoadblockHud(library, root, room, connection.playerId);
          checkCancellation();
          result = await deps.loadRoadblockResult(library, root, room);
          checkCancellation();
          roadblockOverlay = await deps.loadRoadblockOverlay(library, root);
          checkCancellation();
        } else {
          // 组队道具赛 is won by the first finisher's team: no TP column or board.
          result = await deps.loadRaceResult(library, root, room, connection.playerId,
            config.mode === "team" ? item ? "item-team" : true : false);
          checkCancellation();
        }

        const local = raceAssets.participants.find((player: any) =>
          player.playerId === connection.playerId);
        if (!local) throw new Error("本局缺少本机车辆横幅身份。");
        const equipment = local.profile.equipment;
        const kart = deps.findKart(local.profile.garage, equipment.itemIds[3], equipment.kartSerial);
        const bannerType = deps.bannerKind(kart, local.vehicle.kartItem.engineGrade,
          config.mode === "team" ? "team" : "personal", config.speed);
        if (bannerType) {
          try { banner = await deps.loadBanner(library, root); }
          catch { banner = undefined; }
          checkCancellation();
        }

        presenter = deps.createPresenter(
          raceAssets, driver, room, connection.playerId, animations, timeGap,
          source.targetRandom, countdownAudio, roadblockFlag, result, bgm, banner,
          bannerType, () => host.flyingPetVisible?.() ?? false, trackCard, roadblockHud,
        );
        await presenter.prepareRoadBlockFlag(library);
        checkCancellation();
        await presenter.prepareGiant(library, audio);
        checkCancellation();
        await presenter.prepareRoadBlockResult(library);
        checkCancellation();
        await presenter.prepareFlyingPet(library, audio);
        checkCancellation();
        await presenter.prepareTrackEvents(library, audio);
        checkCancellation();
        presenter.warm(host.renderer, deps.now());
        checkCancellation();
        chat = await deps.loadRaceChat(library, root, connection, host.status);
        checkCancellation();
        session = deps.createSession(driver, presenter, {
          ...host,
          leave: () => connection.leaveRace(),
          returnToRoom: () => connection.returnToRoom
            ? connection.returnToRoom()
            : Promise.reject(new Error("本局连接不支持返回房间。")),
          closePresentation: () => connection.presentationClosed?.(),
        }, chat, roadblockOverlay);
        return session;
      } catch (error) {
        chat?.dispose();
        roadblockOverlay?.dispose();
        presenter?.dispose();
        if (!presenter) {
          roadblockHud?.dispose();
          trackCard?.dispose();
          banner?.dispose();
          countdownAudio?.dispose();
          roadblockFlag?.dispose();
          result?.dispose();
        }
        timeGap?.dispose();
        if (driver) driver.dispose();
        else raceAssets.dispose();
        throw error;
      }
    },
  };
}
