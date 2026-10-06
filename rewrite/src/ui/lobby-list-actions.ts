import type { LobbyRoomSummary } from "./lobby-list-draw";

export interface LobbyListActionHost {
  hits: Array<{ name: string }>;
  rooms: LobbyRoomSummary[];
  channelName?: string;
  page: number;
  gameplay: string;
  options: {
    onActivate?(): void;
    onMode(channel: string, page: number, gameplay: string): void;
    onCreate?(): void;
    onQuickJoin?(): void;
    onJoin?(room: LobbyRoomSummary): void;
  };
}

/** Dispatch one activated lobby control from its BML name. */
export function activateLobbyListEntry(
  host: LobbyListActionHost,
  name: string,
  modeForButton: (name: string) => { gameplay: string } | undefined,
  isChannel: (name: string) => boolean,
): void {
  if (!host.hits.some(hit => hit.name === name)) return;
  host.options.onActivate?.();

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
    host.options.onMode(channel,
      name === "roomLeft" ? host.page - 1 :
        name === "roomRight" ? host.page + 1 : 0,
      host.gameplay);
  }
}
