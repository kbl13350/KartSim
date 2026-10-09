import type { LobbyRoomSummary } from "./lobby-list-draw";
import {
  createLobbyListUiState, lobbyCategory, lobbyTab, lobbyTabAvailable, requestLobbyList,
  type LobbyFilterKey, type LobbyListUiState,
} from "./lobby-list-layout";

export interface LobbyListActionHost {
  hits: Array<{ name: string }>;
  rooms: LobbyRoomSummary[];
  channelName?: string;
  page: number;
  gameplay: string;
  enabled?: boolean;
  lobbyUi?: LobbyListUiState;
  render?(): void;
  options: {
    version?: string;
    onActivate?(): void;
    onMode(channel: string, page: number, gameplay: string): void;
    onCreate?(): void;
    onQuickJoin?(): void;
    onJoin?(room: LobbyRoomSummary): void;
    onUnavailable?(title: string, message: string): void;
  };
}

/** Dispatch one activated lobby control by its hit name. */
export function activateLobbyListEntry(
  host: LobbyListActionHost,
  name: string,
  modeForButton: (name: string) => { gameplay: string } | undefined,
  isChannel: (name: string) => boolean,
): void {
  if (!host.hits.some(hit => hit.name === name)) return;
  host.options.onActivate?.();
  const state = host.lobbyUi ??= createLobbyListUiState();

  if (name.startsWith("tab:")) {
    const tab = lobbyTab(name.slice(4));
    if (!tab) return;
    if (!lobbyTabAvailable(tab, host.options.version)) {
      host.options.onUnavailable?.(tab.title, tab.unavailable ??
        `${tab.title}需要 P3553 资源版本。`);
      return;
    }
    if (tab.id === state.tab) return;
    const category = tab.categories[0]!;
    state.tab = tab.id;
    state.category = category.id;
    host.render?.();
    if (host.enabled !== false) requestLobbyList(state, () =>
      host.options.onMode(category.channel, 0, category.gameplay));
    return;
  }
  if (name.startsWith("cat:")) {
    const found = lobbyCategory(name.slice(4));
    if (!found) return;
    state.tab = found.tab.id;
    state.category = found.category.id;
    host.render?.();
    // A category of the same list keeps its page; the room list is per gameplay.
    const sameList = found.category.gameplay === host.gameplay &&
      host.channelName !== undefined && found.category.channels.includes(host.channelName);
    requestLobbyList(state, () =>
      host.options.onMode(sameList ? host.channelName! : found.category.channel,
        sameList ? host.page : 0, found.category.gameplay));
    return;
  }
  if (name.startsWith("filter:")) {
    const key = name.slice(7) as LobbyFilterKey;
    if (key in state.filters) {
      state.filters[key] = !state.filters[key];
      host.render?.();
    }
    return;
  }

  const choice = modeForButton(name);
  if (choice) {
    const channel = choice.gameplay === "roadblock" || choice.gameplay === "giant"
      ? "speedIndiCombine"
      : choice.gameplay !== "grip" || host.channelName === "speedTeamCombine"
        ? (host.channelName ?? "speedIndiCombine")
        : "speedIndiCombine";
    host.options.onMode(channel, 0, choice.gameplay);
    return;
  }
  if (name === "createRoom") { host.options.onCreate?.(); return; }
  if (name === "quickJoin") { host.options.onQuickJoin?.(); return; }

  const roomMatch = /^room(\d)$/.exec(name);
  if (roomMatch) {
    const room = host.rooms[Number(roomMatch[1])];
    if (room) host.options.onJoin?.(room);
    return;
  }

  const channel = isChannel(name) ? name : host.channelName;
  if (channel) {
    requestLobbyList(state, () => host.options.onMode(channel,
      name === "roomLeft" ? host.page - 1 :
        name === "roomRight" ? host.page + 1 : 0,
      host.gameplay));
  }
}
