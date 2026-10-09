import type { LobbyDrawHost, LobbyLayoutNode, LobbyRect,
  LobbyRoomSummary } from "./lobby-list-draw";
import { coverCrop, mainMenuBackdrop } from "./main-menu-view";
import { lobbyHomeBackdrop } from "./lobby-home-backdrop";
import { X6 } from "../generated/library.js";
import { lobbyThemeIcons, type LobbyThemeIcons, type ThemeIconLibrary } from "./lobby-theme-icons";
import {
  LOBBY_FILTERS, LOBBY_LAYOUT, LOBBY_LOADING_MS, LOBBY_TABS, categoryForChannel,
  createLobbyListUiState, lobbyCategory, lobbyListLoading, lobbyRoomJoinable,
  lobbyRoomModeLabel, lobbyRowRect, lobbyRowsHeight,
  reconcileLobbyCategory, requestLobbyList, trackThemeName, visibleLobbyRooms,
  type LobbyListRoom, type LobbyListUiState, type LobbyTab,
} from "./lobby-list-layout";

/**
 * The multiplayer room list page: category tabs, a category column, the
 * filtered room table, 创建房间 and 快速开始, over the blurred lobby scene.
 */

type Texture = { image: CanvasImageSource; width: number; height: number };

export interface LobbyListRenderHost extends LobbyDrawHost {
  disposed: boolean;
  canvas: HTMLCanvasElement;
  element?: HTMLElement;
  channelName?: string;
  buttons: {
    update(buttons: Array<{
      key: string; rect: LobbyRect; label: string; disabled?: boolean;
      hover(): void; activate(): void;
    }>): void;
  };
  options: {
    root: HTMLElement;
    onHover?(): void;
    onMode?(channel: string, page: number, gameplay: string): void;
    version?: string;
    /** Channel and gameplay the lobby was opened for (a home quick entry). */
    lobbyChannel?: string;
    lobbyGameplay?: string;
    library?: ThemeIconLibrary;
  };
  assets: LobbyDrawHost["assets"] & { definition: LobbyLayoutNode };
  activate(name: string): void;
  /** View state kept on the release lobby object. */
  lobbyUi?: LobbyListUiState;
  lobbyUiBound?: boolean;
  lobbyLoadingTimer?: number;
  lobbyThemeIcons?: LobbyThemeIcons | null;
  setRooms?(...args: unknown[]): void;
  render?(): void;
  visibleRoomIndexes?(): number[];
}

export interface LobbyListRenderDependencies {
  viewport(width: number, height: number, pixelRatio: number,
    targetWidth: number, targetHeight: number): {
      width: number; height: number; scaleX: number; scaleY: number;
    };
  modeForButton(name: string): { label?: string } | undefined;
  roomLabel(room: LobbyRoomSummary): string;
  /** Title of a random track pool code. */
  randomTrack?(code: number): { title: string } | undefined;
}

/** The lobby font is the release Source Han Sans CN Bold face only. */
const BOLD_FONT = "\"KartSim Multiplayer Lobby\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif";
const PLAIN_FONT = "\"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", system-ui, sans-serif";
const WHEEL_PAGE_MS = 260;

export function lobbyListState(host: LobbyListRenderHost): LobbyListUiState {
  return host.lobbyUi ??= createLobbyListUiState();
}

function nodeName(node: LobbyLayoutNode): string | undefined {
  const attributes = (node as { attributes?: Array<{ name: string; value: string }> }).attributes;
  return attributes?.find(entry => entry.name === "name")?.value;
}

function findNode(node: LobbyLayoutNode, name: string): LobbyLayoutNode | undefined {
  if (nodeName(node) === name) return node;
  for (const child of node.children) {
    const found = findNode(child, name);
    if (found) return found;
  }
  return undefined;
}

function tabArt(host: LobbyListRenderHost, tab: LobbyTab): Texture | undefined {
  const node = findNode(host.assets.definition, tab.art);
  return node ? host.assets.textures.get(node)?.[0] : undefined;
}

/** Bold text uses the release face at its own weight, so it is not boldened twice. */
function font(size: number, weight = 700): string {
  return weight >= 600 ? `400 ${size}px ${BOLD_FONT}` : `${weight} ${size}px ${PLAIN_FONT}`;
}

function text(context: CanvasRenderingContext2D, value: string, x: number, y: number,
  size: number, color: string, options: { weight?: number; align?: CanvasTextAlign;
    maxWidth?: number; shadow?: boolean } = {}): number {
  context.save();
  context.font = font(size, options.weight ?? 700);
  context.textAlign = options.align ?? "left";
  context.textBaseline = "middle";
  context.fillStyle = color;
  if (options.shadow) {
    context.shadowColor = "rgba(0,12,40,.55)";
    context.shadowBlur = 4;
    context.shadowOffsetY = 1;
  }
  let shown = value;
  if (options.maxWidth !== undefined && context.measureText(shown).width > options.maxWidth) {
    const characters = Array.from(value);
    while (characters.length && context.measureText(`${characters.join("")}…`).width >
      options.maxWidth) characters.pop();
    shown = `${characters.join("")}…`;
  }
  context.fillText(shown, x, y);
  const width = context.measureText(shown).width;
  context.restore();
  return width;
}

function roundRect(context: CanvasRenderingContext2D, rect: LobbyRect, radius: number): void {
  context.beginPath();
  context.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
}

const blurredBackdrops = new WeakMap<object, HTMLCanvasElement>();

/** A small pre-blurred copy, so hover redraws do not blur the full stage each time. */
function blurredBackdrop(source: Texture): HTMLCanvasElement | undefined {
  const key = source.image as object;
  const cached = blurredBackdrops.get(key);
  if (cached) return cached;
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 417;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  const crop = coverCrop(source, canvas);
  context.filter = "blur(5px)";
  // Draw past the edges so the blur does not darken them.
  context.drawImage(source.image, crop.x, crop.y, crop.width, crop.height, -12, -12,
    canvas.width + 24, canvas.height + 24);
  blurredBackdrops.set(key, canvas);
  return canvas;
}

function drawBackdrop(context: CanvasRenderingContext2D): void {
  const { width, visibleHeight } = LOBBY_LAYOUT;
  context.fillStyle = "#0d2350";
  context.fillRect(0, 0, width, LOBBY_LAYOUT.height);
  const source = lobbyHomeBackdrop() ?? mainMenuBackdrop();
  const blurred = source && blurredBackdrop(source);
  if (blurred) context.drawImage(blurred, 0, 0, width, visibleHeight);
  const shade = context.createLinearGradient(0, 0, 0, visibleHeight);
  shade.addColorStop(0, "rgba(16,44,104,.62)");
  shade.addColorStop(0.5, "rgba(22,58,128,.42)");
  shade.addColorStop(1, "rgba(12,34,84,.58)");
  context.fillStyle = shade;
  context.fillRect(0, 0, width, visibleHeight);
  // The category column sits on a deeper band, as in the release lobby.
  const column = context.createLinearGradient(0, 0, LOBBY_LAYOUT.categories.width + 40, 0);
  column.addColorStop(0, "rgba(10,30,76,.55)");
  column.addColorStop(0.85, "rgba(10,30,76,.35)");
  column.addColorStop(1, "rgba(10,30,76,0)");
  context.fillStyle = column;
  context.fillRect(0, LOBBY_LAYOUT.categories.y - 18, LOBBY_LAYOUT.categories.width + 40,
    visibleHeight - LOBBY_LAYOUT.categories.y + 18);
}

/** Category flag shown before each category title. */
const CATEGORY_FLAG = "category-flag.png";

interface LobbyPicture {
  image?: HTMLImageElement;
  done: boolean;
  waiting: Set<() => void>;
}

const pictures = new Map<string, LobbyPicture>();

/**
 * A lobby picture from /ui/multiplayer/. Until it loads (or when it is
 * missing) callers draw their fallback; `redraw` runs once it has loaded.
 */
function lobbyPicture(name: string, redraw: () => void): HTMLImageElement | undefined {
  let entry = pictures.get(name);
  if (!entry) {
    entry = { done: false, waiting: new Set() };
    pictures.set(name, entry);
    if (typeof Image === "undefined") entry.done = true;
    else {
      const record = entry;
      const image = new Image();
      image.decoding = "async";
      image.addEventListener("load", () => {
        record.image = image;
        record.done = true;
        const waiting = [...record.waiting];
        record.waiting.clear();
        waiting.forEach(callback => callback());
      });
      image.addEventListener("error", () => {
        record.done = true;
        record.waiting.clear();
      });
      image.src = `/ui/multiplayer/${name}`;
    }
  }
  if (!entry.done) entry.waiting.add(redraw);
  return entry.image;
}

/** The tab picture spans the tab; its characters sit at the right, face centred. */
function drawTabPicture(context: CanvasRenderingContext2D, image: HTMLImageElement,
  rect: LobbyRect, selected: boolean): void {
  const height = image.naturalHeight * rect.width / image.naturalWidth;
  context.save();
  roundRect(context, rect, 3);
  context.clip();
  context.drawImage(image, rect.x, rect.y + rect.height / 2 - height * 0.46,
    rect.width, height);
  if (!selected) {
    context.fillStyle = "rgba(16,38,92,.74)";
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
  context.restore();
}

const tabArtLayers = new WeakMap<object, HTMLCanvasElement>();

/** Character art from the left part of a mode card, faded in from the left. */
function drawTabArt(context: CanvasRenderingContext2D, art: Texture, rect: LobbyRect,
  selected: boolean): void {
  const layer = tabArtLayer(art, rect.height + 6);
  if (!layer) return;
  context.save();
  roundRect(context, rect, 3);
  context.clip();
  context.globalAlpha = selected ? 1 : 0.32;
  if (!selected) context.filter = "saturate(.55)";
  context.drawImage(layer, rect.x + rect.width - layer.width - 4, rect.y - 3);
  context.restore();
}

function tabArtLayer(art: Texture, height: number): HTMLCanvasElement | undefined {
  const cached = tabArtLayers.get(art.image as object);
  if (cached?.height === Math.ceil(height)) return cached;
  if (typeof document === "undefined") return undefined;
  // Mode cards keep their display size beside a larger source image; the
  // character fills the left half and the mode name the right.
  const natural = art.image as { width?: number; height?: number };
  const naturalWidth = natural.width || art.width;
  const naturalHeight = natural.height || art.height;
  const source = { x: naturalWidth * 0.03, y: 0, width: naturalWidth * 0.45,
    height: naturalHeight * 0.75 };
  const width = source.width * height / source.height;
  const layer = document.createElement("canvas");
  layer.width = Math.ceil(width);
  layer.height = Math.ceil(height);
  const paint = layer.getContext("2d");
  if (!paint) return undefined;
  paint.drawImage(art.image, source.x, source.y, source.width, source.height,
    0, 0, width, height);
  paint.globalCompositeOperation = "destination-in";
  const fade = paint.createLinearGradient(0, 0, width, 0);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.3, "rgba(0,0,0,1)");
  paint.fillStyle = fade;
  paint.fillRect(0, 0, width, height);
  tabArtLayers.set(art.image as object, layer);
  return layer;
}

function drawTabs(host: LobbyListRenderHost, state: LobbyListUiState,
  hit: (name: string, rect: LobbyRect, label: string, disabled?: boolean) => void): void {
  const context = host.context;
  const area = LOBBY_LAYOUT.tabs;
  const width = area.width / LOBBY_TABS.length;
  LOBBY_TABS.forEach((tab, index) => {
    const rect = { x: area.x + index * width, y: area.y, width, height: area.height };
    const selected = state.tab === tab.id;
    const key = `tab:${tab.id}`;
    const hovered = host.hovered === key;
    context.save();
    roundRect(context, rect, 3);
    if (selected) {
      const fill = context.createLinearGradient(0, rect.y, 0, rect.y + rect.height);
      fill.addColorStop(0, "#3fb6ff");
      fill.addColorStop(1, "#1786e8");
      context.fillStyle = fill;
    } else {
      context.fillStyle = hovered ? "rgba(34,72,150,.92)" : "rgba(20,46,104,.88)";
    }
    context.fill();
    context.restore();
    const picture = lobbyPicture(tab.picture, () => { if (!host.disposed) host.render?.(); });
    const art = picture ? undefined : tabArt(host, tab);
    if (picture) drawTabPicture(context, picture, rect, selected);
    else if (art) drawTabArt(context, art, rect, selected);
    context.save();
    roundRect(context, { x: rect.x + 1, y: rect.y + 1, width: rect.width - 2,
      height: rect.height - 2 }, 3);
    context.lineWidth = selected ? 3 : 1.5;
    context.strokeStyle = selected ? "#ffffff" : "rgba(120,160,230,.55)";
    context.stroke();
    context.restore();
    text(context, tab.title, rect.x + 30, rect.y + rect.height / 2, 26,
      selected ? "#ffffff" : hovered ? "#d6e4ff" : "#8fa9d6", { shadow: selected });
    hit(key, rect, tab.title);
  });
}

/** Two crossed race flags, the release category glyph. */
function drawFlagIcon(context: CanvasRenderingContext2D, x: number, y: number,
  color: string): void {
  const flag = (left: number, top: number, skew: number): void => {
    const cell = 4;
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 4; column++) {
        context.fillStyle = (row + column) % 2 ? color : "rgba(255,255,255,0)";
        context.fillRect(left + column * cell + row * skew, top + row * cell, cell, cell);
      }
    }
    context.strokeStyle = color;
    context.lineWidth = 1.3;
    context.strokeRect(left + 0.5, top + 0.5, cell * 4 + 2 * skew, cell * 3);
  };
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, y + 26);
  context.lineTo(x + 8, y);
  context.moveTo(x + 14, y + 26);
  context.lineTo(x + 20, y + 2);
  context.stroke();
  flag(x + 8, y, -0.6);
  flag(x + 20, y + 3, -0.4);
  context.restore();
}

function drawCategories(host: LobbyListRenderHost, state: LobbyListUiState,
  hit: (name: string, rect: LobbyRect, label: string, disabled?: boolean) => void): void {
  const context = host.context;
  const tab = LOBBY_TABS.find(candidate => candidate.id === state.tab) ?? LOBBY_TABS[0]!;
  const area = LOBBY_LAYOUT.categories;
  tab.categories.forEach((category, index) => {
    const rect = { x: area.x, y: area.y + index * (area.itemHeight + area.gap),
      width: area.width, height: area.itemHeight };
    const key = `cat:${category.id}`;
    const selected = state.category === category.id;
    const hovered = host.hovered === key && host.enabled;
    if (selected || hovered) {
      context.save();
      const fill = context.createLinearGradient(rect.x, 0, rect.x + rect.width, 0);
      fill.addColorStop(0, selected ? "rgba(255,255,255,.34)" : "rgba(255,255,255,.16)");
      fill.addColorStop(1, selected ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.04)");
      context.fillStyle = fill;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      if (selected) {
        context.fillStyle = "#ffffff";
        context.fillRect(rect.x, rect.y, 4, rect.height);
      }
      context.restore();
    }
    const color = selected ? "#ffffff" : "rgba(214,226,246,.78)";
    const flag = lobbyPicture(CATEGORY_FLAG, () => { if (!host.disposed) host.render?.(); });
    if (flag) {
      const height = 30;
      const width = flag.naturalWidth * height / flag.naturalHeight;
      context.save();
      context.globalAlpha = selected ? 1 : 0.7;
      context.drawImage(flag, rect.x + 50 - width / 2, rect.y + rect.height / 2 - height / 2,
        width, height);
      context.restore();
    } else {
      drawFlagIcon(context, rect.x + 30, rect.y + rect.height / 2 - 14,
        selected ? "#ffffff" : "rgba(200,214,240,.7)");
    }
    text(context, category.title, rect.x + 82, rect.y + rect.height / 2 - 11, 22, color,
      { shadow: selected });
    text(context, category.subtitle, rect.x + 82, rect.y + rect.height / 2 + 15, 14,
      selected ? "rgba(235,243,255,.9)" : "rgba(170,190,224,.72)", { weight: 500 });
    if (selected) text(context, "»", rect.x + rect.width - 34, rect.y + rect.height / 2 - 2,
      34, "#ffffff", { weight: 400, align: "center" });
    hit(key, rect, `${category.title}（${category.subtitle}）`, !host.enabled);
  });
}

function drawCheckbox(context: CanvasRenderingContext2D, x: number, y: number,
  checked: boolean, hovered: boolean): void {
  const box = { x, y, width: 22, height: 22 };
  context.save();
  roundRect(context, box, 3);
  context.fillStyle = hovered ? "#ffffff" : "rgba(255,255,255,.92)";
  context.fill();
  context.strokeStyle = "rgba(60,100,170,.7)";
  context.lineWidth = 1.5;
  context.stroke();
  if (checked) {
    context.strokeStyle = "#1786e8";
    context.lineWidth = 3.2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(x + 5, y + 11.5);
    context.lineTo(x + 9.5, y + 16);
    context.lineTo(x + 17.5, y + 6.5);
    context.stroke();
  }
  context.restore();
}

function drawTitle(host: LobbyListRenderHost, state: LobbyListUiState,
  hit: (name: string, rect: LobbyRect, label: string, disabled?: boolean) => void): void {
  const context = host.context;
  const area = LOBBY_LAYOUT.title;
  const category = lobbyCategory(state.category)?.category;
  text(context, category?.title ?? "多人游戏", area.x + 2, area.y + area.height / 2, 28,
    "#ffffff", { shadow: true });
  if (!category?.custom) return;
  let right = area.x + area.width - 16;
  for (const filter of [...LOBBY_FILTERS].reverse()) {
    const key = `filter:${filter.key}`;
    const checked = state.filters[filter.key];
    const boxX = right - 22;
    const y = area.y + area.height / 2 - 11;
    drawCheckbox(context, boxX, y, checked, host.hovered === key);
    context.save();
    context.font = font(18);
    const labelWidth = context.measureText(filter.label).width;
    context.restore();
    text(context, filter.label, boxX - 8, area.y + area.height / 2, 18, "#ffffff",
      { align: "right", shadow: true });
    const rect = { x: boxX - 8 - labelWidth - 4, y: y - 6, width: labelWidth + 38, height: 34 };
    hit(key, rect, `${filter.label}筛选（${checked ? "已勾选" : "未勾选"}）`);
    right = rect.x - 22;
  }
}

function drawHeader(context: CanvasRenderingContext2D): void {
  const { header, columns } = LOBBY_LAYOUT;
  context.save();
  context.fillStyle = "rgba(12,32,82,.72)";
  context.fillRect(header.x, header.y, header.width, header.height);
  context.restore();
  const labels: Array<[string, number, number]> = [
    ["模式", header.x, columns.mode],
    ["房间名称", header.x + columns.mode, columns.title],
    ["赛道名称", header.x + columns.mode + columns.title, columns.track],
    ["房间人数", header.x + columns.mode + columns.title + columns.track,
      header.width - columns.mode - columns.title - columns.track],
  ];
  labels.forEach(([label, x, width], index) => {
    text(context, label, x + width / 2, header.y + header.height / 2, 16,
      "rgba(226,236,255,.92)", { weight: 500, align: "center" });
    if (index) {
      context.fillStyle = "rgba(170,196,240,.4)";
      context.fillRect(x, header.y + 8, 1, header.height - 16);
    }
  });
}

/** Release track picker theme icons, loaded once; null while loading or unavailable. */
function themeIcons(host: LobbyListRenderHost): LobbyThemeIcons | undefined {
  if (host.lobbyThemeIcons !== undefined) return host.lobbyThemeIcons ?? undefined;
  host.lobbyThemeIcons = null;
  const library = host.options.library;
  if (typeof library?.canonicalCandidates !== "function" || typeof document === "undefined")
    return undefined;
  void lobbyThemeIcons(library).then(icons => {
    host.lobbyThemeIcons = icons;
    if (!host.disposed) host.render?.();
  }).catch(() => undefined);
  return undefined;
}

function drawThemeIcon(context: CanvasRenderingContext2D, x: number, y: number,
  icon: CanvasImageSource | undefined, theme: string | undefined): void {
  const rect = { x, y, width: 28, height: 28 };
  if (icon) {
    context.drawImage(icon, rect.x, rect.y, rect.width, rect.height);
    return;
  }
  context.save();
  roundRect(context, rect, 4);
  const fill = context.createLinearGradient(0, y, 0, y + rect.height);
  fill.addColorStop(0, "#e2399f");
  fill.addColorStop(1, "#b41782");
  context.fillStyle = fill;
  context.fill();
  context.restore();
  text(context, theme ? Array.from(theme)[0]! : "?", x + 14, y + 14.5, 16, "#ffffff",
    { align: "center" });
}

function drawLock(context: CanvasRenderingContext2D, x: number, y: number): void {
  context.save();
  context.strokeStyle = "#7d8aa4";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x + 6, y + 6, 4, Math.PI, 0);
  context.stroke();
  context.fillStyle = "#7d8aa4";
  roundRect(context, { x, y: y + 6, width: 12, height: 10 }, 2);
  context.fill();
  context.restore();
}

function trackTitle(host: LobbyListRenderHost, room: LobbyListRoom,
  dependencies: LobbyListRenderDependencies): string {
  if (room.randomTrackCode !== undefined)
    return (dependencies.randomTrack ?? X6)(room.randomTrackCode)?.title ?? "随机赛道";
  if (room.trackId) return host.assets.trackTitles.get(room.trackId) ?? "赛道资源不可用";
  return "未选择赛道";
}

function drawRows(host: LobbyListRenderHost, state: LobbyListUiState,
  visible: number[], dependencies: LobbyListRenderDependencies,
  hit: (name: string, rect: LobbyRect, label: string, disabled?: boolean) => void): void {
  const context = host.context;
  const { columns } = LOBBY_LAYOUT;
  const rooms = host.rooms as LobbyListRoom[];
  const icons = themeIcons(host);
  for (let slot = 0; slot < LOBBY_LAYOUT.rows.count; slot++) {
    const rect = lobbyRowRect(slot);
    const index = visible[slot];
    const room = index === undefined ? undefined : rooms[index];
    context.save();
    if (!room) {
      context.fillStyle = "rgba(255,255,255,.07)";
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      context.restore();
      continue;
    }
    const key = `room${index}`;
    const joinable = host.enabled && lobbyRoomJoinable(room);
    const hovered = host.hovered === key && joinable;
    const pressed = host.pressed === key && joinable;
    context.fillStyle = pressed ? "rgba(214,232,255,.98)" : hovered ? "#ffffff"
      : joinable ? "rgba(236,242,251,.93)" : "rgba(214,221,234,.82)";
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    if (hovered) {
      context.strokeStyle = "#2a9df4";
      context.lineWidth = 2;
      context.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    }
    context.restore();
    const middle = rect.y + rect.height / 2;
    const dim = joinable ? 1 : 0.6;
    const ink = `rgba(34,48,77,${dim})`;
    text(context, lobbyRoomModeLabel(room), rect.x + columns.mode / 2, middle, 17, ink,
      { weight: 500, align: "center" });
    const titleX = rect.x + columns.mode + 16;
    const title = trackTitle(host, room, dependencies);
    drawThemeIcon(context, titleX, middle - 14,
      icons?.forTrack(room.trackId, room.randomTrackCode !== undefined),
      trackThemeName(title));
    let titleWidth = columns.title - 16 - 40 - 12;
    if (room.gaming) {
      // Web addition: racing rooms still take players for the next race.
      const tag = { x: rect.x + columns.mode + columns.title - 70, y: middle - 11,
        width: 58, height: 22 };
      context.save();
      roundRect(context, tag, 11);
      context.fillStyle = "#e0544f";
      context.fill();
      context.restore();
      text(context, "游戏中", tag.x + tag.width / 2, middle, 13, "#ffffff", { align: "center" });
      titleWidth -= 66;
    }
    text(context, room.name ?? "未命名房间", titleX + 40, middle, 18, ink,
      { weight: 500, maxWidth: titleWidth });
    text(context, title, rect.x + columns.mode + columns.title + columns.track / 2, middle,
      17, ink, { weight: 500, align: "center", maxWidth: columns.track - 24 });
    const countX = rect.x + columns.mode + columns.title + columns.track +
      (rect.width - columns.mode - columns.title - columns.track) / 2 - 10;
    context.save();
    context.font = font(22);
    const countWidth = context.measureText(String(room.count)).width;
    context.font = font(16, 500);
    const capacityWidth = context.measureText(`/${room.capacity}`).width;
    context.restore();
    const start = countX - (countWidth + capacityWidth) / 2;
    text(context, String(room.count), start, middle, 22,
      room.count >= room.capacity ? `rgba(224,84,79,${dim})` : `rgba(28,140,232,${dim})`);
    text(context, `/${room.capacity}`, start + countWidth, middle + 2, 16,
      `rgba(107,120,148,${dim})`, { weight: 500 });
    if (room.locked) drawLock(context, rect.x + rect.width - 30, middle - 9);
    if (host.enabled) hit(key, rect,
      `加入 ${dependencies.roomLabel(room as LobbyRoomSummary)}${room.gaming ? "（游戏中）" : ""}`,
      !joinable);
  }
  if (!visible.length) {
    const area = lobbyRowRect(0);
    const loading = lobbyListLoading(state);
    if (loading) scheduleLoadingTimeout(host);
    const message = !host.enabled ? "正在连接房间服务…"
      : loading && !host.rooms.length ? "正在读取房间…"
        : host.rooms.length ? "当前筛选条件下没有房间，可以调整筛选或翻页查看"
          : "暂无房间，点击「创建房间」邀请其他玩家吧";
    text(context, message, area.x + area.width / 2, area.y + lobbyRowsHeight() / 2, 20,
      "rgba(235,242,255,.9)", { align: "center", shadow: true, weight: 500 });
  }
}

function drawScrollbar(host: LobbyListRenderHost,
  hit: (name: string, rect: LobbyRect, label: string, disabled?: boolean) => void): void {
  const context = host.context;
  const bar = LOBBY_LAYOUT.scrollbar;
  const height = lobbyRowsHeight();
  const pages = Math.max(1, Math.ceil(host.total / LOBBY_LAYOUT.rows.count));
  context.save();
  context.fillStyle = "rgba(255,255,255,.22)";
  roundRect(context, { x: bar.x, y: bar.y, width: bar.width, height }, bar.width / 2);
  context.fill();
  const thumbHeight = Math.max(48, height / pages);
  const thumbY = bar.y + (height - thumbHeight) * (pages > 1 ? host.page / (pages - 1) : 0);
  context.fillStyle = "rgba(255,255,255,.9)";
  roundRect(context, { x: bar.x, y: thumbY, width: bar.width, height: thumbHeight },
    bar.width / 2);
  context.fill();
  context.restore();
  const enabled = host.enabled;
  if (host.page > 0 && thumbY > bar.y)
    hit("roomLeft", { x: bar.x - 8, y: bar.y, width: bar.width + 16, height: thumbY - bar.y },
      "上一页", !enabled);
  if ((host.page + 1) * LOBBY_LAYOUT.rows.count < host.total)
    hit("roomRight", { x: bar.x - 8, y: thumbY + thumbHeight, width: bar.width + 16,
      height: bar.y + height - thumbY - thumbHeight }, "下一页", !enabled);
}

function drawCreateButton(host: LobbyListRenderHost,
  hit: (name: string, rect: LobbyRect, label: string, disabled?: boolean) => void): void {
  const context = host.context;
  const rect = LOBBY_LAYOUT.create;
  const enabled = host.enabled;
  const hovered = enabled && host.hovered === "createRoom";
  const pressed = enabled && host.pressed === "createRoom";
  context.save();
  roundRect(context, rect, 4);
  context.fillStyle = pressed ? "#dfe8f6" : hovered ? "#ffffff" : "rgba(246,249,253,.95)";
  context.fill();
  context.strokeStyle = hovered ? "#2a9df4" : "rgba(170,190,222,.9)";
  context.lineWidth = hovered ? 2 : 1;
  context.stroke();
  context.globalAlpha = enabled ? 1 : 0.5;
  context.strokeStyle = "#4b5b7a";
  context.lineWidth = 3.5;
  context.lineCap = "round";
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + 28;
  context.beginPath();
  context.moveTo(cx - 13, cy);
  context.lineTo(cx + 13, cy);
  context.moveTo(cx, cy - 13);
  context.lineTo(cx, cy + 13);
  context.stroke();
  context.restore();
  text(context, "创建房间", cx, rect.y + rect.height - 17, 15,
    enabled ? "#3b4a66" : "rgba(59,74,102,.5)", { align: "center", weight: 500 });
  hit("createRoom", rect, "创建房间", !enabled);
}

function drawQuickStartButton(host: LobbyListRenderHost,
  hit: (name: string, rect: LobbyRect, label: string, disabled?: boolean) => void): void {
  const context = host.context;
  const rect = LOBBY_LAYOUT.quickStart;
  const enabled = host.enabled;
  const hovered = enabled && host.hovered === "quickJoin";
  const pressed = enabled && host.pressed === "quickJoin";
  context.save();
  roundRect(context, rect, 4);
  const fill = context.createLinearGradient(0, rect.y, 0, rect.y + rect.height);
  fill.addColorStop(0, pressed ? "#1478d8" : hovered ? "#4bbcff" : "#2aa2f6");
  fill.addColorStop(1, pressed ? "#0f62bd" : hovered ? "#1d89ee" : "#1673e0");
  context.fillStyle = fill;
  context.globalAlpha = enabled ? 1 : 0.55;
  context.fill();
  context.strokeStyle = "rgba(255,255,255,.75)";
  context.lineWidth = 1.5;
  context.stroke();
  // ▶‖ glyph.
  const x = rect.x + 34;
  const y = rect.y + rect.height / 2;
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.moveTo(x, y - 13);
  context.lineTo(x + 18, y);
  context.lineTo(x, y + 13);
  context.closePath();
  context.fill();
  context.fillRect(x + 23, y - 13, 5, 26);
  context.fillRect(x + 32, y - 13, 5, 26);
  context.restore();
  text(context, "快速开始", rect.x + 86, y, 28, enabled ? "#ffffff" : "rgba(255,255,255,.7)",
    { shadow: true });
  const chip = { x: rect.x + rect.width - 70, y: y - 16, width: 48, height: 32 };
  context.save();
  roundRect(context, chip, 4);
  context.strokeStyle = "rgba(255,255,255,.9)";
  context.lineWidth = 1.5;
  context.stroke();
  context.restore();
  text(context, "F5", chip.x + chip.width / 2, y + 1, 17, "#ffffff", { align: "center" });
  hit("quickJoin", rect, "快速开始（F5）", !enabled);
}

/** First list for the lobby: the home entry's channel, else 竞速自订. */
function requestInitialList(host: LobbyListRenderHost, state: LobbyListUiState): void {
  if (state.requested || host.channelName || !host.enabled || !host.options.onMode) return;
  state.requested = true;
  const gameplay = host.options.lobbyGameplay ?? "ordinary";
  const category = categoryForChannel(host.options.lobbyChannel, gameplay);
  if (!category) return;
  const found = lobbyCategory(category.id)!;
  state.category = category.id;
  state.tab = found.tab.id;
  const channel = host.options.lobbyChannel && category.channels.includes(host.options.lobbyChannel)
    ? host.options.lobbyChannel : category.channel;
  queueMicrotask(() => {
    if (!host.disposed && !host.channelName)
      requestLobbyList(state, () => host.options.onMode?.(channel, 0, category.gameplay));
  });
}

/** A request that never answers stops reading as loading after a while. */
function scheduleLoadingTimeout(host: LobbyListRenderHost): void {
  if (host.lobbyLoadingTimer !== undefined || typeof window === "undefined") return;
  host.lobbyLoadingTimer = window.setTimeout(() => {
    host.lobbyLoadingTimer = undefined;
    if (!host.disposed) host.render?.();
  }, LOBBY_LOADING_MS + 50);
}

/** The wheel turns room pages over the room table. */
function bindLobbyInput(host: LobbyListRenderHost): void {
  if (host.lobbyUiBound || typeof window === "undefined") return;
  host.lobbyUiBound = true;
  // Any room list arriving outside a request's own row clearing answers it.
  const setRooms = host.setRooms;
  if (setRooms) host.setRooms = (...args: unknown[]) => {
    const state = lobbyListState(host);
    if (!state.listing) state.loading = false;
    return setRooms.apply(host, args);
  };
  let last = 0;
  host.canvas.addEventListener("wheel", event => {
    if (host.disposed || !host.enabled || !event.deltaY) return;
    const bounds = host.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = (event.clientX - bounds.left) / bounds.width * LOBBY_LAYOUT.width;
    const y = (event.clientY - bounds.top) / bounds.height * LOBBY_LAYOUT.height;
    const rows = LOBBY_LAYOUT.rows;
    if (x < rows.x || x > LOBBY_LAYOUT.scrollbar.x + 20 || y < LOBBY_LAYOUT.header.y ||
        y > rows.y + lobbyRowsHeight()) return;
    event.preventDefault();
    const now = performance.now();
    if (now - last < WHEEL_PAGE_MS) return;
    const name = event.deltaY > 0 ? "roomRight" : "roomLeft";
    if (!host.hits.some(entry => entry.name === name)) return;
    last = now;
    host.activate(name);
  }, { passive: false });
}

/** Layout the full-screen lobby and publish the hit targets as real buttons. */
export function renderLobbyList(
  host: LobbyListRenderHost,
  dependencies: LobbyListRenderDependencies,
): void {
  if (host.disposed) return;
  const state = lobbyListState(host);
  reconcileLobbyCategory(state, host.channelName, host.gameplay);
  requestInitialList(host, state);
  bindLobbyInput(host);
  host.visibleRoomIndexes = () => visibleLobbyRooms(lobbyListState(host), host.rooms as LobbyListRoom[]);

  const bounds = host.options.root.getBoundingClientRect();
  const viewport = dependencies.viewport(bounds.width, bounds.height,
    window.devicePixelRatio, LOBBY_LAYOUT.width, LOBBY_LAYOUT.height);
  host.canvas.width = viewport.width;
  host.canvas.height = viewport.height;
  host.context.setTransform(viewport.scaleX, 0, 0, viewport.scaleY, 0, 0);
  host.context.imageSmoothingEnabled = true;
  host.context.imageSmoothingQuality = "high";
  host.canvas.style.imageRendering = "auto";
  host.hits = [];
  const regions: Array<{ key: string; rect: LobbyRect; label: string; disabled?: boolean }> = [];
  const hit = (name: string, rect: LobbyRect, label: string, disabled = false): void => {
    if (!disabled) host.hits.push({ name, rect });
    regions.push({ key: name, rect, label, disabled });
  };

  drawBackdrop(host.context);
  drawTabs(host, state, hit);
  drawCategories(host, state, hit);
  drawTitle(host, state, hit);
  drawHeader(host.context);
  drawRows(host, state, visibleLobbyRooms(state, host.rooms as LobbyListRoom[]),
    dependencies, hit);
  drawScrollbar(host, hit);
  drawCreateButton(host, hit);
  drawQuickStartButton(host, hit);

  host.buttons.update(regions.map(region => ({
    ...region,
    hover: () => host.options.onHover?.(),
    activate: () => host.activate(region.key),
  })));
  host.canvas.style.cursor = host.hovered && host.hits.some(entry => entry.name === host.hovered)
    ? "pointer" : "default";
}

