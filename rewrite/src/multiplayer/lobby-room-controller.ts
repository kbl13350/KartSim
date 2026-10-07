/** Room controller facade over the readable construction, timing and view modules. */

import { handleLobbyEmotionKey, handleLobbyRoomKey, initializeLobbyRoom,
  loadLobbyRoom, type ConstructedLobbyRoom,
  type LobbyRoomConstructionDependencies } from "./lobby-room-construction";
import { activateLobbyReadyShortcut, closeLobbyEmotionWheel,
  disposeLobbyRoom, hideLobbyRoom, installLobbyRoomKeyboard,
  removeLobbyRoomKeyboard, showLobbyRoom, toggleLobbyEmotionWheel,
  updateLobbyRoom, type LobbyRoomLifecycleDependencies,
  type LobbyRoomLifecycleHost } from "./lobby-room-lifecycle";
import { lobbyRoomNodeState, type LobbyRoomStateDependencies,
  type LobbyRoomStateHost } from "./lobby-room-state";
import { initializeLobbyRoomInstanceState } from "./lobby-room-instance-state";
import { loadLobbyRoomTrack, type LobbyRoomTrackDependencies,
  type LobbyRoomTrackHost } from "./lobby-room-track";
import { animateLobbyRoom, canAnimateLobbyRoom, isLobbyCountdownLocked,
  lobbyCountdownState, sendLobbyChat, sendLobbyEmotion,
  setLobbyStartPresentation, updateLobbyCountdown,
  type LobbyRoomTimingHost, type LobbyTimingDependencies } from
  "./lobby-room-timing";

export interface LobbyRoomControllerDependencies {
  construction: LobbyRoomConstructionDependencies;
  lifecycle: LobbyRoomLifecycleDependencies;
  timing: LobbyTimingDependencies;
  track: LobbyRoomTrackDependencies;
  state: LobbyRoomStateDependencies;
  documentBody(): unknown;
}

const controllerDependencies = new WeakMap<object, LobbyRoomControllerDependencies>();
const own = <T>(controller: LobbyRoomController) => controller as unknown as T;
const dependencies = (controller: LobbyRoomController) => {
  const value = controllerDependencies.get(controller);
  if (!value) throw new Error("房间控制器依赖尚未初始化。");
  return value;
};

export class LobbyRoomController {
  declare emotions: unknown[];

  constructor(room: Parameters<typeof initializeLobbyRoom>[1],
    playerId: unknown, actions: unknown, library: unknown,
    services: LobbyRoomControllerDependencies) {
    controllerDependencies.set(this, services);
    initializeLobbyRoomInstanceState(this as unknown as Record<string, unknown>, {
      emotion: (host, event) => handleLobbyEmotionKey(
        host as unknown as ConstructedLobbyRoom,
        event as Parameters<typeof handleLobbyEmotionKey>[1]),
      room: (host, event) => handleLobbyRoomKey(
        host as unknown as ConstructedLobbyRoom,
        event as Parameters<typeof handleLobbyRoomKey>[1],
        services.documentBody()),
    });
    initializeLobbyRoom(own<ConstructedLobbyRoom>(this), room, playerId,
      actions, library);
  }

  show() { return showLobbyRoom(own<LobbyRoomLifecycleHost>(this),
    dependencies(this).lifecycle); }
  setStartPresentation(enabled: boolean) {
    return setLobbyStartPresentation(own<LobbyRoomTimingHost>(this), enabled,
      dependencies(this).timing);
  }
  roomCanAnimate() { return canAnimateLobbyRoom(own<LobbyRoomTimingHost>(this)); }
  hide() { return hideLobbyRoom(own<LobbyRoomLifecycleHost>(this),
    dependencies(this).lifecycle); }
  activateReadyShortcut() {
    return activateLobbyReadyShortcut(own<LobbyRoomLifecycleHost>(this));
  }
  update(room: Parameters<typeof updateLobbyRoom>[1], busy: boolean,
    connected: boolean) {
    return updateLobbyRoom(own<LobbyRoomLifecycleHost>(this), room, busy,
      connected, this.emotions, dependencies(this).lifecycle);
  }
  dispose() { return disposeLobbyRoom(own<LobbyRoomLifecycleHost>(this),
    dependencies(this).lifecycle); }
  installRoomKeyboard() { return installLobbyRoomKeyboard(
    own<LobbyRoomLifecycleHost>(this), dependencies(this).lifecycle); }
  removeRoomKeyboard() { return removeLobbyRoomKeyboard(
    own<LobbyRoomLifecycleHost>(this), dependencies(this).lifecycle); }
  toggleEmotionWheel() { return toggleLobbyEmotionWheel(
    own<LobbyRoomLifecycleHost>(this)); }
  closeEmotionWheel() { return closeLobbyEmotionWheel(
    own<LobbyRoomLifecycleHost>(this)); }
  updateCountdown(room: LobbyRoomTimingHost["room"]) {
    return updateLobbyCountdown(own<LobbyRoomTimingHost>(this), room,
      dependencies(this).timing);
  }
  countdownState() { return lobbyCountdownState(
    own<LobbyRoomTimingHost>(this), dependencies(this).timing); }
  get countdownLocked() { return isLobbyCountdownLocked(
    own<LobbyRoomTimingHost>(this)); }
  async sendEmotion(emotion: Parameters<typeof sendLobbyEmotion>[1]) {
    return sendLobbyEmotion(own<LobbyRoomTimingHost>(this), emotion);
  }
  animate() { return animateLobbyRoom(own<LobbyRoomTimingHost>(this),
    dependencies(this).timing); }
  async loadTrack() { return loadLobbyRoomTrack(own<LobbyRoomTrackHost>(this),
    dependencies(this).track); }
  async sendChat() { return sendLobbyChat(own<LobbyRoomTimingHost>(this)); }
  state(node: unknown) { return lobbyRoomNodeState(
    own<LobbyRoomStateHost>(this), node, dependencies(this).state); }
}

export async function loadLobbyRoomController<T extends LobbyRoomController>(
  create: (room: Parameters<typeof initializeLobbyRoom>[1], playerId: unknown,
    actions: unknown, library: unknown) => T,
  library: unknown, root: unknown,
  room: Parameters<typeof loadLobbyRoom>[3], playerId: unknown,
  actions: Parameters<typeof loadLobbyRoom>[5], audioContext: unknown,
  services: LobbyRoomControllerDependencies): Promise<T> {
  return loadLobbyRoom(create as unknown as Parameters<typeof loadLobbyRoom>[0],
    library, root, room, playerId, actions, audioContext,
    services.construction) as unknown as Promise<T>;
}
