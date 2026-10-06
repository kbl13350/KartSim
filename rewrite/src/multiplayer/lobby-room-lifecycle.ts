/** Visible room lifecycle, member updates, chat bubbles, and keyboard actions. */

interface RoomMember {
  playerId: unknown;
  ready?: boolean;
}

interface RoomChat {
  sequence: number;
  playerId: unknown;
  text: string;
}

export interface LobbyRoomSnapshot {
  phase: string;
  hostId: unknown;
  members: RoomMember[];
  chat?: RoomChat[];
}

interface LobbyRoomView {
  element: {
    hidden?: boolean;
    contains(target: unknown): boolean;
    removeEventListener(type: string, listener: unknown,
      capture: boolean): void;
  };
  comboOpen?: boolean;
  show(): void;
  hide(): void;
  focus(name: string): void;
  render(): void;
  state(node: unknown): unknown;
  dispose(): void;
}

export interface LobbyRoomLifecycleHost {
  playerId: unknown;
  actions: {
    canStart?(): boolean;
    onError?(error: unknown): void;
  };
  room: LobbyRoomSnapshot;
  busy: boolean;
  connected: boolean;
  view: LobbyRoomView;
  disposed: boolean;
  visible: boolean;
  previews?: {
    update(members: unknown): void;
    play(playerId: unknown, action: unknown): void;
    dispose(): void;
  };
  roleTeams: unknown[];
  animation?: number;
  trackChangeNotice?: {
    update(room: LobbyRoomSnapshot, visible: boolean): void;
    hide(): void;
    dispose(): void;
  };
  countdown?: { dispose(): void };
  bubbles: Map<unknown, { sequence: number; text: string; until: number }>;
  lastChatSequence: number;
  lastManualStartAllowed: boolean;
  lastCountdownLocked: boolean;
  readonly countdownLocked: boolean;
  emotionWheelOpen: boolean;
  trackLoad: number;
  trackImage?: unknown;
  trackReverseStamp?: unknown;
  onEmotionKey: unknown;
  onRoomKey: unknown;
  state(node: unknown): {
    visible?: boolean;
    disabled?: boolean;
    action?: () => void;
    onActivate?: () => void;
  };
  countdownState(): { active: boolean };
  updateCountdown(room: LobbyRoomSnapshot): void;
  roomCanAnimate(): boolean;
  animate(): void;
  closeEmotionWheel(): void;
  loadTrack(): Promise<unknown>;
  removeRoomKeyboard(): void;
}

export interface LobbyRoomLifecycleDependencies {
  previewMembers(room: LobbyRoomSnapshot, roleTeams: unknown[]): unknown;
  parseChat(text: string, emotions: unknown[]): { text: string; action: unknown };
  chatBubbleDurationMs: number;
  nowMs(): number;
  cancelFrame(frame: number): void;
  keyboard: {
    addEventListener(type: string, listener: unknown, capture: boolean): void;
    removeEventListener(type: string, listener: unknown,
      capture: boolean): void;
  };
}

export function showLobbyRoom(host: LobbyRoomLifecycleHost,
  dependencies: LobbyRoomLifecycleDependencies): void {
  if (host.disposed) return;
  host.visible = true;
  host.previews?.update(dependencies.previewMembers(host.room, host.roleTeams));
  host.animate();
  host.view.show();
  host.view.focus("goBackButton");
  void host.loadTrack();
}

export function hideLobbyRoom(host: LobbyRoomLifecycleHost,
  dependencies: LobbyRoomLifecycleDependencies): void {
  host.visible = false;
  if (host.animation !== undefined) dependencies.cancelFrame(host.animation);
  host.animation = undefined;
  host.closeEmotionWheel();
  host.trackChangeNotice?.hide();
  host.view.hide();
}

export function activateLobbyReadyShortcut(host: LobbyRoomLifecycleHost): void {
  if (host.disposed || !host.connected || host.busy ||
    host.room.phase !== "open") return;
  const member = host.room.members.find(item => item.playerId === host.playerId);
  if (!member) return;
  const node = {
    name: "ImageButton",
    text: "",
    attributes: [{
      name: "name",
      value: host.room.hostId === host.playerId
        ? host.countdownState().active ? "start_count" : "start"
        : member.ready
          ? host.countdownState().active ? "cancel_count" : "cancel"
          : "ready",
    }],
    children: [],
  };
  const state = host.state(node);
  if (state.visible !== false && !state.disabled && state.action) {
    state.onActivate?.();
    state.action();
  }
}

export function updateLobbyRoom(host: LobbyRoomLifecycleHost,
  room: LobbyRoomSnapshot, busy: boolean, connected: boolean,
  emotions: unknown[],
  dependencies: LobbyRoomLifecycleDependencies): void {
  if (host.disposed) return;
  host.room = room;
  host.busy = busy;
  host.connected = connected;
  host.trackChangeNotice?.update(room, connected && host.visible);
  host.lastManualStartAllowed = host.actions.canStart?.() !== false;
  host.updateCountdown(room);
  host.lastCountdownLocked = host.countdownLocked;
  if (busy || !connected || room.phase !== "open") host.closeEmotionWheel();

  for (const chat of room.chat ?? []) {
    if (chat.sequence > host.lastChatSequence) {
      const parsed = dependencies.parseChat(chat.text, emotions);
      if (parsed.text) {
        host.bubbles.set(chat.playerId, {
          sequence: chat.sequence,
          text: parsed.text,
          until: dependencies.nowMs() + dependencies.chatBubbleDurationMs,
        });
      } else {
        host.bubbles.delete(chat.playerId);
      }
      host.previews?.play(chat.playerId, parsed.action);
      host.lastChatSequence = chat.sequence;
    }
  }
  for (const [playerId, bubble] of host.bubbles) {
    if (!room.members.some(member => member.playerId === playerId) ||
      bubble.until <= dependencies.nowMs()) {
      host.bubbles.delete(playerId);
    }
  }
  if (connected) {
    host.previews?.update(dependencies.previewMembers(room, host.roleTeams));
  } else {
    host.previews?.dispose();
    host.previews = undefined;
    if (host.animation !== undefined) dependencies.cancelFrame(host.animation);
    host.animation = undefined;
  }
  if (host.roomCanAnimate()) {
    if (host.animation === undefined) host.animate();
  } else {
    if (host.animation !== undefined) dependencies.cancelFrame(host.animation);
    host.animation = undefined;
  }
  host.view.render();
  void host.loadTrack();
}

export function disposeLobbyRoom(host: LobbyRoomLifecycleHost,
  dependencies: LobbyRoomLifecycleDependencies): void {
  host.disposed = true;
  host.visible = false;
  ++host.trackLoad;
  host.trackImage = undefined;
  host.trackReverseStamp = undefined;
  if (host.animation !== undefined) dependencies.cancelFrame(host.animation);
  host.animation = undefined;
  host.previews?.dispose();
  host.countdown?.dispose();
  host.trackChangeNotice?.dispose();
  host.removeRoomKeyboard();
  host.view.element.removeEventListener("keydown", host.onEmotionKey, true);
  host.view.dispose();
}

export function installLobbyRoomKeyboard(host: LobbyRoomLifecycleHost,
  dependencies: LobbyRoomLifecycleDependencies): void {
  dependencies.keyboard.addEventListener("keydown", host.onRoomKey, true);
}

export function removeLobbyRoomKeyboard(host: LobbyRoomLifecycleHost,
  dependencies: LobbyRoomLifecycleDependencies): void {
  dependencies.keyboard.removeEventListener("keydown", host.onRoomKey, true);
}

export function toggleLobbyEmotionWheel(host: LobbyRoomLifecycleHost): void {
  if (host.busy || !host.connected || host.room.phase !== "open") return;
  host.emotionWheelOpen = !host.emotionWheelOpen;
  host.view.render();
}

export function closeLobbyEmotionWheel(host: LobbyRoomLifecycleHost): void {
  if (host.emotionWheelOpen) {
    host.emotionWheelOpen = false;
    host.view.render();
  }
}
