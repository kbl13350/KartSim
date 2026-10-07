/** Draw the original multiplayer lobby's declarative BML tree. */
export interface LobbyLayoutNode {
  name: string;
  children: LobbyLayoutNode[];
}

export interface LobbyRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LobbyRoomSummary {
  locked?: boolean;
  gaming?: boolean;
  count: number;
  capacity: number;
  randomTrackCode?: number;
  trackId?: string;
}

export interface LobbyTexture {
  image: CanvasImageSource;
  width: number;
  height: number;
}

export interface LobbyDrawHost {
  mode?: string;
  page: number;
  total: number;
  rooms: LobbyRoomSummary[];
  enabled: boolean;
  hovered?: string;
  pressed?: string;
  gameplay: string;
  context: CanvasRenderingContext2D;
  hits: Array<{ name: string; rect: LobbyRect }>;
  assets: {
    textures: Map<LobbyLayoutNode, LobbyTexture[]>;
    trackTitles: Map<string, string>;
    strings: Map<string, string>;
  };
  draw(node: LobbyLayoutNode, parent: LobbyRect, room?: LobbyRoomSummary,
    titleRight?: number): void;
}

export interface LobbyDrawDependencies {
  attribute(node: LobbyLayoutNode, name: string): string | undefined;
  rectangle(node: LobbyLayoutNode, parent: LobbyRect, frame?: unknown,
    texture?: LobbyTexture): LobbyRect;
  modeForButton(name: string): { gameplay?: string } | undefined;
  interactiveNames: ReadonlySet<string>;
  imageState(name: string, hovered?: string, pressed?: string): number;
  drawTexture(context: CanvasRenderingContext2D, texture: LobbyTexture,
    rectangle: LobbyRect): void;
  fitRoomTitle(room: LobbyRoomSummary, width: number,
    measure: (value: string) => number): string;
  measure(context: CanvasRenderingContext2D, value: string,
    font: { family: string; size: number }): { width: number };
  drawText(context: CanvasRenderingContext2D, value: string, rectangle: LobbyRect,
    style: { family: string; size: number; kind: "label"; color: string;
      align: "center" | "left"; verticalAlign: "center" | "top" }): void;
  randomTrack(code: number): { title: string } | undefined;
  fontFamily: string;
  /**
   * Web addition: tag each listed room 准备中 or 游戏中 beside its title, and let
   * players join a racing room that has space (they wait for the next race).
   * The release greys racing rooms out instead; it has no room-state art.
   */
  showRoomStatus?: boolean;
}

const ROOM_STATUS_SIZE = 14;

/** Status tag text and colour for a listed room. */
export function lobbyRoomStatus(room: LobbyRoomSummary): { text: string; fill: string } {
  return room.gaming
    ? { text: "游戏中", fill: "#d9534f" }
    : { text: "准备中", fill: "#2e9d5b" };
}

export function drawLobbyListNode(
  host: LobbyDrawHost,
  node: LobbyLayoutNode,
  parent: LobbyRect,
  room: LobbyRoomSummary | undefined,
  titleRight: number | undefined,
  dependencies: LobbyDrawDependencies,
): void {
  const { attribute, rectangle, modeForButton } = dependencies;
  const name = attribute(node, "name") ?? "";
  if ((name === "rightMenu" && !host.mode) ||
      (name !== "multiplay_pop" && name !== "rightMenu" &&
       name !== "roomLeft" && name !== "roomRight" &&
       attribute(node, "visible") === "false") ||
      (name === "roomLeft" && host.page === 0) ||
      (name === "roomRight" && (host.page + 1) * 10 >= host.total)) return;

  const roomMatch = /^room(\d)$/.exec(name);
  if (roomMatch) room = host.rooms[Number(roomMatch[1])];
  if ((roomMatch && !room) || (name === "lock" && !room?.locked)) return;

  const textures = host.assets.textures.get(node);
  const bounds = rectangle(node, parent, undefined, textures?.[0]);
  const mode = modeForButton(name);
  const hasStates = !!mode || !!(attribute(node, "autoLoadImage") ||
    attribute(node, "autoLoadImageBoard"));
  const interactive = host.enabled &&
    (dependencies.interactiveNames.has(name) || name === "createRoom" ||
     name === "quickJoin" ||
     (!!roomMatch && !!room && (!room.gaming || !!dependencies.showRoomStatus) &&
       room.count < room.capacity));

  if (textures) {
    host.context.save();
    if (mode && mode.gameplay !== "rp") {
      host.context.filter = interactive
        ? host.pressed === name ? "brightness(.85)"
          : host.hovered === name ? "brightness(1.15)" : "none"
        : "grayscale(1) brightness(.7)";
    }
    const texture = textures[hasStates
      ? (interactive ? dependencies.imageState(name, host.hovered, host.pressed) : 3)
      : 0]!;
    if (mode?.gameplay === "giant") {
      const scale = Math.min(bounds.width / texture.width,
        bounds.height / texture.height);
      const width = texture.width * scale;
      const height = texture.height * scale;
      host.context.drawImage(texture.image,
        bounds.x + (bounds.width - width) / 2,
        bounds.y + (bounds.height - height) / 2, width, height);
    } else if (mode) {
      host.context.drawImage(texture.image, bounds.x, bounds.y,
        bounds.width, bounds.height);
    } else if (hasStates && node.name !== "ImageBoardButton") {
      dependencies.drawTexture(host.context, texture, bounds);
    } else {
      host.context.drawImage(texture.image, bounds.x, bounds.y,
        bounds.width, bounds.height);
    }
    host.context.restore();
    if (mode?.gameplay === "lte") {
      host.context.save();
      host.context.fillStyle = "rgba(8, 23, 46, 0.96)";
      host.context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      host.context.fillStyle = "#fff4b3";
      host.context.font = `bold 28px ${dependencies.fontFamily}`;
      host.context.textAlign = "center";
      host.context.textBaseline = "middle";
      host.context.fillText("LTE Web试玩", bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2 - 10);
      host.context.fillStyle = "#ffffff";
      host.context.font = `18px ${dependencies.fontFamily}`;
      host.context.fillText("三图随机 · Z/X 躲闪",
        bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 + 27);
      host.context.restore();
    }
    if (mode && "gameplay" in mode && host.mode &&
        mode.gameplay === host.gameplay) {
      host.context.save();
      host.context.strokeStyle = "#ffe66b";
      host.context.lineWidth = 3;
      host.context.strokeRect(bounds.x + 1.5, bounds.y + 1.5,
        bounds.width - 3, bounds.height - 3);
      host.context.restore();
    }
  }
  if (interactive) host.hits.push({ name, rect: bounds });

  let text = attribute(node, "text");
  let textBounds = bounds;
  if (name === "roomTitle") {
    let titleWidth = titleRight === undefined
      ? bounds.width : Math.max(0, titleRight - bounds.x - 8);
    if (room && dependencies.showRoomStatus) {
      // The tag takes the right end of the title column, just before the track name.
      const status = lobbyRoomStatus(room);
      const tagWidth = dependencies.measure(host.context, status.text,
        { family: dependencies.fontFamily, size: ROOM_STATUS_SIZE }).width + 14;
      const tagHeight = Math.min(bounds.height, ROOM_STATUS_SIZE + 8);
      const tag = { x: bounds.x + Math.max(0, titleWidth - tagWidth), width: tagWidth,
        y: bounds.y + (bounds.height - tagHeight) / 2, height: tagHeight };
      host.context.save();
      host.context.fillStyle = status.fill;
      host.context.fillRect(tag.x, tag.y, tag.width, tag.height);
      host.context.restore();
      dependencies.drawText(host.context, status.text, tag, {
        family: dependencies.fontFamily, size: ROOM_STATUS_SIZE, kind: "label",
        color: "#ffffff", align: "center", verticalAlign: "center",
      });
      titleWidth = Math.max(0, titleWidth - tagWidth - 6);
      textBounds = { ...bounds, width: titleWidth };
    }
    text = room ? dependencies.fitRoomTitle(room, titleWidth,
      value => dependencies.measure(host.context, value, {
        family: dependencies.fontFamily,
        size: Number(/\d+/.exec(attribute(node, "textRender") ?? "")?.[0] ?? 16),
      }).width) : undefined;
  }
  if (name === "trackName") {
    text = room?.randomTrackCode !== undefined
      ? (dependencies.randomTrack(room.randomTrackCode)?.title ?? "随机赛道资源不可用")
      : room?.trackId
        ? (host.assets.trackTitles.get(room.trackId) ?? "赛道资源不可用")
        : "未选择赛道";
  }
  if (name === "userCnt")
    text = room ? `${room.count}/${room.capacity}` : undefined;
  if (text) {
    const stringBagReference = /^#sb\(([^)]+)\)$/.exec(text);
    if (stringBagReference) text = host.assets.strings.get(stringBagReference[1]!);
    if (text) {
      const alignment = attribute(node, "textAlign") ?? "";
      const color = attribute(node, "textColor") ?? "white";
      const channels = color.split(/\s+/).map(Number);
      dependencies.drawText(host.context, text, textBounds, {
        family: dependencies.fontFamily,
        size: Number(/\d+/.exec(attribute(node, "textRender") ?? "")?.[0] ?? 16),
        kind: "label",
        color: channels.length === 4
          ? `rgba(${channels[1]},${channels[2]},${channels[3]},${channels[0]! / 255})`
          : color,
        align: alignment.includes("hcenter") || alignment === "center" ? "center" : "left",
        verticalAlign: alignment.includes("vcenter") || alignment === "center"
          ? "center" : "top",
      });
    }
  }

  const titleNode = node.children.find(child => attribute(child, "name") === "trackName");
  const childTitleRight = titleNode ? rectangle(titleNode, bounds).x : undefined;
  for (const child of node.children) host.draw(child, bounds, room, childTitleRight);
}
