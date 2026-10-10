import type { RoomSnapshot } from "./protocol";

export interface RoomChatMessage {
  sequence: number;
  playerId: string;
  name: string;
  text: string;
}

export interface ActiveRoom extends RoomSnapshot {
  chat?: RoomChatMessage[];
}

export type RoomStateEvent =
  | { type: "room"; room: ActiveRoom }
  | { type: "left"; roomId: string }
  | { type: "chat"; roomId: string; message: RoomChatMessage }
  | { type: string; [key: string]: unknown };

/** Keep one authoritative room snapshot and ignore stale or departed updates. */
export class RoomState {
  room?: ActiveRoom;
  departed = new Set<string>();

  apply(event: RoomStateEvent, playerId: string): boolean {
    if (event.type === "left") {
      const roomId = event.roomId as string;
      this.departed.add(roomId);
      if (this.room?.roomId !== roomId) return false;
      this.room = undefined;
      return true;
    }

    if (event.type !== "room") return false;
    const incoming = event.room as ActiveRoom;
    if (!incoming.members.some(member => member.playerId === playerId) ||
        this.departed.has(incoming.roomId) ||
        (this.room && (this.room.roomId !== incoming.roomId ||
          incoming.revision <= this.room.revision))) return false;
    this.room = incoming;
    return true;
  }

  allowJoin(roomId: string): void {
    this.departed.delete(roomId);
  }

  appendChat(event: { roomId: string; message: RoomChatMessage }): boolean {
    const current = this.room;
    if (!current || current.roomId !== event.roomId ||
        (current.chat?.at(-1)?.sequence ?? 0) >= event.message.sequence) return false;
    this.room = { ...current,
      chat: [...(current.chat ?? []), event.message].slice(-32) };
    return true;
  }
}
