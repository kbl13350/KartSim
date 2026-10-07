/** The SelectTrackEx window: track cards, random cards, favorites and input. */

import { ScrollbarController, type UiRectangle } from "./scrollbar";
import { TouchPageSwipe } from "./touch-swipe";
import {
  gridLayout, gridLayoutConfig, gridPageSize, gridStepSize,
  type GridLayout,
} from "./grid-layout";
import {
  changeFavoriteTrack, commitTrackSearch, confirmTrackSelection,
  placeInitialThemeOffset, searchTracks, selectTrackTheme, toggleTrackGameType,
  type TrackPickerActionHost, type TrackPickerConfirmation,
} from "./track-picker-actions";
import {
  filteredTracks, gameTypeEnabled, matchingRandomGroup, randomGroupsForDisplay,
  type SelectableRandomGroup, type SelectableTrack,
} from "./track-picker";
import type {
  TrackPickerWindowAssets, TrackPickerWindowNode, TrackPickerWindowImage,
  TrackPickerWindowFrame, TrackPickerWindowLibrary,
} from "./track-picker-window-assets";

export interface TrackPickerTrack extends SelectableTrack {
  path: string;
  reverse?: boolean;
  difficulty: number;
}

export interface TrackPickerRandomGroup extends SelectableRandomGroup {
  trackIds: string[];
  displayTrackIds?: string[];
}

export interface TrackPickerWindowOptions {
  root: HTMLElement;
  library: TrackPickerWindowLibrary;
  tracks: TrackPickerTrack[];
  randomGroups?: TrackPickerRandomGroup[];
  randomTrackNames?: Map<string, string>;
  selectedTrackId: string;
  selectedRandomGroupId?: string;
  favoriteTrackIds: Set<string>;
  onConfirm(selection: TrackPickerConfirmation): void;
  onCancel(): void;
  onError?(error: unknown): void;
  onNotice(rectangle: UiRectangle, message: string,
    paint: (context: CanvasRenderingContext2D) => void): void;
  onInteraction?(): void;
  getFavoriteCount(): number;
  onFavoriteChange(id: string, favorite: boolean): void;
}

interface TrackPickerHit {
  id: string;
  kind: string;
  value?: string;
  rect: UiRectangle;
}

export interface TrackPickerWindowDependencies {
  loadAssets(library: TrackPickerWindowLibrary,
    randomGroups: TrackPickerRandomGroup[]): Promise<{
      randomAvailable: boolean;
      randomError?: unknown;
      assets: TrackPickerWindowAssets;
    }>;
  loadTrackCard(library: TrackPickerWindowLibrary,
    trackPath: string): Promise<TrackPickerWindowImage>;
  releaseFont(font: unknown): void;
  layoutTree(root: TrackPickerWindowNode, viewport: UiRectangle,
    frames: TrackPickerWindowAssets["frames"],
    images?: Map<TrackPickerWindowNode, TrackPickerWindowImage>):
    Map<TrackPickerWindowNode, UiRectangle>;
  layoutRect(node: TrackPickerWindowNode, viewport: UiRectangle,
    frame?: TrackPickerWindowFrame, image?: TrackPickerWindowImage,
    override?: Partial<UiRectangle>): UiRectangle;
  frameClient(frame: TrackPickerWindowFrame, rectangle: UiRectangle): UiRectangle;
  paintFrame(context: CanvasRenderingContext2D, frame: TrackPickerWindowFrame,
    image: HTMLCanvasElement, rectangle: UiRectangle): void;
  paintText(context: CanvasRenderingContext2D, text: string, rectangle: UiRectangle,
    style: { family: string; size: number; color: string;
      align: "left" | "center" | "right";
      verticalAlign: "top" | "center" | "bottom";
      kind: "label" | "button" }): void;
  measureText(context: CanvasRenderingContext2D, text: string,
    style: { family: string; size: number }): { width: number; height: number };
  configureCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D,
    width: number, height: number, ratio: number,
    logicalWidth: number, logicalHeight: number,
    displayWidth: number, displayHeight: number): void;
  pixelRatio(): number;
  positionControl(element: HTMLElement, rectangle: UiRectangle,
    scaleX: number, scaleY: number): void;
  noticeLayout(node: TrackPickerWindowNode, frame: TrackPickerWindowFrame,
    extraHeight?: number): {
      window: UiRectangle; message: UiRectangle; icon: UiRectangle;
    };
  paintNotice(context: CanvasRenderingContext2D,
    notice: TrackPickerWindowAssets["notice"],
    layout: { window: UiRectangle; message: UiRectangle; icon: UiRectangle },
    title: string | undefined, lines: string[], family: string): void;
}

const WIDTH = 1600;
const HEIGHT = 900;
const UI_BOUNDS: UiRectangle = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
const FONT_FAMILY = "P3528 Source Han Sans CN Track Select";
const RANDOM_DESCRIPTION_LINE_HEIGHT = 22;
const RANDOM_DESCRIPTION_BOTTOM = 6;

function attribute(node: TrackPickerWindowNode | undefined, name: string): string | undefined {
  return node?.attributes.find(item => item.name === name)?.value;
}

function parseNumbers(value: string | undefined, length: number, label: string): number[] {
  const values = value!.trim().split(/\s+/);
  if (values.length !== length)
    throw new Error(`${label}=${value} 必须包含 ${length} 个数。`);
  return values.map(part => {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(part))
      throw new Error(`${label}=${value} 包含无效数字。`);
    const number = Number(part);
    if (!Number.isFinite(number))
      throw new Error(`${label}=${value} 包含非有限值。`);
    return Math.fround(number);
  });
}

function windowColor(value: string | undefined): string {
  if (value === "white" || value === "black") return value;
  const [alpha, red, green, blue] = parseNumbers(value, 4, "color");
  return `rgba(${red}, ${green}, ${blue}, ${alpha! / 255})`;
}

function childNode(root: TrackPickerWindowNode, name: string,
  fallback?: TrackPickerWindowNode): TrackPickerWindowNode {
  const stack = fallback ? [root, fallback] : [root];
  while (stack.length) {
    const current = stack.pop()!;
    if (attribute(current, "name") === name) return current;
    stack.push(...current.children);
  }
  throw new Error(`P3528 SelectTrackEx 缺少布局节点 ${name}。`);
}

function parentNode(root: TrackPickerWindowNode,
  node: TrackPickerWindowNode): TrackPickerWindowNode {
  const stack = [root];
  while (stack.length) {
    const current = stack.pop()!;
    if (current.children.includes(node)) return current;
    stack.push(...current.children);
  }
  throw new Error("P3528 SelectTrackEx 缺少布局父节点。");
}

function buildWindowRects(assets: TrackPickerWindowAssets,
  dependencies: TrackPickerWindowDependencies): Map<TrackPickerWindowNode, UiRectangle> {
  const favorite = childNode(assets.definition, "favTrt0");
  const override = new Map([[favorite, assets.favoriteButton[0]!]]);
  const rectangles = dependencies.layoutTree(assets.definition, UI_BOUNDS,
    assets.frames, override);
  const main = rectangles.get(childNode(assets.definition, "selectTrackEx"))!;
  dependencies.layoutTree(assets.radioDefinition, main, assets.frames)
    .forEach((rectangle, node) => rectangles.set(node, rectangle));
  const randomRadio = assets.radioDefinition.children.find(node =>
    attribute(node, "name") === "randomRadioButton");
  if (randomRadio) {
    const visible = { ...randomRadio,
      attributes: randomRadio.attributes.filter(item => item.name !== "visible") };
    dependencies.layoutTree({ ...assets.radioDefinition, children: [visible] },
      main, assets.frames).forEach((rectangle, node) => rectangles.set(node, rectangle));
  }
  for (const id of ["selectThemeListBar", "thumbListBar"]) {
    const scrollbar = childNode(assets.definition, id);
    const parent = parentNode(assets.definition, scrollbar);
    rectangles.set(scrollbar, dependencies.layoutRect(scrollbar, rectangles.get(parent)!));
  }
  return rectangles;
}

function drawImage(context: CanvasRenderingContext2D,
  image: TrackPickerWindowImage, rectangle: UiRectangle): void {
  context.drawImage(image.image, rectangle.x, rectangle.y, rectangle.width, rectangle.height);
}

function drawCenteredImage(context: CanvasRenderingContext2D,
  image: TrackPickerWindowImage, rectangle: UiRectangle): void {
  context.drawImage(image.image,
    rectangle.x + (rectangle.width - image.width) * 0.5,
    rectangle.y + (rectangle.height - image.height) * 0.5);
}

function drawCroppedImage(context: CanvasRenderingContext2D,
  image: TrackPickerWindowImage, source: [number, number, number, number],
  rectangle: UiRectangle): void {
  context.drawImage(image.image, source[0], source[1],
    source[2] - source[0], source[3] - source[1],
    rectangle.x, rectangle.y, rectangle.width, rectangle.height);
}

function drawFittedCard(context: CanvasRenderingContext2D,
  image: TrackPickerWindowImage, rectangle: UiRectangle): void {
  if (image.width >= rectangle.width && image.height >= rectangle.height) {
    const left = (image.width - rectangle.width) * 0.5;
    const top = (image.height - rectangle.height) * 0.5;
    drawCroppedImage(context, image,
      [left, top, left + rectangle.width, top + rectangle.height], rectangle);
  } else drawImage(context, image, rectangle);
}

function drawNineSlice(context: CanvasRenderingContext2D,
  image: TrackPickerWindowImage, rectangle: UiRectangle,
  horizontal = 1, vertical = 1): void {
  const right = image.width - horizontal;
  const bottom = image.height - vertical;
  const middleWidth = Math.max(0, rectangle.width - horizontal * 2);
  const middleHeight = Math.max(0, rectangle.height - vertical * 2);
  const parts: Array<[[number, number, number, number], UiRectangle]> = [
    [[0, 0, horizontal, vertical], { x: rectangle.x, y: rectangle.y,
      width: horizontal, height: vertical }],
    [[horizontal, 0, right, vertical], { x: rectangle.x + horizontal, y: rectangle.y,
      width: middleWidth, height: vertical }],
    [[right, 0, image.width, vertical], { x: rectangle.x + rectangle.width - horizontal,
      y: rectangle.y, width: horizontal, height: vertical }],
    [[0, vertical, horizontal, bottom], { x: rectangle.x,
      y: rectangle.y + vertical, width: horizontal, height: middleHeight }],
    [[horizontal, vertical, right, bottom], { x: rectangle.x + horizontal,
      y: rectangle.y + vertical, width: middleWidth, height: middleHeight }],
    [[right, vertical, image.width, bottom], {
      x: rectangle.x + rectangle.width - horizontal, y: rectangle.y + vertical,
      width: horizontal, height: middleHeight }],
    [[0, bottom, horizontal, image.height], { x: rectangle.x,
      y: rectangle.y + rectangle.height - vertical, width: horizontal, height: vertical }],
    [[horizontal, bottom, right, image.height], { x: rectangle.x + horizontal,
      y: rectangle.y + rectangle.height - vertical, width: middleWidth, height: vertical }],
    [[right, bottom, image.width, image.height], {
      x: rectangle.x + rectangle.width - horizontal,
      y: rectangle.y + rectangle.height - vertical,
      width: horizontal, height: vertical }],
  ];
  parts.forEach(([source, target]) => drawCroppedImage(context, image, source, target));
}

function randomCardTitle(group: TrackPickerRandomGroup): string {
  const titles: Record<string, string> = {
    hot1: "人气随机（极易）", hot2: "人气随机（简单）", hot3: "人气随机（普通）",
    hot4: "人气随机（困难）", hot5: "人气随机（极难）",
    all: "全部随机", speedAll: "竞速随机", clubSpeed: "专业竞速随机",
    new: "新图随机", reverse: "反方向随机", crazy: "疯狂随机",
  };
  if (group.cardToken === "speedAllRandom_TimeAttack@zz") return "竞速随机";
  return titles[group.randomType] ?? (group.level === undefined
    ? group.randomType : `${group.randomType}:${group.level}`);
}

function hasRandomDescription(group: TrackPickerRandomGroup): boolean {
  return !["all", "speedAll", "reverse"].includes(group.randomType);
}

function randomDescriptionSize(node: TrackPickerWindowNode | undefined,
  columns: number): [number, number] {
  const size = node && attribute(node, "leftTopWH");
  if (!size) return [220 * columns, 225];
  const values = parseNumbers(size, 4, "randomTrackDesc.leftTopWH");
  return [values[2]! * columns, values[3]!];
}

function containsPoint(point: { x: number; y: number }, rectangle: UiRectangle): boolean {
  return point.x >= rectangle.x && point.x <= rectangle.x + rectangle.width &&
    point.y >= rectangle.y && point.y <= rectangle.y + rectangle.height;
}

function labelSize(node: TrackPickerWindowNode): number {
  return Number(attribute(node, "textRender")!.replace("bold", ""));
}

function favoriteTextColor(buttonState: number, selected: boolean): string {
  return buttonState === 2 ? "rgb(142, 196, 243)"
    : selected || buttonState === 3 ? "white" : "rgb(135, 146, 167)";
}

export class TrackPickerWindow {
  static dependencies: TrackPickerWindowDependencies;
  readonly element = document.createElement("div");
  readonly canvas = document.createElement("canvas");
  readonly search = document.createElement("input");
  readonly cardTextures = new Map<string, TrackPickerWindowImage>();
  readonly loadingCards = new Set<string>();
  readonly touchSwipe = new TouchPageSwipe(48, 8,
    direction => this.touchSwipeBar?.wheel(direction, undefined as unknown as number) ?? false);
  readonly favoriteStates = new Map<string, number>();
  readonly context: CanvasRenderingContext2D;
  readonly windows: Map<TrackPickerWindowNode, UiRectangle>;
  readonly scrollbarInteractions: Map<string, ScrollbarController>;
  readonly resizeObserver: ResizeObserver;
  activeScrollbar?: ScrollbarController;
  touchSwipeBar?: ScrollbarController;
  hits: TrackPickerHit[] = [];
  selectedTrackId?: string;
  selectedRandomGroupId?: string;
  selectedTheme?: string;
  searchQuery = "";
  themeOffset = 0;
  trackOffset = 0;
  itemEnabled = true;
  speedEnabled = true;
  hovered?: string;
  pressed?: string;
  shown = false;
  disposed = false;
  readonly onWindowResize = () => this.render();

  constructor(readonly options: TrackPickerWindowOptions,
    readonly assets: TrackPickerWindowAssets,
    readonly dependencies: TrackPickerWindowDependencies =
      (new.target as typeof TrackPickerWindow).dependencies) {
    if (!dependencies) throw new Error("选图窗口缺少运行依赖。");
    const context = this.canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("浏览器无法创建 P3528 SelectTrackEx Canvas。");
    this.context = context;
    this.windows = buildWindowRects(assets, dependencies);
    this.scrollbarInteractions = new Map([
      ["selectThemeListBar", new ScrollbarController(position => {
        this.themeOffset = position * this.gridStep("selectTheme");
        this.render();
      })],
      ["thumbListBar", new ScrollbarController(position => {
        this.trackOffset = position * this.gridStep("thumbList");
        this.render();
      })],
    ]);
    this.selectedTrackId = options.selectedTrackId;
    this.selectedRandomGroupId = options.selectedRandomGroupId;
    const random = options.randomGroups?.find(group => group.id === this.selectedRandomGroupId);
    if (random) {
      this.itemEnabled = random.gameType === "item";
      this.speedEnabled = random.gameType === "speed";
    }
    const track = options.tracks.find(candidate => candidate.id === options.selectedTrackId);
    if (!track) throw new Error("P3528 SelectTrackEx 当前赛道不在 mode 9 候选中。");
    this.selectedTheme = this.selectedRandomGroupId === undefined ? track.theme : "1024";
    this.placeInitialOffsets();
    this.prepareElements();
    this.element.className = "client-dialog";
    this.element.dataset.uiLayer = "dialog";
    this.element.hidden = true;
    this.element.append(this.canvas, this.search);
    options.root.append(this.element);
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(options.root);
    window.addEventListener("resize", this.onWindowResize);
  }

  static async load(options: TrackPickerWindowOptions): Promise<TrackPickerWindow> {
    if (options.tracks.length === 0)
      throw new Error("P3528 mode 9 没有可选择的普通计时赛赛道。");
    const dependencies = this.dependencies;
    const loaded = await dependencies.loadAssets(options.library,
      options.randomGroups ?? []);
    if (loaded.randomError !== undefined)
      options.onError?.(new Error(`随机赛道界面不可用：${
        loaded.randomError instanceof Error ? loaded.randomError.message
          : String(loaded.randomError)}`));
    const effectiveOptions = loaded.randomAvailable ? options : {
      ...options, randomGroups: [], randomTrackNames: new Map<string, string>(),
      selectedRandomGroupId: undefined,
    };
    try {
      return new this(effectiveOptions, loaded.assets, dependencies);
    } catch (error) {
      dependencies.releaseFont(loaded.assets.font);
      throw error;
    }
  }

  show(): void {
    if (this.disposed) return;
    this.shown = true;
    this.element.hidden = false;
    this.canvas.hidden = false;
    this.search.hidden = false;
    window.addEventListener("keydown", this.onKeyDown);
    this.render();
    this.canvas.focus();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scrollbarInteractions.forEach(scrollbar => scrollbar.dispose());
    this.resizeObserver.disconnect();
    window.removeEventListener("resize", this.onWindowResize);
    window.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.remove();
    this.search.remove();
    this.element.remove();
    this.dependencies.releaseFont(this.assets.font);
  }

  prepareElements(): void {
    Object.assign(this.canvas.style, {
      position: "absolute", inset: "0", width: "100%", height: "100%",
      imageRendering: "pixelated", pointerEvents: "auto",
    });
    this.canvas.hidden = true;
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute("role", "dialog");
    this.canvas.setAttribute("aria-label",
      this.assets.strings.get("selectTrackCaption") ?? "选择赛道");
    this.search.className = "window-edit";
    Object.assign(this.search.style, {
      position: "absolute", boxSizing: "border-box", border: "0", outline: "0",
      background: "transparent", color: "white",
      font: `16px "${FONT_FAMILY}"`, padding: "0",
    });
    this.search.hidden = true;
    this.search.maxLength = Number(attribute(this.node("searchEdit"), "maxChar"));
    this.search.placeholder = this.assets.strings.get("fvrTrack_helpstring") ?? "";
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerCancel);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }

  placeInitialOffsets(): void {
    placeInitialThemeOffset(this as unknown as TrackPickerActionHost);
  }

  render(): void {
    if (!this.shown || this.disposed) return;
    this.resizeCanvas();
    this.context.clearRect(0, 0, WIDTH, HEIGHT);
    this.context.imageSmoothingEnabled = true;
    this.hits = [];
    const rectangle = this.dialogRect();
    this.context.fillStyle = windowColor(attribute(this.assets.definition, "color"));
    this.context.fillRect(0, 0, WIDTH, HEIGHT);
    drawImage(this.context, this.assets.main, rectangle);
    const caption = this.node("selectTrackEx").children.find(node => node.name === "Label")!;
    this.drawLabel(caption, this.windows.get(caption)!);
    this.drawFavoriteButton();
    this.drawThemes();
    this.drawFilters();
    this.drawButtons(rectangle);
    this.drawTracks();
    this.positionSearch();
    this.canvas.style.cursor = this.hovered === undefined ? "default" : "pointer";
    this.loadVisibleCards();
  }

  private paintText(text: string, rectangle: UiRectangle, size: number,
    color: string, align: "left" | "center" | "right",
    verticalAlign: "top" | "center" | "bottom" = "center",
    kind: "label" | "button" = "label"): void {
    this.dependencies.paintText(this.context, text, rectangle,
      { family: FONT_FAMILY, size, color, align, verticalAlign, kind });
  }

  drawFavoriteButton(): void {
    const button = this.node("favTrt0");
    const rectangle = this.rect("favTrt0");
    const selected = this.selectedTheme === "favorite";
    const state = this.buttonState("theme:favorite");
    const images = selected ? this.assets.selectedFavoriteButton : this.assets.favoriteButton;
    drawCenteredImage(this.context, images[state - 1]!, rectangle);
    this.paintText(this.assets.strings.get("favoriteTrack")!,
      this.stringPosition(button, rectangle), labelSize(button),
      favoriteTextColor(state, selected), "left");
    this.addHit({ id: "theme:favorite", kind: "theme", value: "favorite", rect: rectangle });
  }

  drawThemes(): void {
    const grid = this.themeGrid();
    this.assets.themes.slice(grid.firstItem, grid.firstItem + grid.cells.length)
      .forEach((theme, index) => {
        const rectangle = grid.cells[index]!;
        const id = `theme:${theme.id}`;
        const selected = theme.id === this.selectedTheme;
        const state = this.buttonState(id);
        const images = selected ? this.assets.selectedThemeButton : this.assets.themeButton;
        drawCenteredImage(this.context, images[state - 1]!, rectangle);
        drawImage(this.context, theme.icon,
          this.dependencies.layoutRect(childNode(this.assets.themeDefinition, "themeIcon"),
            rectangle));
        this.paintText(theme.title,
          this.stringPosition(this.assets.themeDefinition, rectangle),
          labelSize(this.assets.themeDefinition),
          favoriteTextColor(state, selected), "left");
        this.addHit({ id, kind: "theme", value: theme.id, rect: rectangle });
      });
    this.drawScrollbar("selectThemeListBar", grid,
      this.themeOffset / this.gridStep("selectTheme"));
  }

  drawFilters(): void {
    if (this.selectedTheme === "1024") return this.drawRandomFilters();
    this.drawCheck("item", this.itemEnabled);
    this.drawCheck("speed", this.speedEnabled);
    this.drawLabel(this.node("searchTotalTrack"), this.rect("searchTotalTrack"));
  }

  drawRandomFilters(): void {
    this.drawRandomCheck("item", this.itemEnabled);
    this.drawRandomCheck("speed", this.speedEnabled);
    this.drawLabel(this.node("searchTotalTrack"), this.rect("searchTotalTrack"));
  }

  drawRandomCheck(gameType: string, checked: boolean): void {
    const radio = this.node(`randomRadio.${gameType}`);
    const rectangle = this.windows.get(radio)!;
    const id = `filter:${gameType}`;
    const image = this.assets.randomRadioButton?.[Number(checked) +
      (this.hovered === id ? 2 : 0)];
    if (!image) return;
    drawImage(this.context, image, rectangle);
    const label = radio.children[0]!;
    const labelRect = this.windows.get(label)!;
    this.drawLabel(label, { ...labelRect, y: rectangle.y, height: rectangle.height });
    this.addHit({ id, kind: gameType, rect: rectangle });
  }

  drawCheck(gameType: string, checked: boolean): void {
    const radio = this.node(`radio.${gameType}`);
    const rectangle = this.windows.get(radio)!;
    const id = `filter:${gameType}`;
    const state = Number(checked) + (this.hovered === id ? 2 : 0);
    this.dependencies.paintFrame(this.context, this.assets.checkFrames[state]!,
      this.assets.frame.image, rectangle);
    const label = radio.children[0]!;
    this.drawLabel(label, this.windows.get(label)!);
    this.addHit({ id, kind: gameType, rect: rectangle });
  }

  drawTracks(): void {
    if (this.selectedTheme === "1024") return this.drawRandomTracks();
    const tracks = this.filteredTracks();
    const grid = this.trackGrid(tracks.length);
    tracks.slice(grid.firstItem, grid.firstItem + grid.cells.length)
      .forEach((track, index) => {
        const rectangle = grid.cells[index]!;
        this.addHit({ id: `track:${track.id}`, kind: "track",
          value: track.id, rect: rectangle });
        this.drawTrackCard(track, rectangle);
      });
    this.drawScrollbar("thumbListBar", grid,
      this.trackOffset / this.gridStep("thumbList"));
  }

  drawRandomTracks(): void {
    const groups = this.randomGroupsForDisplay();
    const grid = this.randomTrackGrid(groups.length);
    groups.slice(grid.firstItem, grid.firstItem + grid.cells.length)
      .forEach((group, index) => {
        const rectangle = grid.cells[index]!;
        const id = `random:${group.id}`;
        this.addHit({ id, kind: "random", value: group.id, rect: rectangle });
        const state = this.buttonState(id);
        const card = this.assets.randomCards?.get(group.cardToken);
        if (card) drawImage(this.context, card,
          { x: rectangle.x, y: rectangle.y, width: rectangle.width,
            height: card.height * rectangle.width / card.width });
        const cardHeight = card ? card.height * rectangle.width / card.width
          : Math.round(rectangle.height * 0.84);
        const caption = { x: rectangle.x, y: rectangle.y + cardHeight,
          width: rectangle.width, height: rectangle.height - cardHeight };
        const hovered = state === 2;
        const selected = group.id === this.selectedRandomGroupId;
        this.context.fillStyle = hovered ? "rgb(188, 255, 77)" : "rgb(245, 245, 245)";
        this.context.fillRect(caption.x, caption.y, caption.width, caption.height);
        this.context.strokeStyle = hovered || selected
          ? "rgb(154, 224, 35)" : "rgb(50, 50, 50)";
        this.context.lineWidth = hovered || selected ? 4 : 2;
        this.context.strokeRect(rectangle.x + this.context.lineWidth / 2,
          rectangle.y + this.context.lineWidth / 2,
          rectangle.width - this.context.lineWidth,
          rectangle.height - this.context.lineWidth);
        this.paintText(randomCardTitle(group), caption, 16,
          hovered ? "rgb(81, 131, 0)" : "rgb(21, 29, 44)", "center");
      });
    this.drawRandomDescription();
  }

  drawRandomDescription(): void {
    const hoveredId = this.hovered?.startsWith("random:")
      ? this.hovered.slice(7) : undefined;
    const group = hoveredId && this.options.randomGroups?.find(item => item.id === hoveredId);
    const background = this.assets.randomDescriptionBackground;
    if (!group || !background || !hasRandomDescription(group)) return;
    const hit = this.hits.find(item => item.kind === "random" && item.value === group.id);
    if (!hit) return;
    const tracks = (group.displayTrackIds ?? group.trackIds).map(id =>
      this.options.randomTrackNames?.get(id) ??
      this.options.tracks.find(track => track.id === id)?.title ?? id);
    const columns = group.randomType === "new" ? 1 : 2;
    const [authoredWidth, authoredHeight] = randomDescriptionSize(
      this.assets.randomDescriptionDefinition, columns);
    const rows = Math.ceil(tracks.length / columns);
    const height = Math.max(authoredHeight,
      40 + rows * RANDOM_DESCRIPTION_LINE_HEIGHT + RANDOM_DESCRIPTION_BOTTOM);
    const x = hit.rect.x + hit.rect.width + authoredWidth <= WIDTH
      ? hit.rect.x + hit.rect.width : hit.rect.x - authoredWidth;
    const y = Math.max(0, Math.min(HEIGHT - height, hit.rect.y));
    const rectangle = { x, y, width: authoredWidth, height };
    drawNineSlice(this.context, background, rectangle);
    if (this.assets.randomDescriptionTitle)
      drawNineSlice(this.context, this.assets.randomDescriptionTitle,
        { x, y, width: authoredWidth, height: 32 });
    this.paintText(randomCardTitle(group),
      { x: x + 12, y: y + 4, width: authoredWidth - 24, height: 30 },
      14, "yellow", "center");
    tracks.forEach((title, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      this.paintText(title,
        { x: x + 15 + column * 220,
          y: y + 40 + row * RANDOM_DESCRIPTION_LINE_HEIGHT,
          width: 210, height: RANDOM_DESCRIPTION_LINE_HEIGHT },
        14, "white", "left");
    });
  }

  drawTrackCard(track: TrackPickerTrack, rectangle: UiRectangle): void {
    const authored = this.assets.cardDefinition;
    const [left, top, right, bottom] = parseNumbers(
      attribute(authored, "trackRect"), 4, "trackRect");
    const card = { x: rectangle.x + left!, y: rectangle.y + top!,
      width: right! - left!, height: bottom! - top! };
    const preview = this.cardTextures.get(track.id);
    if (preview) drawFittedCard(this.context, preview, card);
    const state = this.buttonState(`track:${track.id}`);
    drawImage(this.context, this.assets.cardFrame[state - 1]!, rectangle);
    if (track.id === this.selectedTrackId)
      drawImage(this.context, this.assets.selectedCard,
        this.dependencies.layoutRect(childNode(authored, "selectTrackThumbBG"), rectangle));
    if (track.reverse === true) this.drawReverseStamp(rectangle);
    const difficulty = childNode(authored, "difficulty");
    const labelRect = this.dependencies.layoutRect(difficulty, rectangle,
      undefined, this.assets.difficultyLabel);
    drawImage(this.context, this.assets.difficultyLabel, labelRect);
    this.drawDifficulty(track.difficulty, rectangle);
    this.paintText(track.title,
      { ...card, height: card.height + 28 }, 16,
      state === 2 ? "rgb(81, 131, 0)" : "rgb(21, 29, 44)",
      "center", "bottom");
    this.drawFavoriteCheck(track.id, rectangle);
  }

  drawReverseStamp(rectangle: UiRectangle): void {
    const template = this.assets.cardDefinition;
    const [,, templateWidth] = parseNumbers(
      attribute(template, "windowRect"), 4, "windowRect");
    const [offsetX, offsetY] = parseNumbers(
      attribute(template, "smallSpecialMarkAdjust"), 2,
      "smallSpecialMarkAdjust");
    const image = this.assets.reverseStamp;
    const scale = templateWidth === 0 ? 1 : rectangle.width / templateWidth!;
    drawImage(this.context, image, {
      x: rectangle.x + offsetX! * scale, y: rectangle.y + offsetY! * scale,
      width: image.width * scale, height: image.height * scale,
    });
  }

  drawFavoriteCheck(trackId: string, rectangle: UiRectangle): void {
    const area = this.dependencies.layoutRect(
      childNode(this.assets.cardDefinition, "favoriteTrackCheck"), rectangle);
    const state = this.favoriteState(trackId);
    drawCenteredImage(this.context,
      this.assets.favoriteMark[state === 5 ? 0 : state]!, area);
    this.addHit({ id: `favorite:${trackId}`, kind: "favorite",
      value: trackId, rect: area });
  }

  favoriteState(trackId: string): number {
    return this.favoriteStates.get(trackId) ??
      Number(this.options.favoriteTrackIds.has(trackId));
  }

  drawDifficulty(difficulty: number, rectangle: UiRectangle): void {
    const node = childNode(this.assets.cardDefinition, "difficulty");
    const digits = childNode(node, "difficultyChar");
    const area = this.dependencies.layoutRect(digits,
      this.dependencies.layoutRect(node, rectangle, undefined,
        this.assets.difficultyLabel));
    const [charWidth, charHeight] = parseNumbers(
      attribute(digits, "fontSize"), 2, "fontSize");
    const stride = charWidth! + Number(attribute(digits, "spaceOffset"));
    const font = attribute(digits, "fontStr")!;
    for (let index = 0; index < 6; index++) {
      const sourceX = font.indexOf(index < difficulty ? "1" : "0") * charWidth!;
      drawCroppedImage(this.context, this.assets.difficulty,
        [sourceX, 0, sourceX + charWidth!, charHeight!],
        { x: area.x + index * stride, y: area.y,
          width: charWidth!, height: charHeight! });
    }
  }

  drawButtons(dialog: UiRectangle): void {
    this.drawTextButton("confirm", this.assets.strings.get("select") ?? "确认", dialog);
    this.drawTextButton("cancel", this.assets.strings.get("cancel") ?? "取消", dialog);
    const close = this.node("selectTrackEx").children.find(node =>
      node.name === "ImageButton" && attribute(node, "name") === "cancel")!;
    const rectangle = this.windows.get(close)!;
    drawCenteredImage(this.context,
      this.assets.closeButton[this.buttonState("close") - 1]!, rectangle);
    this.addHit({ id: "close", kind: "cancel", rect: rectangle });
  }

  drawTextButton(id: string, text: string, dialog: UiRectangle): void {
    const button = this.assets.buttons.get(id)!;
    const state = button.style.states[this.buttonState(id) - 1]!;
    const rectangle = this.dependencies.layoutRect(button.definition, dialog, state.frame);
    this.dependencies.paintFrame(this.context, state.frame,
      this.assets.textButtonFrame.image, rectangle);
    this.paintText(text, this.dependencies.frameClient(state.frame, rectangle),
      Number(state.textRender.slice(4)), state.textColor,
      "center", "center", "button");
    this.addHit({ id, kind: id, rect: rectangle });
  }

  filteredTracks(): TrackPickerTrack[] {
    return filteredTracks(this as unknown as Parameters<typeof filteredTracks>[0]) as TrackPickerTrack[];
  }

  randomGroupsForDisplay(): TrackPickerRandomGroup[] {
    return randomGroupsForDisplay(this as unknown as Parameters<typeof randomGroupsForDisplay>[0]) as TrackPickerRandomGroup[];
  }

  gameTypeEnabled(candidate: { gameType: string }): boolean {
    return gameTypeEnabled(this, candidate);
  }

  loadVisibleCards(): void {
    if (this.selectedTheme === "1024") return;
    this.filteredTracks()
      .slice(this.trackOffset, this.trackOffset + this.pageSize("thumbList"))
      .forEach(track => {
        if (this.cardTextures.has(track.id) || this.loadingCards.has(track.id)) return;
        this.loadingCards.add(track.id);
        this.dependencies.loadTrackCard(this.options.library, track.path)
          .then(image => {
            this.cardTextures.set(track.id, image);
            this.render();
          })
          .catch(error => this.options.onError?.(error))
          .finally(() => this.loadingCards.delete(track.id));
      });
  }

  resizeCanvas(): void {
    const bounds = this.options.root.getBoundingClientRect();
    this.dependencies.configureCanvas(this.canvas, this.context,
      bounds.width, bounds.height, this.dependencies.pixelRatio(),
      WIDTH, HEIGHT, 1600, 900);
  }

  dialogRect(): UiRectangle {
    return this.rect("selectTrackEx");
  }

  node(name: string): TrackPickerWindowNode {
    return childNode(this.assets.definition, name, this.assets.radioDefinition);
  }

  rect(name: string): UiRectangle {
    return this.windows.get(this.node(name))!;
  }

  pageSize(name: string): number {
    return gridPageSize(gridLayoutConfig(this.node(name)));
  }

  gridStep(name: string): number {
    return gridStepSize(gridLayoutConfig(this.node(name)));
  }

  gridLayout(name: string, cellNode: TrackPickerWindowNode,
    itemCount: number, offset: number): GridLayout {
    const config = gridLayoutConfig(this.node(name));
    const viewport = this.rect(name);
    return gridLayout(config, viewport,
      this.dependencies.layoutRect(cellNode, viewport),
      itemCount, offset / gridStepSize(config));
  }

  themeGrid(): GridLayout {
    return this.gridLayout("selectTheme", this.assets.themeDefinition,
      this.assets.themes.length, this.themeOffset);
  }

  trackGrid(count: number): GridLayout {
    return this.gridLayout("thumbList", this.assets.cardDefinition,
      count, this.trackOffset);
  }

  drawScrollbar(id: string, grid: GridLayout, position: number): void {
    const skin = this.assets.scrollbars.get(id)!;
    const controller = this.scrollbarInteractions.get(id)!;
    const geometry = controller.layout(skin, this.rect(id),
      grid.positionCount, position);
    if (grid.positionCount <= 1) return;
    this.dependencies.paintFrame(this.context, skin.areaFrame,
      this.assets.frame.image, geometry.area);
    this.dependencies.paintFrame(this.context,
      skin.buttonFrames[controller.buttonState]!,
      this.assets.frame.image, geometry.button);
  }

  drawLabel(node: TrackPickerWindowNode, rectangle: UiRectangle): void {
    const text = attribute(node, "text")!;
    const translated = /^#sb\(([^)]+)\)$/.exec(text)?.[1];
    const label = translated === undefined ? text : this.assets.strings.get(translated) ?? text;
    const alignment = /(?:^|[;\s])(?:hcenter|center)(?:$|[;\s])/.test(
      attribute(node, "textAlign") ?? "") ? "center" : "left";
    this.paintText(label, rectangle, labelSize(node),
      windowColor(attribute(node, "textColor")), alignment);
  }

  positionSearch(): void {
    const rectangle = this.rect("searchEdit");
    this.dependencies.positionControl(this.search, rectangle,
      this.options.root.clientWidth / WIDTH,
      this.options.root.clientHeight / HEIGHT);
  }

  buttonState(id: string): number {
    return (this.hovered === id ? this.pressed === id ? 2 : 1 : 0) + 1;
  }

  addHit(hit: TrackPickerHit): void {
    this.hits = [...this.hits, hit];
  }

  hitAt(event: PointerEvent): TrackPickerHit | undefined {
    const point = this.eventPoint(event);
    return [...this.hits].reverse().find(hit => containsPoint(point, hit.rect));
  }

  eventPoint(event: MouseEvent): { x: number; y: number } {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) * WIDTH) / bounds.width,
      y: ((event.clientY - bounds.top) * HEIGHT) / bounds.height,
    };
  }

  activate(hit: TrackPickerHit): void {
    if (hit.kind === "cancel") return this.options.onCancel();
    if (hit.kind === "confirm") return this.confirm();
    if (hit.kind === "theme") return this.selectTheme(hit.value!);
    if (hit.kind === "favorite") return this.activateFavorite(hit.value!);
    if (hit.kind === "track") {
      this.selectedRandomGroupId = undefined;
      this.selectedTrackId = hit.value;
      this.render();
      return;
    }
    if (hit.kind === "random") {
      this.selectedRandomGroupId = hit.value;
      this.render();
      return;
    }
    this.toggleGameType(hit.kind);
  }

  activateFavorite(trackId: string): void {
    const state = this.favoriteState(trackId);
    if (![2, 3].includes(state)) return;
    const messageId = this.changeFavorite(trackId, state === 2);
    this.favoriteStates.set(trackId,
      Number(this.options.favoriteTrackIds.has(trackId)));
    const track = this.options.tracks.find(candidate => candidate.id === trackId)!;
    this.showFavoriteNotice(messageId, track.title);
    if (this.selectedTheme === "favorite") this.selectTheme("favorite");
    else this.render();
  }

  changeFavorite(trackId: string, favorite: boolean): string {
    return changeFavoriteTrack(this as unknown as TrackPickerActionHost,
      trackId, favorite);
  }

  showFavoriteNotice(messageId: string, trackName: string): void {
    const message = this.assets.strings.get(messageId)!.replace("%s", trackName);
    const notice = this.assets.notice;
    const base = this.dependencies.noticeLayout(notice.definition, notice.frame);
    const lines = this.wrapNoticeText(message, base.message.width);
    const lineHeight = this.dependencies.measureText(this.context, "",
      { family: FONT_FAMILY, size: 16 }).height;
    const layout = this.dependencies.noticeLayout(notice.definition, notice.frame,
      (lines.length - 1) * lineHeight);
    this.options.onNotice(layout.window, message,
      context => this.dependencies.paintNotice(context, notice, layout,
        this.assets.strings.get("notice"), lines, FONT_FAMILY));
  }

  private wrapNoticeText(message: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let current = "";
    let width = 0;
    for (const character of message) {
      const charWidth = this.dependencies.measureText(this.context, character,
        { family: FONT_FAMILY, size: 16 }).width;
      if (width + charWidth > maxWidth) {
        lines.push(current); current = ""; width = 0;
      }
      if (current.length === 0 && character === " ") continue;
      current += character; width += charWidth;
    }
    lines.push(current);
    return lines;
  }

  moveFavorite(hit?: TrackPickerHit): void {
    if (this.hovered === hit?.id) return;
    this.leaveFavorite();
    if (hit?.kind === "favorite" && this.favoriteState(hit.value!) === 0)
      this.favoriteStates.set(hit.value!, 5);
  }

  leaveFavorite(): void {
    if (!this.hovered?.startsWith("favorite:")) return;
    const trackId = this.hovered.slice(9);
    if (this.favoriteState(trackId) !== 1)
      this.favoriteStates.set(trackId, 0);
  }

  pressFavorite(hit: TrackPickerHit): void {
    if (hit.kind !== "favorite") return;
    const state = this.favoriteState(hit.value!);
    this.favoriteStates.set(hit.value!, state === 1 ? 3 : 2);
  }

  confirm(): void {
    confirmTrackSelection(this as unknown as TrackPickerActionHost);
  }

  selectTheme(theme: string): void {
    selectTrackTheme(this as unknown as TrackPickerActionHost, theme);
  }

  toggleGameType(gameType: string): void {
    toggleTrackGameType(this as unknown as TrackPickerActionHost, gameType);
  }

  remapRandomSelection(gameType: string): void {
    const group = matchingRandomGroup(this.options.randomGroups,
      this.selectedRandomGroupId, gameType);
    if (group) this.selectedRandomGroupId = group.id;
  }

  private stringPosition(node: TrackPickerWindowNode,
    rectangle: UiRectangle): UiRectangle {
    const [dx, dy] = parseNumbers(attribute(node, "stringPos"), 2, "stringPos");
    return { ...rectangle, x: rectangle.x + dx!, y: rectangle.y + dy!,
      width: rectangle.width - dx!, height: rectangle.height - dy! };
  }

  readonly onPointerMove = (event: PointerEvent): void => {
    if (this.touchSwipe.isActive(event.pointerId)) {
      this.touchSwipe.move(event.pointerId, event.clientY);
      return;
    }
    if (this.activeScrollbar) {
      this.activeScrollbar.move(this.eventPoint(event), (event.buttons & 1) !== 0);
      return;
    }
    const hit = this.hitAt(event);
    this.moveFavorite(hit);
    const id = hit?.id;
    if (id !== this.hovered) {
      this.hovered = id;
      this.render();
    }
  };

  readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.beginScrollbar(event) || this.beginTouchSwipe(event)) return;
    const hit = this.hitAt(event);
    if (!hit) return;
    this.options.onInteraction?.();
    this.moveFavorite(hit);
    this.pressFavorite(hit);
    this.pressed = hit.id;
    this.hovered = hit.id;
    this.canvas.setPointerCapture(event.pointerId);
    this.render();
  };

  readonly onPointerUp = (event: PointerEvent): void => {
    if (this.touchSwipe.isActive(event.pointerId)) return this.finishTouchSwipe(event);
    if (this.finishScrollbar(event)) return;
    const hit = this.hitAt(event);
    const activated = hit?.id === this.pressed ? hit : undefined;
    this.pressed = undefined;
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
    if (activated) this.activate(activated);
    else this.render();
  };

  readonly onPointerCancel = (event: PointerEvent): void => {
    if (this.touchSwipe.isActive(event.pointerId)) {
      this.touchSwipe.finish(event.pointerId);
      this.touchSwipeBar = undefined;
      if (this.canvas.hasPointerCapture(event.pointerId))
        this.canvas.releasePointerCapture(event.pointerId);
      this.render();
      return;
    }
    if (!this.finishScrollbar(event)) {
      this.pressed = undefined;
      if (this.canvas.hasPointerCapture(event.pointerId))
        this.canvas.releasePointerCapture(event.pointerId);
      this.render();
    }
  };

  readonly onPointerLeave = (): void => {
    this.activeScrollbar?.leave();
    this.leaveFavorite();
    this.hovered = undefined;
    this.render();
  };

  readonly onWheel = (event: WheelEvent): void => {
    const point = this.eventPoint(event);
    const direction = Math.sign(event.deltaY);
    if (direction === 0) return;
    let id: string;
    if (this.overThemes(point)) id = "selectThemeListBar";
    else if (this.overTracks(point)) id = "thumbListBar";
    else return;
    // The release omits stepPixels so scrollPosition uses the bar's own height.
    if (this.scrollbarInteractions.get(id)!.wheel(direction,
      undefined as unknown as number)) event.preventDefault();
  };

  overThemes(point: { x: number; y: number }): boolean {
    return containsPoint(point, this.themeGrid().rect) ||
      containsPoint(point, this.rect("selectThemeListBar"));
  }

  overTracks(point: { x: number; y: number }): boolean {
    return containsPoint(point, this.rect("contentFrame")) ||
      containsPoint(point, this.selectedTheme === "1024"
        ? this.randomTrackGrid(this.visibleTrackCount()).rect
        : this.trackGrid(this.visibleTrackCount()).rect);
  }

  visibleTrackCount(): number {
    return this.selectedTheme === "1024"
      ? this.randomGroupsForDisplay().length : this.filteredTracks().length;
  }

  searchTracks(query: string): void {
    searchTracks(this as unknown as TrackPickerActionHost, query);
  }

  commitSearch(): void {
    commitTrackSearch(this as unknown as TrackPickerActionHost);
  }

  beginScrollbar(event: PointerEvent): boolean {
    const point = this.eventPoint(event);
    const scrollbar = [...this.scrollbarInteractions.values()]
      .find(controller => controller.down(point));
    if (!scrollbar) return false;
    this.activeScrollbar = scrollbar;
    this.options.onInteraction?.();
    this.canvas.setPointerCapture(event.pointerId);
    return true;
  }

  beginTouchSwipe(event: PointerEvent): boolean {
    if (event.pointerType !== "touch") return false;
    const point = this.eventPoint(event);
    const scrollbar = this.overThemes(point)
      ? this.scrollbarInteractions.get("selectThemeListBar")
      : this.overTracks(point)
        ? this.scrollbarInteractions.get("thumbListBar") : undefined;
    if (!scrollbar) return false;
    this.touchSwipeBar = scrollbar;
    this.touchSwipe.begin(event.pointerId, event.clientY);
    this.options.onInteraction?.();
    this.canvas.setPointerCapture(event.pointerId);
    return true;
  }

  finishTouchSwipe(event: PointerEvent): void {
    const moved = this.touchSwipe.finish(event.pointerId);
    this.touchSwipeBar = undefined;
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
    if (moved) return this.render();
    const hit = this.hitAt(event);
    if (hit) this.activate(hit);
    else this.render();
  }

  finishScrollbar(event: PointerEvent): boolean {
    if (!this.activeScrollbar) return false;
    this.activeScrollbar.up();
    this.activeScrollbar = undefined;
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
    return true;
  }

  resetTrackScrollbar(): void {
    this.scrollbarInteractions.get("thumbListBar")!.reset();
    this.activeScrollbar = undefined;
    this.favoriteStates.clear();
  }

  readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      this.options.onCancel();
    } else if (event.key === "Enter") {
      if (event.isComposing) return;
      event.preventDefault();
      this.commitSearch();
    }
  };

  randomTrackGrid(count: number): GridLayout {
    const rectangle = this.rect("thumbList");
    const card = this.assets.randomCards?.values().next().value;
    const cardWidth = card?.width ?? 281;
    const cardHeight = (card?.height ?? 164) + 31;
    const gap = 10;
    const columns = 4;
    const rows = Math.min(3, Math.ceil(count / columns));
    const totalWidth = columns * cardWidth + (columns - 1) * gap;
    const totalHeight = Math.max(1, rows) * cardHeight +
      (Math.max(1, rows) - 1) * gap;
    const firstItem = Math.min(this.trackOffset, Math.max(0, count - 1));
    const cells = Array.from({ length: Math.max(0,
      Math.min(count - firstItem, columns * 3)) }, (_, index) => ({
      x: rectangle.x + Math.max(0, Math.floor((rectangle.width - totalWidth) / 2)) +
        (index % columns) * (cardWidth + gap),
      y: rectangle.y + Math.max(0, Math.floor((rectangle.height - totalHeight) / 2)) +
        Math.floor(index / columns) * (cardHeight + gap),
      width: cardWidth, height: cardHeight,
    }));
    return { rect: rectangle, cells, firstItem, positionCount: 1 };
  }
}

export function createTrackPickerWindowClass(dependencies: TrackPickerWindowDependencies):
  typeof TrackPickerWindow {
  return class extends TrackPickerWindow {
    static override dependencies = dependencies;
  };
}
