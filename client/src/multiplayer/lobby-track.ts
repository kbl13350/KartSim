import { itemRandomTrackGroups, itemTrackCatalog, type TrackLibrary } from "../resources/track-catalog";
import { formatMultiplayerError } from "./errors";
import type { Gameplay, LobbyRoom } from "./lobby-actions";
import type { ChangingModal } from "./lobby-dialogs";

export interface TrackChoice { id: string; [key: string]: unknown }
export interface RandomTrackGroup { id: string; [key: string]: unknown }
export interface RandomTrackRule { groupId: string; code: number }
export type SelectedTrack =
  | { kind: "track"; track: TrackChoice }
  | { kind: "random"; group: RandomTrackGroup };

export interface TrackSelectView { show(): void; dispose(): void }

export interface LobbyTrackHost {
  options: {
    library: {
      timeAttackTrackCatalog(): Promise<TrackChoice[]>;
      timeAttackRandomTrackGroups(): Promise<RandomTrackGroup[]>;
      timeAttackRandomTrackNames(): Promise<Map<string, string>>;
    };
    root: unknown;
    initialTrackId?: string;
    trackFavorites?: {
      ids(tracks: TrackChoice[]): Set<string>;
      count(): number;
      change(track: TrackChoice, favorite: boolean): void;
    };
    onNotice?: (title: string, message: string) => void;
    onActivate?: () => void;
    status(message: string, error?: boolean): void;
  };
  state: { room?: LobbyRoom };
  playerId: string;
  connected: boolean;
  disposed: boolean;
  busy: boolean;
  modalLoading: boolean;
  dialogGeneration: number;
  changingModal?: ChangingModal;
  roomView?: { countdownLocked?: boolean };
  dialog?: unknown;
  trackSelect?: TrackSelectView;
  garage?: unknown;
  favoriteTracks: Set<string>;
  render(): void;
  mutate(message: Record<string, unknown>): Promise<boolean>;
  isChangingModalCurrent(modal: ChangingModal): boolean;
  finishChangingLoad(modal: ChangingModal, loaded: boolean): void;
  cancelDialog(): void;
  confirmTrack(modal: ChangingModal, choice: SelectedTrack): Promise<void>;
}

export interface TrackSelectOptions {
  library: LobbyTrackHost["options"]["library"];
  root: unknown;
  /** Game types the picker offers; item rooms offer only 道具 (absent: both). */
  gameTypes?: readonly ("item" | "speed")[];
  tracks: TrackChoice[];
  selectedTrackId: string;
  randomGroups: RandomTrackGroup[];
  randomTrackNames: Map<string, string>;
  selectedRandomGroupId?: string;
  favoriteTrackIds: Set<string>;
  getFavoriteCount(): number;
  onFavoriteChange(trackId: string, favorite: boolean): void;
  onCancel(): void;
  onConfirm(choice: SelectedTrack): void;
  onNotice(title: string, message: string): void;
  onError(error: unknown): void;
  onInteraction?: () => void;
}

export interface LobbyTrackDependencies {
  gameplay(room: LobbyRoom): Gameplay;
  isGiantTrack(trackId: string): boolean;
  randomRules: RandomTrackRule[];
  loadView(options: TrackSelectOptions): Promise<TrackSelectView>;
  /** Tracks and random cards of item rooms; defaults to the library's item catalog. */
  itemTracks?(library: LobbyTrackHost["options"]["library"]):
    Promise<{ tracks: TrackChoice[]; groups: RandomTrackGroup[] }>;
}

/** The item track catalog and item random cards of a resource library. */
export async function loadItemTrackChoices(library: unknown):
  Promise<{ tracks: TrackChoice[]; groups: RandomTrackGroup[] }> {
  const source = library as TrackLibrary;
  return {
    tracks: (await itemTrackCatalog(source)).map(track => ({ ...track })),
    groups: (await itemRandomTrackGroups(source)).map(group => ({ ...group })),
  };
}

/**
 * Random track codes keep their numbers in item rooms (3-7 人气, 0 全部,
 * 8 新图, 30 反向) but name the item groups, which the server draws from its
 * item pools; 竞速随机 (40) has no item counterpart.
 */
export function lobbyRandomTrackRules<Rule extends RandomTrackRule>(
  gameplay: Gameplay | undefined, rules: readonly Rule[]): Rule[] {
  if (gameplay !== "item") return rules as Rule[];
  return rules.flatMap(rule => {
    const [gameType, type, level] = rule.groupId.split(":");
    return gameType === "speed" && type !== "speedAll" && level !== undefined
      ? [{ ...rule, groupId: `item:${type}:${level}` }] : [];
  });
}

/** Open the track picker while the host retains room editing rights. */
export async function chooseLobbyTrack(host: LobbyTrackHost,
  deps: LobbyTrackDependencies): Promise<void> {
  const room = host.state.room;
  if ((room && ["roadblock", "lte"].includes(deps.gameplay(room))) ||
      !room || room.phase !== "open" || room.hostId !== host.playerId ||
      host.disposed || host.roomView?.countdownLocked || host.busy ||
      host.dialog || host.trackSelect || host.garage || host.modalLoading ||
      !host.connected) return;
  host.modalLoading = true;
  const modal: ChangingModal = { kind: "track", roomId: room.roomId,
    generation: ++host.dialogGeneration, entered: false,
    released: false, releaseAllowed: true };
  host.changingModal = modal;
  host.render();
  let loaded = false;
  try {
    if (!(await host.mutate({ type: "changing", roomId: room.roomId, changing: true })) ||
        ((modal.entered = true), !host.isChangingModalCurrent(modal))) return;
    // 道具赛 rooms pick from the item catalog and the item random cards only.
    const item = deps.gameplay(room) === "item";
    const itemChoices = item
      ? await (deps.itemTracks ?? loadItemTrackChoices)(host.options.library) : undefined;
    const catalog = itemChoices?.tracks ?? await host.options.library.timeAttackTrackCatalog();
    const tracks = deps.gameplay(room) === "giant"
      ? catalog.filter(track => deps.isGiantTrack(track.id)) : catalog;
    if (!host.isChangingModalCurrent(modal)) return;
    const rules = lobbyRandomTrackRules(deps.gameplay(room), deps.randomRules);
    const groups = room.resourceVersion === "p3553"
      ? (itemChoices?.groups ?? await host.options.library.timeAttackRandomTrackGroups())
        .filter(group => rules.some(rule => rule.groupId === group.id &&
          (deps.gameplay(room) !== "giant" || rule.code === 0)))
      : [];
    const names = groups.length
      ? await host.options.library.timeAttackRandomTrackNames() : new Map<string, string>();
    if (!host.isChangingModalCurrent(modal)) return;
    const favorites = host.options.trackFavorites;
    const listed = (id: string | undefined) => tracks.some(track => track.id === id);
    const selectedTrackId = (item && !listed(room.trackId) ? undefined : room.trackId) ??
      (listed(host.options.initialTrackId)
        ? host.options.initialTrackId : tracks[0]?.id) ?? "";
    const view = await deps.loadView({
      library: host.options.library,
      root: host.options.root,
      ...(item ? { gameTypes: ["item"] as const } : {}),
      tracks,
      selectedTrackId,
      randomGroups: groups,
      randomTrackNames: names,
      selectedRandomGroupId: rules.find(rule =>
        rule.code === room.randomTrackCode)?.groupId,
      favoriteTrackIds: favorites?.ids(tracks) ?? host.favoriteTracks,
      getFavoriteCount: () => favorites?.count() ?? host.favoriteTracks.size,
      onFavoriteChange: (trackId, favorite) => {
        const track = tracks.find(candidate => candidate.id === trackId);
        if (!track) return;
        if (favorites) favorites.change(track, favorite);
        else if (favorite) host.favoriteTracks.add(trackId);
        else host.favoriteTracks.delete(trackId);
      },
      onCancel: () => {
        if (host.isChangingModalCurrent(modal)) host.cancelDialog();
      },
      onConfirm: choice => { void host.confirmTrack(modal, choice); },
      onNotice: host.options.onNotice ?? ((_title, message) => host.options.status(message)),
      onError: error => host.options.status(formatMultiplayerError(error), true),
      onInteraction: host.options.onActivate,
    });
    if (!host.isChangingModalCurrent(modal)) {
      view.dispose();
      return;
    }
    host.trackSelect = view;
    loaded = true;
    view.show();
  } catch (error) {
    if (!host.disposed) host.options.status(`选择赛道：${formatMultiplayerError(error)}`, true);
  } finally {
    host.finishChangingLoad(modal, loaded);
  }
}

/** Submit a concrete or random track choice at the current room revision. */
export async function confirmLobbyTrack(host: LobbyTrackHost,
  modal: ChangingModal, choice: SelectedTrack,
  rules: RandomTrackRule[]): Promise<void> {
  if (!host.isChangingModalCurrent(modal) || host.busy) return;
  const room = host.state.room!;
  const randomRule = choice.kind === "random"
    ? lobbyRandomTrackRules(room.gameplay, rules).find(rule => rule.groupId === choice.group.id)
    : undefined;
  if (choice.kind === "random" && !randomRule) return;
  host.trackSelect?.dispose();
  host.trackSelect = undefined;
  host.modalLoading = true;
  try {
    await host.mutate(choice.kind === "track"
      ? { type: "track", roomId: room.roomId, revision: room.revision,
        trackId: choice.track.id }
      : { type: "random-track", roomId: room.roomId, revision: room.revision,
        randomTrackCode: randomRule!.code });
  } finally {
    if (host.changingModal === modal) host.cancelDialog();
  }
}
