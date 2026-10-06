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
    const catalog = await host.options.library.timeAttackTrackCatalog();
    const tracks = deps.gameplay(room) === "giant"
      ? catalog.filter(track => deps.isGiantTrack(track.id)) : catalog;
    if (!host.isChangingModalCurrent(modal)) return;
    const groups = room.resourceVersion === "p3553"
      ? (await host.options.library.timeAttackRandomTrackGroups()).filter(group =>
          deps.randomRules.some(rule => rule.groupId === group.id &&
            (deps.gameplay(room) !== "giant" || rule.code === 0)))
      : [];
    const names = groups.length
      ? await host.options.library.timeAttackRandomTrackNames() : new Map<string, string>();
    if (!host.isChangingModalCurrent(modal)) return;
    const favorites = host.options.trackFavorites;
    const selectedTrackId = room.trackId ??
      (tracks.some(track => track.id === host.options.initialTrackId)
        ? host.options.initialTrackId : tracks[0]?.id) ?? "";
    const view = await deps.loadView({
      library: host.options.library,
      root: host.options.root,
      tracks,
      selectedTrackId,
      randomGroups: groups,
      randomTrackNames: names,
      selectedRandomGroupId: deps.randomRules.find(rule =>
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
    ? rules.find(rule => rule.groupId === choice.group.id) : undefined;
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
