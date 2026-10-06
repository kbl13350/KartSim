/** Creates the room view and binds its keyboard shortcuts and live resources. */

interface RoomChat { sequence: number }
interface RoomSnapshot { phase: string; chat?: RoomChat[] }
interface RoomEmotion { marker: string }

export interface ConstructedLobbyRoom {
  playerId: unknown;
  actions: unknown;
  library: unknown;
  room: RoomSnapshot;
  lastChatSequence: number;
  roleTeams: unknown[];
  emotions: RoomEmotion[];
  countdown: { dispose(): void; reset(): void };
  view: {
    element: { contains(target: unknown): boolean;
      addEventListener(type: string, listener: unknown, capture: boolean): void;
      hidden: boolean };
    comboOpen?: boolean;
    dispose(): void;
    focus(name: string): void;
    render(): void;
  };
  trackChangeNotice: { dispose(): void };
  previews: unknown;
  busy: boolean;
  connected: boolean;
  disposed: boolean;
  emotionWheelOpen: boolean;
  onEmotionKey: (event: RoomKeyboardEvent) => void;
  onRoomKey: (event: RoomKeyboardEvent) => void;
  installRoomKeyboard(): void;
  updateCountdown(room: RoomSnapshot): void;
  toggleEmotionWheel(): void;
  sendEmotion(emotion: RoomEmotion): void;
}

interface RoomKeyboardEvent {
  target?: { matches?(selector: string): boolean } | null;
  key?: string;
  code: string;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

export interface LobbyRoomConstructionDependencies {
  mode(room: RoomSnapshot): string;
  loadRoleTeams(library: unknown): Promise<unknown[]>;
  loadEmotions(library: unknown): Promise<RoomEmotion[]>;
  loadCountdown(library: unknown): Promise<ConstructedLobbyRoom["countdown"]>;
  loadDefinition(library: unknown, roadblock: boolean): Promise<unknown>;
  withEmotions(definition: unknown, emotions: RoomEmotion[]): unknown;
  loadView(options: Record<string, unknown>): Promise<ConstructedLobbyRoom["view"]>;
  loadTrackChangeNotice(library: unknown, root: unknown, room: RoomSnapshot,
    playerId: unknown): Promise<ConstructedLobbyRoom["trackChangeNotice"]>;
  createPreviews(library: unknown, render: () => void,
    onError: (error: unknown) => void, emotions: RoomEmotion[],
    audioContext: unknown): unknown;
}

export function initializeLobbyRoom(host: ConstructedLobbyRoom,
  room: RoomSnapshot, playerId: unknown, actions: unknown,
  library: unknown): void {
  host.playerId = playerId;
  host.actions = actions;
  host.library = library;
  host.room = room;
  host.lastChatSequence = room.chat?.at(-1)?.sequence ?? 0;
}

export async function loadLobbyRoom<T extends ConstructedLobbyRoom>(
  create: (room: RoomSnapshot, playerId: unknown, actions: unknown,
    library: unknown) => T,
  library: unknown, root: unknown, room: RoomSnapshot, playerId: unknown,
  actions: { onActivate?: unknown; onHover?: unknown;
    onError?(error: unknown): void }, audioContext: unknown,
  dependencies: LobbyRoomConstructionDependencies): Promise<T> {
  const host = create(room, playerId, actions, library);
  if (dependencies.mode(room) === "roadblock") {
    host.roleTeams = await dependencies.loadRoleTeams(library);
  }
  host.emotions = await dependencies.loadEmotions(library);
  host.countdown = await dependencies.loadCountdown(library);

  try {
    host.view = await dependencies.loadView({
      library, root, preserveDisplayPixels: true, smoothImages: true,
      definition: dependencies.withEmotions(await dependencies.loadDefinition(
        library, dependencies.mode(room) === "roadblock"), host.emotions),
      roots: ["stage_/mqReady", "stage_/common", "stage_/gameReady",
        "gui_/windowTemplate"],
      label: "多人游戏房间",
      state: (node: unknown) => (host as T & { state(node: unknown): unknown }).state(node),
      onActivate: actions.onActivate, onHover: actions.onHover,
    });
  } catch (error) {
    host.countdown.dispose();
    throw error;
  }

  try {
    host.trackChangeNotice = await dependencies.loadTrackChangeNotice(
      library, root, room, playerId);
  } catch (error) {
    host.view.dispose();
    host.countdown.dispose();
    throw error;
  }

  host.previews = dependencies.createPreviews(library, () => host.view.render(),
    error => actions.onError?.(error), host.emotions, audioContext);
  host.view.element.addEventListener("keydown", host.onEmotionKey, true);
  host.installRoomKeyboard();
  host.updateCountdown(room);
  return host;
}

const editableSelector = "input, textarea, [contenteditable], [contenteditable] *";

/** Room-local Backquote and digit keys control the original emotion wheel. */
export function handleLobbyEmotionKey(host: ConstructedLobbyRoom,
  event: RoomKeyboardEvent): void {
  if (!host.view?.element.contains(event.target) || !host.connected ||
    host.busy || host.room.phase !== "open" || event.altKey || event.metaKey ||
    event.repeat) return;
  const editing = event.target?.matches?.(editableSelector) ?? false;
  if (!event.ctrlKey && !editing && event.code === "Backquote") {
    event.preventDefault();
    event.stopPropagation();
    host.toggleEmotionWheel();
    return;
  }
  if (!event.ctrlKey && host.emotionWheelOpen && event.code === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    host.toggleEmotionWheel();
    return;
  }
  if (!event.ctrlKey && (editing || !host.emotionWheelOpen)) return;
  const digit = Number(event.code.slice(5));
  if (!event.code.startsWith("Digit") || digit < 1 || digit > 9) return;
  event.preventDefault();
  event.stopPropagation();
  if (digit === 9) {
    host.toggleEmotionWheel();
    return;
  }
  const emotion = host.emotions[digit - 1];
  if (emotion) host.sendEmotion(emotion);
}

/** Enter focuses room chat only while the room can accept commands. */
export function handleLobbyRoomKey(host: ConstructedLobbyRoom,
  event: RoomKeyboardEvent, documentBody: unknown): void {
  if (event.key !== "Enter" || event.isComposing || host.disposed ||
    host.view?.element.hidden ||
    (!host.view?.element.contains(event.target) && event.target !== documentBody) ||
    !host.connected || host.busy || host.room.phase !== "open" ||
    host.view.comboOpen || event.target?.matches?.(editableSelector)) return;
  event.preventDefault();
  event.stopPropagation();
  host.view.focus("채팅");
}
