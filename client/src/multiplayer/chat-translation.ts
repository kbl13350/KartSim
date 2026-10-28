/** Recipient-side room translations. Originals and the network protocol stay intact. */
import { gameLocale, type GameLocale } from "../i18n/locale";
import { tokenAccess } from "../account/account-token-store";

export type TranslateMessage = (text: string, target: GameLocale) => Promise<string | undefined>;
let disabledUntil = 0;
export const requestChatTranslation: TranslateMessage = async (text, target) => {
  if (Date.now() < disabledUntil || typeof location === "undefined") return undefined;
  const origin = window.__KART_MULTIPLAYER_CONFIG__?.backendOrigin ?? location.origin;
  const token = tokenAccess().load(origin);
  if (!token) return undefined;
  const response = await fetch(`${origin}/api/chat/translate`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text, target }), signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return undefined;
  const result = await response.json();
  if (result.enabled === false) disabledUntil = Date.now() + 30000;
  return result.enabled === true && result.target === target && typeof result.text === "string"
    && result.text.length <= 2400 ? result.text : undefined;
};

interface Translation { text?: string; pending: boolean; retryAt: number }
export class RoomChatTranslations {
  private entries = new Map<string, Translation>();
  private active = 0;
  private queue: (() => Promise<void>)[] = [];
  private pump(): void {
    while (this.active < 3 && this.queue.length) {
      const work = this.queue.shift()!;
      this.active++;
      void work().finally(() => { this.active--; this.pump(); });
    }
  }
  constructor(private request: TranslateMessage = requestChatTranslation,
    private now: () => number = Date.now) {}
  get(text: string, target: GameLocale): string | undefined {
    return this.entries.get(`${target}\0${text}`)?.text;
  }
  sync(texts: string[], target: GameLocale, changed: () => void): void {
    const keys = new Set(texts.map(text => `${target}\0${text}`));
    for (const key of this.entries.keys()) if (!keys.has(key)) this.entries.delete(key);
    for (const text of new Set(texts)) {
      if (!text.trim() || [...text].length > 120) continue;
      const key = `${target}\0${text}`;
      const previous = this.entries.get(key);
      if (previous && (previous.pending || previous.text !== undefined || previous.retryAt > this.now())) continue;
      const entry: Translation = { pending: true, retryAt: 0 };
      this.entries.set(key, entry);
      this.queue.push(async () => {
        if (this.entries.get(key) !== entry) return;
        const result = await this.request(text, target).catch(() => undefined);
        if (this.entries.get(key) !== entry) return;
        entry.pending = false;
        entry.retryAt = this.now() + 30000;
        entry.text = result;
        if (result !== undefined && result !== text) changed();
      });
    }
    this.pump();
  }
}

interface RoomTranslationHost {
  playerId: unknown;
  room: { id?: string; chat?: { playerId: unknown; text: string }[] };
  disposed?: boolean;
  visible?: boolean;
  connected?: boolean;
  view?: { render?(): void };
}
const sessions = new WeakMap<object, { roomId?: string; translations: RoomChatTranslations }>();
export function syncRoomChatTranslations(host: RoomTranslationHost, parse: (text: string) => string,
  request: TranslateMessage = requestChatTranslation): void {
  if (host.disposed || host.visible === false || host.connected === false) return;
  let session = sessions.get(host);
  if (!session || session.roomId !== host.room.id) {
    session = { roomId: host.room.id, translations: new RoomChatTranslations(request) };
    sessions.set(host, session);
  }
  const current = session;
  const target = gameLocale();
  const texts = (host.room.chat ?? []).filter(line => line.playerId !== host.playerId).map(line => parse(line.text)).filter(Boolean);
  session.translations.sync(texts, target, () => {
    if (!host.disposed && host.visible !== false && host.connected !== false &&
        sessions.get(host) === current && host.room.id === current.roomId && gameLocale() === target) host.view?.render?.();
  });
}
export function translatedRoomChat(host: object, text: string): string | undefined {
  const translated = sessions.get(host)?.translations.get(text, gameLocale());
  return translated && translated !== text ? translated : undefined;
}
