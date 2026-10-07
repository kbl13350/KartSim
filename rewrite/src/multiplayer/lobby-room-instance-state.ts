/** Per-room view state created before room resources are loaded. */

export interface LobbyRoomKeyHandlers {
  emotion(host: Record<string, unknown>, event: unknown): void;
  room(host: Record<string, unknown>, event: unknown): void;
}

export function initializeLobbyRoomInstanceState(host: Record<string, unknown>,
  handlers: LobbyRoomKeyHandlers): void {
  host.playerId = undefined;
  host.actions = undefined;
  host.library = undefined;
  host.room = undefined;
  host.busy = false;
  host.connected = true;
  host.view = undefined;
  host.chatDraft = "";
  host.chatSending = false;
  host.lastChatSequence = undefined;
  host.bubbles = new Map();
  host.trackTitle = "尚未选择赛道";
  host.trackImage = undefined;
  host.trackReverseStamp = undefined;
  host.trackIcon = undefined;
  host.trackDifficulty = undefined;
  host.trackIdentity = undefined;
  host.trackLoad = 0;
  host.disposed = false;
  host.visible = false;
  host.previews = undefined;
  host.roleTeams = [];
  host.animation = undefined;
  host.startPresentation = false;
  host.emotions = [];
  host.emotionWheelOpen = false;
  host.countdown = undefined;
  host.autoStartAt = undefined;
  host.autoStartLocalAt = undefined;
  host.lastCountdownNumber = 10;
  host.lastManualStartAllowed = true;
  host.lastCountdownLocked = false;
  host.trackChangeNotice = undefined;
  host.onEmotionKey = (event: unknown) => handlers.emotion(host, event);
  host.onRoomKey = (event: unknown) => handlers.room(host, event);
}
