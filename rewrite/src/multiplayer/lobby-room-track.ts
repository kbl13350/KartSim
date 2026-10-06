/** Resolves and paints the current room's selected or random track card. */

interface ByteEntry { bytes(): Promise<Uint8Array> }
interface DecodedPng { width: number; height: number; pixels: ArrayLike<number> }
interface TrackCard { id: string; title: string; path: string }

export interface LobbyRoomTrackHost {
  room: { trackId?: string; randomTrackCode?: unknown };
  library: {
    timeAttackTrackCatalog(): Promise<TrackCard[]>;
    get(path: string): { canonicalPath?: string; virtualPath: string } | undefined;
    resolveContainerPath(path: string, containerPath: string): {
      status: string;
      entry: ByteEntry;
    };
    trackMetadata(trackId: string): Promise<{
      difficulty?: unknown;
      [key: string]: unknown;
    } | undefined>;
  };
  actions: { onError?(error: unknown): void };
  disposed: boolean;
  trackIdentity?: string;
  trackLoad: number;
  trackImage?: unknown;
  trackReverseStamp?: unknown;
  trackIcon?: unknown;
  trackDifficulty?: unknown;
  trackTitle: string;
  view: { render(): void };
}

export interface LobbyRoomTrackDependencies {
  randomTrack(code: unknown): {
    code: string;
    title: string;
    cardToken: string;
  } | undefined;
  mode(room: LobbyRoomTrackHost["room"]): string;
  uiResource(library: LobbyRoomTrackHost["library"], roots: string[],
    token: string): ByteEntry;
  decodePng(bytes: Uint8Array): Promise<DecodedPng>;
  canvas(image: DecodedPng): unknown;
  roadblockTracks(library: LobbyRoomTrackHost["library"]): Promise<TrackCard[]>;
  theme(metadata: Record<string, unknown>): string | undefined;
}

export async function loadLobbyRoomTrack(host: LobbyRoomTrackHost,
  dependencies: LobbyRoomTrackDependencies): Promise<void> {
  const trackId = host.room.trackId;
  const random = host.room.randomTrackCode === undefined ? undefined
    : dependencies.randomTrack(host.room.randomTrackCode);
  const identity = random ? `random:${random.code}` : trackId;
  if (identity === host.trackIdentity) return;
  host.trackIdentity = identity;
  const generation = ++host.trackLoad;
  host.trackImage = undefined;
  host.trackReverseStamp = undefined;
  host.trackIcon = undefined;
  host.trackDifficulty = undefined;
  host.trackTitle = trackId ? "正在加载赛道…" : "尚未选择赛道";

  if (random) {
    host.trackTitle = dependencies.mode(host.room) === "lte"
      ? "全部随机（LTE限定3张）" : random.title;
    try {
      const token = dependencies.mode(host.room) === "lte"
        ? "lteRandom@zz" : random.cardToken;
      const image = await dependencies.decodePng(
        await dependencies.uiResource(host.library,
          ["dialog2_/selectTrackEx"], token).bytes());
      if (host.disposed || generation !== host.trackLoad) return;
      host.trackImage = dependencies.canvas(image);
      host.view.render();
    } catch (error) {
      if (!host.disposed && generation === host.trackLoad) {
        host.actions.onError?.(error);
      }
    }
    return;
  }
  if (!trackId) {
    host.view.render();
    return;
  }
  try {
    const tracks = await (dependencies.mode(host.room) === "roadblock"
      ? dependencies.roadblockTracks(host.library)
      : host.library.timeAttackTrackCatalog());
    const track = tracks.find(candidate => candidate.id === trackId);
    if (!track) throw new Error("本地资源中没有房主选择的赛道");
    const resource = host.library.get(track.path);
    if (!resource) throw new Error("赛道资源缺失");
    const canonical = (resource.canonicalPath ?? resource.virtualPath)
      .replaceAll("\\", "/");
    const card = host.library.resolveContainerPath(track.path,
      `${canonical.slice(0, canonical.lastIndexOf("/") + 1)}xt_trackCard.png`);
    if (card.status !== "found") {
      throw new Error("赛道卡片资源缺失或不唯一");
    }
    const metadata = await host.library.trackMetadata(trackId);
    const theme = metadata && dependencies.theme(metadata);
    if (!theme || metadata?.difficulty === undefined) {
      throw new Error("赛道主题或难度资源缺失");
    }
    const [trackImage, icon, reverse] = await Promise.all([
      dependencies.decodePng(await card.entry.bytes()),
      dependencies.decodePng(await dependencies.uiResource(host.library,
        ["dialog2_/selectTrackEx"], `${theme}_1`).bytes()),
      /_rvs$/i.test(trackId)
        ? dependencies.decodePng(await dependencies.uiResource(host.library,
          ["stage_/common"], "큰리버스트랙").bytes())
        : undefined,
    ]);
    if (host.disposed || generation !== host.trackLoad) return;
    const imageCanvas = dependencies.canvas(trackImage);
    const iconCanvas = dependencies.canvas(icon);
    host.trackIcon = iconCanvas;
    host.trackDifficulty = metadata.difficulty;
    if (reverse) host.trackReverseStamp = dependencies.canvas(reverse);
    host.trackImage = imageCanvas;
    host.trackTitle = track.title;
    host.view.render();
  } catch (error) {
    if (!host.disposed && generation === host.trackLoad) {
      host.trackTitle = "赛道资源不可用";
      host.view.render();
      host.actions.onError?.(error);
    }
  }
}
