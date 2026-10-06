/** Countdown, animation scheduling, and chat controls for the room view. */

export interface LobbyRoomTimingHost {
  room: {
    phase: string;
    autoStartAt?: number;
    hostId?: unknown;
  };
  playerId: unknown;
  startPresentation: boolean;
  animation?: number;
  visible: boolean;
  disposed: boolean;
  connected: boolean;
  busy: boolean;
  chatSending: boolean;
  chatDraft: string;
  autoStartAt?: number;
  autoStartLocalAt?: number;
  lastCountdownNumber: number;
  lastManualStartAllowed: boolean;
  lastCountdownLocked: boolean;
  previews?: { dispose(): void };
  countdown?: { reset(): void; playTick(): void };
  trackChangeNotice?: { tick(): void; hide(): void };
  view: { render(): void; repaint(): void };
  actions: {
    captureClock?(): unknown;
    canStart?(): boolean;
    onCountdownLocked?(): void;
    onError?(error: unknown): void;
    chat?(message: string): Promise<unknown>;
  };
  roomCanAnimate(): boolean;
  animate(): void;
  countdownState(): LobbyCountdownState;
  readonly countdownLocked: boolean;
}

export interface LobbyCountdownState {
  active: boolean;
  elapsed: number;
  remaining: number;
  cancelLocked: boolean;
}

export interface LobbyTimingDependencies {
  nowMs(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(frameId: number): void;
  toLocalStartAt(serverStartAt: number, clock: unknown): number;
}

export function setLobbyStartPresentation(host: LobbyRoomTimingHost,
  enabled: boolean, dependencies: LobbyTimingDependencies): void {
  host.startPresentation = enabled;
  if (host.roomCanAnimate()) {
    host.animate();
  } else {
    if (host.animation !== undefined) dependencies.cancelFrame(host.animation);
    host.animation = undefined;
  }
}

export function canAnimateLobbyRoom(host: LobbyRoomTimingHost): boolean {
  return host.room.phase === "open" ||
    (host.startPresentation &&
      (host.room.phase === "loading" || host.room.phase === "countdown"));
}

export function updateLobbyCountdown(host: LobbyRoomTimingHost,
  room: LobbyRoomTimingHost["room"], dependencies: LobbyTimingDependencies): void {
  if (room.autoStartAt === host.autoStartAt) return;
  host.autoStartAt = room.autoStartAt;
  const clock = host.actions.captureClock?.();
  host.autoStartLocalAt = room.autoStartAt === undefined
    ? undefined
    : clock
      ? dependencies.toLocalStartAt(room.autoStartAt, clock)
      : dependencies.nowMs() + 9001;
  host.lastCountdownNumber = 10;
  host.countdown?.reset();
}

export function lobbyCountdownState(host: LobbyRoomTimingHost,
  dependencies: LobbyTimingDependencies): LobbyCountdownState {
  const active = host.room.phase === "open" && host.autoStartLocalAt !== undefined;
  const elapsed = active
    ? Math.max(0, dependencies.nowMs() - (host.autoStartLocalAt! - 9001))
    : 0;
  return {
    active,
    elapsed,
    remaining: Math.max(0, Math.ceil((9001 - elapsed) / 1000)),
    cancelLocked: elapsed >= 6000,
  };
}

export function isLobbyCountdownLocked(host: LobbyRoomTimingHost): boolean {
  const countdown = host.countdownState();
  return countdown.active && countdown.cancelLocked;
}

/** One scheduled frame at a time; each frame checks the latest room state. */
export function animateLobbyRoom(host: LobbyRoomTimingHost,
  dependencies: LobbyTimingDependencies): void {
  if (host.animation !== undefined || !host.visible || host.disposed ||
    !host.connected || !host.previews || !host.roomCanAnimate()) return;
  const frameId = dependencies.requestFrame(() => {
    if (host.animation !== frameId || (
      host.animation = undefined,
      !host.visible || host.disposed || !host.connected ||
        !host.previews || !host.roomCanAnimate()
    )) return;

    const { active, elapsed } = host.countdownState();
    host.trackChangeNotice?.tick();
    if (active) {
      const nextNumber = Math.max(0, 9 - Math.floor(elapsed / 1000));
      if (nextNumber < host.lastCountdownNumber && nextNumber <= 5 && nextNumber > 0) {
        host.countdown?.playTick();
      }
      host.lastCountdownNumber = nextNumber;
    }

    try {
      const manualStartAllowed = host.actions.canStart?.() !== false;
      const countdownLocked = host.countdownLocked;
      if (countdownLocked && host.room.hostId === host.playerId) {
        host.actions.onCountdownLocked?.();
      }
      if (manualStartAllowed !== host.lastManualStartAllowed ||
        countdownLocked !== host.lastCountdownLocked) {
        host.lastManualStartAllowed = manualStartAllowed;
        host.lastCountdownLocked = countdownLocked;
        host.view.render();
      } else {
        host.view.repaint();
      }
    } catch (error) {
      host.trackChangeNotice?.hide();
      host.previews?.dispose();
      host.previews = undefined;
      host.actions.onError?.(error);
    }
    host.animate();
  });
  host.animation = frameId;
}

export async function sendLobbyEmotion(host: LobbyRoomTimingHost,
  emotion: { marker: string }): Promise<void> {
  if (host.busy || !host.connected || host.room.phase !== "open" ||
    host.chatSending || !host.actions.chat) return;
  host.chatSending = true;
  host.view.render();
  try {
    await host.actions.chat(emotion.marker);
  } finally {
    host.chatSending = false;
    if (!host.disposed) host.view.render();
  }
}

export async function sendLobbyChat(host: LobbyRoomTimingHost): Promise<void> {
  const message = host.chatDraft.trim();
  if (!message || !host.connected || host.busy || host.chatSending ||
    !host.actions.chat) return;
  host.chatSending = true;
  host.view.render();
  try {
    if (await host.actions.chat(message)) host.chatDraft = "";
  } finally {
    host.chatSending = false;
    if (!host.disposed) host.view.render();
  }
}
