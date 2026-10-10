/**
 * The tray's messengerAlert (gui_window menu/tray@cn: a Label with the
 * AlertLabel frame and #sb(alert) "!", 20×21 at (11,-6) from
 * messengerButton): shown while a chat is unread or a friend request waits.
 */
import { currentMessenger, onMessengerChange } from "../messenger/messenger-runtime";
import { loadMessengerArt, type MessengerLibrary } from "./messenger-art";

export interface TrayAlert {
  active(): boolean;
  subscribe(listener: () => void): () => void;
  /** The painted badge, once its art has loaded. */
  badge(): CanvasImageSource | undefined;
}

/** The badge's rectangle relative to messengerButton. */
export const TRAY_ALERT_RECT = { x: 11, y: -6, width: 20, height: 21 } as const;

async function paintBadge(library: MessengerLibrary): Promise<HTMLCanvasElement | undefined> {
  const art = await loadMessengerArt(library);
  const url = art.frameUrl("AlertLabel", 0, TRAY_ALERT_RECT.width, TRAY_ALERT_RECT.height);
  if (!url) return undefined;
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = TRAY_ALERT_RECT.width;
  canvas.height = TRAY_ALERT_RECT.height;
  const context = canvas.getContext("2d")!;
  context.drawImage(image, 0, 0);
  context.fillStyle = "#fff";
  context.font = `bold 14px ${art.font ? `"${art.font}",` : ""}sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("!", canvas.width / 2, canvas.height / 2 + 1);
  return canvas;
}

export function messengerTrayAlert(library: MessengerLibrary): TrayAlert {
  const listeners = new Set<() => void>();
  let badge: HTMLCanvasElement | undefined;
  let last = false;
  let releaseStore: (() => void) | undefined;
  const active = () => currentMessenger()?.store.alert ?? false;
  const notify = (force = false) => {
    const now = active();
    if (!force && now === last) return;
    last = now;
    for (const listener of [...listeners]) listener();
  };
  const bind = () => {
    releaseStore?.();
    releaseStore = currentMessenger()?.store.subscribe(() => notify());
    notify(true);
  };
  onMessengerChange(bind);
  bind();
  void paintBadge(library).then(painted => {
    badge = painted;
    notify(true);
  }, () => undefined);
  return {
    active,
    badge: () => badge,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
