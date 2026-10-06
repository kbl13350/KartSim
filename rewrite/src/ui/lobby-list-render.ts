import type { LobbyDrawHost, LobbyLayoutNode, LobbyRect,
  LobbyRoomSummary } from "./lobby-list-draw";

export interface LobbyListRenderHost extends LobbyDrawHost {
  disposed: boolean;
  canvas: HTMLCanvasElement;
  buttons: {
    update(buttons: Array<{
      key: string; rect: LobbyRect; label: string;
      hover(): void; activate(): void;
    }>): void;
  };
  options: { root: HTMLElement; onHover?(): void };
  assets: LobbyDrawHost["assets"] & { definition: LobbyLayoutNode };
  activate(name: string): void;
}

export interface LobbyListRenderDependencies {
  viewport(width: number, height: number, pixelRatio: number,
    targetWidth: number, targetHeight: number): {
      width: number; height: number; scaleX: number; scaleY: number;
    };
  modeForButton(name: string): { label?: string } | undefined;
  roomLabel(room: LobbyRoomSummary): string;
}

/** Layout the full-screen lobby and publish the hit targets as real buttons. */
export function renderLobbyList(
  host: LobbyListRenderHost,
  dependencies: LobbyListRenderDependencies,
): void {
  if (host.disposed) return;
  const bounds = host.options.root.getBoundingClientRect();
  const viewport = dependencies.viewport(bounds.width, bounds.height,
    window.devicePixelRatio, 1600, 900);
  host.canvas.width = viewport.width;
  host.canvas.height = viewport.height;
  host.context.setTransform(viewport.scaleX, 0, 0, viewport.scaleY, 0, 0);
  host.context.imageSmoothingEnabled = true;
  host.hits = [];
  host.draw(host.assets.definition, { x: 0, y: 0, width: 1600, height: 900 });

  const staticLabels: Record<string, string> = {
    ordinaryRace: "普通竞速",
    roomLeft: "上一页",
    roomRight: "下一页",
    createRoom: "创建房间",
    quickJoin: "快速加入",
  };
  host.buttons.update(host.hits.map(hit => {
    const match = /^room(\d)$/.exec(hit.name);
    const room = match ? host.rooms[Number(match[1])] : undefined;
    return {
      key: hit.name,
      rect: hit.rect,
      label: room
        ? `加入 ${dependencies.roomLabel(room)}${room.gaming ? "（游戏中）" : ""}`
        : (dependencies.modeForButton(hit.name)?.label ??
          staticLabels[hit.name] ?? hit.name),
      hover: () => host.options.onHover?.(),
      activate: () => host.activate(hit.name),
    };
  }));
  host.canvas.style.cursor = host.hovered ? "pointer" : "default";
}
