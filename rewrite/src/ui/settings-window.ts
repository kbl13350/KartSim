/** The P3528 settings dialog: BML drawing, keyboard capture and DOM controls. */

import { ScrollbarController, type UiRectangle } from "./scrollbar";
import type {
  SettingsWindowAssets, SettingsWindowButtonStyle, SettingsWindowFrame,
  SettingsWindowImage, SettingsWindowNode, SettingsWindowResource,
  SettingsWindowResourceLibrary,
} from "./settings-window-assets";
import {
  activateSettingsControl, applySettingsGraphicsPreset, applySettingsPreset,
  changeSettingsVolume, closeSettingsCombo, moveSettingsSelection,
  repeatSettingsVolumeStep, resetSettingsSound, selectSettingsSpeed,
  selectSettingsVersion, setSettingsRoomSpeed, stepSettingsVolume,
  stopSettingsVolumePointer, toggleSettingsCombo, toggleSettingsOption,
  type SettingsDraft, type SettingsInteractionDependencies,
  type SettingsInteractionHost,
} from "./settings-interactions";

export type SettingsNode = SettingsWindowNode;
export type SettingsFrame = SettingsWindowFrame;
export type SettingsImage = SettingsWindowImage;
export type SettingsButtonStyle = SettingsWindowButtonStyle;
export type SettingsAssets = SettingsWindowAssets;
export type SettingsResource = SettingsWindowResource;

export interface SettingsLibrary extends SettingsWindowResourceLibrary {
  exactCanonicalCandidates(path: string): SettingsWindowResource[];
}

export interface SettingsChoice {
  speed: number;
  available: boolean;
  unavailableReason?: string;
}

export interface SettingsBgmChoice {
  id: number;
  label: string;
  path: string;
}

export interface SettingsWindowDraft extends SettingsDraft {
  keyMap: Record<number, number>;
  gamepadMap: Record<number, string>;
}

export interface SettingsWindowOptions {
  root: HTMLElement;
  library: SettingsLibrary;
  initial: SettingsWindowDraft;
  initialSpeed: number;
  initialVersion?: string;
  speedLocked?: boolean;
  onActivate(): void;
  onPreview(draft: SettingsWindowDraft): void;
  onConfirm(draft: SettingsWindowDraft, speed: number, version: string): void;
  onCancel(): void;
}

export interface SettingsWindowDependencies {
  loadAssets(library: SettingsLibrary): Promise<SettingsAssets>;
  parseBgmChoices(bgmListXml: string, stringBagXml: string): SettingsBgmChoice[];
  releaseFont(font: unknown): void;
  configureCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D,
    width: number, height: number, ratio: number,
    logicalWidth: number, logicalHeight: number): void;
  pixelRatio(): number;
  layoutRect(node: SettingsNode, viewport: UiRectangle, frame?: SettingsFrame,
    textureSize?: SettingsImage, override?: Partial<UiRectangle>): UiRectangle;
  clientRect(frame: SettingsFrame, rectangle: UiRectangle): UiRectangle;
  captionPosition(node: SettingsNode, config: SettingsNode): { x: number; y: number };
  captionRect(frame: SettingsFrame, rectangle: UiRectangle,
    position: { x: number; y: number }): UiRectangle;
  measureText(context: CanvasRenderingContext2D, text: string,
    style: { family: string; size: number }): { width: number; height: number };
  paintText(context: CanvasRenderingContext2D, text: string, rectangle: UiRectangle,
    style: { family: string; size: number; kind: string; color: string;
      align: "left" | "center" | "right";
      verticalAlign: "top" | "center" | "bottom" }): void;
  paintFrame(context: CanvasRenderingContext2D, frame: SettingsFrame,
    image: HTMLCanvasElement, rectangle: UiRectangle): void;
  keyboardLabel(code: number): string;
  gamepadLabel(code: string | undefined): string;
  gamepadButtons(gamepads: (Gamepad | null)[]): Set<string>;
  validGamepadCode(code: string): boolean;
  usedGamepadCode(map: Record<number, string>, index: number, code: string): boolean;
  browserKeyCode(code: string): number;
  validKeyCode(code: number): boolean;
  tabs: readonly string[];
  versions: readonly string[];
  defaultVersion: string;
  versionStatus(version: string): { available: boolean; unavailableReason?: string };
  speedChoices(version: string): SettingsChoice[];
  fallbackSpeed(version: string): SettingsChoice | undefined;
  speedChannel(version: string, speed: number): SettingsChoice | undefined;
  channelText(choice: SettingsChoice, translate: (key: string) => string): string;
  keyActions: Array<{ index: number }>;
  defaultKeyMap: Record<number, number>;
  dialogShortcuts: Record<string, string>;
  defaultSound: SettingsInteractionDependencies["defaultSound"];
}

const UI_BOUNDS: UiRectangle = { x: 0, y: 0, width: 1600, height: 900 };
const FONT_FAMILY = "P3528 Settings";
const KEY_ROW_HEIGHT = 21;
const INK = "rgb(42,55,80)";
const DISABLED_INK = "#bfbfbf";
const SPEED_VERSION = "raceSpeedVersion";
const SPEED_CHANNEL = "raceSpeedChannel";
const SPEED_HINT = "raceSpeedHint";
const CHECK_FIELDS: Record<string, string> = {
  bgmMute: "bgmEnabled", fxMute: "fxEnabled", enableRoadSound: "enableRoadSound",
  verticalSync: "verticalSync", boostBlur: "boostBlur",
  setDualBoostAuto: "dualBoostAuto", toonLine: "toonLine", shadow: "shadow",
  inGameFlyingPetVisible: "inGameFlyingPetVisible", raceAnonymous: "raceAnonymous",
  raceTimeGap: "raceTimeGap", classicHud: "classicHud", onAutoReady: "autoReady",
};

function attribute(node: SettingsNode, name: string): string | undefined {
  return node.attributes.find(entry => entry.name === name)?.value;
}

function fontSize(render: string): number {
  return Number(/\d+$/.exec(render)?.[0] ?? 16);
}

function color(value: string): string {
  if (!value.includes(" ")) return value;
  const [alpha, red, green, blue] = value.split(/\s+/).map(Number);
  return `rgba(${red},${green},${blue},${alpha! / 255})`;
}

function pressedState(id: string, hovered?: string, pressed?: string): number {
  return hovered !== id ? 0 : pressed === id ? 2 : 1;
}

function volumeThumb(value: number): number {
  return Math.trunc(Math.fround(Math.fround(182 * Math.fround(value * 4778)) / 5000));
}

function volumeGeometry(rectangle: UiRectangle, value: number): {
  area: UiRectangle; thumb: UiRectangle;
} {
  const area = { ...rectangle, x: rectangle.x + 20, width: 182 };
  return { area,
    thumb: { x: area.x + volumeThumb(value), y: rectangle.y - 3, width: 8, height: 20 } };
}

function repeatedKeyIndex(index: number): number {
  return index >= 10 && index <= 17 ? index - 10 : index;
}

function staticCheckState(name: string): boolean {
  return ["dispIngameStressMirror", "itemStateNotice", "itemStateTotalNotice",
    "dispIngameName", "dispIngameItemInfoCard", "dispIngameTeamColor"].includes(name);
}

function graphicsPreset(draft: SettingsWindowDraft): string {
  return draft.boostBlur || draft.toonLine !== draft.shadow
    ? "userMachine" : draft.toonLine ? "normMachine" : "poorMachine";
}

function omitNode(node: SettingsNode): boolean {
  return node.name === "Skip" ||
    ["disabled", "cancelButton", "errorButton"].includes(attribute(node, "name") ?? "");
}

export class SettingsWindow {
  static dependencies: SettingsWindowDependencies;
  readonly element = document.createElement("div");
  readonly canvas = document.createElement("canvas");
  readonly errorElement = document.createElement("div");
  readonly controls = new Map<string, HTMLElement>();
  readonly renderedControls = new Set<HTMLElement>();
  readonly previousFocus = document.activeElement;
  readonly keyScroll = new ScrollbarController(() => this.render());
  readonly context: CanvasRenderingContext2D;
  readonly resizeObserver: ResizeObserver;
  draft: SettingsWindowDraft;
  tab: string;
  hovered?: string;
  pressed?: string;
  volumeRepeat?: ReturnType<typeof setTimeout>;
  volumeDrag?: { field: string; area: UiRectangle; grab: number };
  keyChanges: Record<number, number> = {};
  keyFocus?: number;
  cursorVisible = true;
  cursorTimer?: ReturnType<typeof setInterval>;
  keyViewport?: UiRectangle;
  keyError?: string;
  keyErrorLines: string[] = [];
  raceSpeed: number;
  raceVersion: string;
  openCombo?: string;
  speedCombo?: { rect: UiRectangle; client: UiRectangle };
  versionCombo?: { rect: UiRectangle; client: UiRectangle };
  bgmCombo?: { rect: UiRectangle; client: UiRectangle };
  bgmOffset = 0;
  bgmChoices: SettingsBgmChoice[] = [];
  gamepadPoll?: ReturnType<typeof setInterval>;
  gamepadHeld = new Set<string>();
  readonly onWindowResize = () => this.render();
  readonly onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    this.handleKeyDown(event);
  };

  constructor(readonly options: SettingsWindowOptions,
    readonly assets: SettingsAssets,
    readonly dependencies: SettingsWindowDependencies =
      (new.target as typeof SettingsWindow).dependencies) {
    if (!dependencies) throw new Error("设置窗口缺少运行依赖。");
    this.draft = { ...options.initial };
    this.raceSpeed = options.initialSpeed;
    this.raceVersion = options.initialVersion ?? dependencies.defaultVersion;
    this.tab = dependencies.tabs[0]!;
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法创建设置窗口 Canvas。");
    this.context = context;

    Object.assign(this.element.style, { position: "absolute", inset: "0" });
    this.element.dataset.uiLayer = "dialog";
    Object.assign(this.canvas.style, { width: "100%", height: "100%" });
    this.canvas.setAttribute("aria-hidden", "true");
    this.element.setAttribute("role", "dialog");
    this.element.setAttribute("aria-modal", "true");
    this.element.setAttribute("aria-label", this.text("#sb(option)"));
    this.element.tabIndex = -1;
    this.canvas.addEventListener("pointerdown", () => {
      this.closeCombo();
      this.element.focus();
    });
    this.element.addEventListener("focusin", event => {
      const index = (event.target as HTMLElement).dataset.keyIndex;
      this.focusKey(index === undefined ? undefined : Number(index));
    });
    this.element.addEventListener("keydown", this.onKeyDown);
    this.element.addEventListener("wheel", event => this.onWheel(event), { passive: false });
    this.element.append(this.canvas);
    Object.assign(this.errorElement.style,
      { position: "absolute", inset: "0", pointerEvents: "none" });
    this.errorElement.setAttribute("role", "alertdialog");
    this.errorElement.setAttribute("aria-modal", "true");
    this.errorElement.setAttribute("aria-label", this.text("#sb(gameKeyMap)"));
    this.element.append(this.errorElement);
    options.root.append(this.element);
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(options.root);
    window.addEventListener("resize", this.onWindowResize);
    this.render();
    this.controls.get("ok")?.focus();
  }

  private onWheel(event: WheelEvent): void {
    if (this.openCombo === "bgm") {
      event.preventDefault();
      this.bgmOffset = Math.max(0, Math.min(
        Math.max(0, this.bgmChoices.length + 1 - 8),
        this.bgmOffset + (event.deltaY > 0 ? 1 : -1)));
      this.render();
      return;
    }
    if (this.tab === this.dependencies.tabs[2] && !this.keyError) {
      event.preventDefault();
      this.keyScroll.wheel(event.deltaY < 0 ? -1 : 1, 30, true);
    }
  }

  static async load(options: SettingsWindowOptions): Promise<SettingsWindow> {
    const dependencies = this.dependencies;
    const assets = await dependencies.loadAssets(options.library);
    try {
      const chineseList = options.library.exactCanonicalCandidates(
        "zeta_/cn/content/bgmList.xml")[0];
      const stringBag = options.library.exactCanonicalCandidates("etc_/bgmList.xml")[0];
      let bgmChoices: SettingsBgmChoice[] = [];
      if (chineseList && stringBag) {
        const [listBytes, bagBytes] = await Promise.all([
          chineseList.bytes(), stringBag.bytes()]);
        const decode = (bytes: Uint8Array) => new TextDecoder(
          bytes[0] === 255 ? "utf-16le" : "utf-8").decode(bytes);
        bgmChoices = dependencies.parseBgmChoices(decode(listBytes), decode(bagBytes))
          .filter(choice => options.library.exactCanonicalCandidates(choice.path).length === 1);
      }
      const view = new this(options, assets, dependencies);
      view.bgmChoices = bgmChoices;
      const chosenIndex = bgmChoices.findIndex(
        choice => choice.path === view.draft.mainMenuBgmPath);
      view.bgmOffset = Math.max(0, chosenIndex - 3);
      view.render();
      return view;
    } catch (error) {
      dependencies.releaseFont(assets.font);
      throw error;
    }
  }

  dispose(): void {
    this.stopVolumePointer();
    clearInterval(this.cursorTimer);
    clearInterval(this.gamepadPoll);
    this.keyScroll.dispose();
    this.resizeObserver.disconnect();
    window.removeEventListener("resize", this.onWindowResize);
    this.element.remove();
    this.dependencies.releaseFont(this.assets.font);
    if (this.previousFocus instanceof HTMLElement) this.previousFocus.focus();
  }

  render(): void {
    const bounds = this.element.getBoundingClientRect();
    this.dependencies.configureCanvas(this.canvas, this.context,
      bounds.width, bounds.height, this.dependencies.pixelRatio(),
      UI_BOUNDS.width, UI_BOUNDS.height);
    this.context.clearRect(0, 0, 1600, 900);
    this.context.imageSmoothingEnabled = true;
    this.renderedControls.clear();
    this.speedCombo = undefined;
    this.versionCombo = undefined;
    this.bgmCombo = undefined;
    this.drawNode(this.assets.definition, UI_BOUNDS);
    this.errorElement.hidden = !this.keyError;
    if (this.keyError) this.drawNode(this.assets.keyMessageBox, UI_BOUNDS);
    this.controls.forEach(control => {
      control.hidden = !this.renderedControls.has(control);
    });
    if (this.tab === this.dependencies.tabs[0] || this.tab === this.dependencies.tabs[1]) {
      this.drawSpeedMenu();
      this.drawVersionMenu();
      this.drawBgmMenu();
    }
  }

  drawNode(node: SettingsNode, parent: UiRectangle, owner?: SettingsNode): void {
    if (!this.visible(node)) return;
    const frameName = attribute(node, "frame") ??
      (node.name === "PlaneCheckButton" ? "DefaultCheckButton" : "");
    const frame = this.assets.frames.get(frameName)?.[0];
    const rectangle = this.nodeRect(node, parent, frame);
    this.drawSelf(node, rectangle, frame, owner);
    const client = frame ? this.dependencies.clientRect(frame, rectangle) : rectangle;
    this.drawChildren(node, client);
    if (node.name === "CaptionWindow") this.drawCaption(node, rectangle, frame!);
  }

  nodeRect(node: SettingsNode, parent: UiRectangle,
    frame?: SettingsFrame): UiRectangle {
    if (node === this.assets.keyMessageBox) return this.keyMessageRect(node, frame);
    const rectangle = this.layoutRect(node, parent, frame, this.labelSize(node));
    return attribute(node, "name") === "keymapContainer"
      ? { ...rectangle, y: rectangle.y - this.keyScroll.contentOffset }
      : rectangle;
  }

  private layoutRect(node: SettingsNode, viewport: UiRectangle,
    frame?: SettingsFrame, labelSize?: { width: number; height: number }): UiRectangle {
    const rectangle = this.dependencies.layoutRect(node, viewport, frame,
      undefined, labelSize);
    const tabIndex = this.dependencies.tabs.indexOf(attribute(node, "name") ?? "");
    return tabIndex < 0 ? rectangle : { ...rectangle,
      x: rectangle.x + tabIndex * rectangle.width };
  }

  labelSize(node: SettingsNode): { width: number; height: number } | undefined {
    if (node.name === "Label" && attribute(node, "autoSizing") === "true")
      return this.dependencies.measureText(this.context,
        this.text(attribute(node, "text") ?? ""),
        { family: FONT_FAMILY, size: fontSize(attribute(node, "textRender") ?? "bold16") });
    return undefined;
  }

  drawChildren(node: SettingsNode, parent: UiRectangle): void {
    if (node.name === "ViewportPanel") {
      this.drawKeyViewport(node, parent);
      return;
    }
    node.children.forEach(child => this.drawNode(child, parent, node));
    const pages = [this.assets.graphics, this.assets.game, this.assets.keyboard];
    if (attribute(node, "name") === "context" && !pages.includes(node))
      this.drawNode(pages[this.dependencies.tabs.indexOf(this.tab)]!, parent);
  }

  drawKeyViewport(node: SettingsNode, rectangle: UiRectangle): void {
    this.keyViewport = rectangle;
    this.context.save();
    this.context.beginPath();
    this.context.rect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
    this.context.clip();
    node.children.forEach(child => this.drawNode(child, rectangle, node));
    this.context.restore();
    this.keyViewport = undefined;
  }

  visible(node: SettingsNode): boolean {
    const name = attribute(node, "name") ?? "";
    if (name.startsWith("view_")) return this.dependencies.tabs.includes(name);
    if (omitNode(node)) return false;
    const overrides: Record<string, boolean> = {
      imgBoostBlurOn: this.draft.boostBlur,
      imgBoostBlurOff: !this.draft.boostBlur,
      imgBoostRefWaveEnable: false,
      imgItemCutOn: true,
      imgAdvanceItemCutEffectOn: false,
      imgBackMirrorCutOn: true,
    };
    return overrides[name] ?? attribute(node, "visible") !== "false";
  }

  drawSelf(node: SettingsNode, rectangle: UiRectangle,
    frame?: SettingsFrame, owner?: SettingsNode): void {
    const painter: Record<string, () => void> = {
      TextButton: () => this.drawButton(node, rectangle),
      ImageButton: () => this.drawImageButton(node, rectangle),
      PlaneCheckButton: () => this.drawCheck(node, rectangle, owner),
      ImageCheckButton: () => this.drawRadio(node, rectangle),
      ScrollBar: () => attribute(node, "name") === "keymapScroll"
        ? this.drawKeyScroll(rectangle) : this.drawVolume(node, rectangle),
      KeyEdit: () => this.drawKeyEdit(node, rectangle),
      ColorLabel: () => this.drawKeyErrorText(rectangle),
      ComboBox: () => this.drawCombo(node, rectangle, frame!),
      Label: () => this.drawLabel(node, rectangle),
    };
    if (painter[node.name]) return painter[node.name]!();
    if (frame) this.drawFrame(frame, rectangle);
    if (node.name === "Panel") this.drawPanel(node, rectangle);
  }

  drawPanel(node: SettingsNode, rectangle: UiRectangle): void {
    const name = attribute(node, "name");
    if (name === "bgmVolumeBar" || name === "fxVolumeBar") return;
    const image = this.assets.images.get(this.panelTexture(node));
    if (image) this.context.drawImage(image.image,
      rectangle.x, rectangle.y, rectangle.width, rectangle.height);
    const fill = attribute(node, "color");
    if (fill) {
      this.context.fillStyle = color(fill);
      this.context.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
    }
  }

  panelTexture(node: SettingsNode): string {
    return attribute(node, "name") === "iconPanel" && this.keyError === "invalidKey"
      ? "대화상자경고" : attribute(node, "texture") ?? "";
  }

  drawCaption(node: SettingsNode, rectangle: UiRectangle, frame: SettingsFrame): void {
    const caption = this.dependencies.captionRect(frame, rectangle,
      this.dependencies.captionPosition(node, this.assets.config));
    const text = node === this.assets.keyMessageBox
      ? "#sb(gameKeyMap)" : attribute(node, "caption") ?? "";
    this.drawText(this.text(text), caption, "bold20", "center", "white", "button");
  }

  drawLabel(node: SettingsNode, rectangle: UiRectangle): void {
    const text = attribute(node, "name") === SPEED_HINT
      ? this.speedChannelHint() : this.text(attribute(node, "text") ?? "");
    this.drawText(text, rectangle, attribute(node, "textRender") ?? "bold16",
      attribute(node, "textAlign") ?? "left",
      color(attribute(node, "textColor") ?? "black"));
  }

  drawButton(node: SettingsNode, rectangle: UiRectangle): void {
    const id = attribute(node, "name") ?? "";
    const enabled = [...this.dependencies.tabs, "ok", "okButton", "cancel",
      "defaultSound", "defaultGraphic", "defaultKeyMap", "poorM", "normM"].includes(id);
    const selected = id === this.tab;
    const state = selected ? 3 : this.state(id, enabled || this.dependencies.tabs.includes(id));
    const style = this.assets.styles.get(node)!.states[state]!;
    this.drawFrame(style.frame, rectangle);
    const text = this.text(attribute(node, "text") ?? id);
    this.drawText(text, this.dependencies.clientRect(style.frame, rectangle),
      style.textRender, attribute(node, "textAlign") ?? "center",
      style.textColor, "button");
    this.button(id, text, rectangle, !enabled, () => {
      this.options.onActivate();
      this.activate(id);
    });
    this.attachMessageButton(id);
    if (this.dependencies.tabs.includes(id))
      this.controls.get(id)?.setAttribute("aria-pressed", String(selected));
  }

  attachMessageButton(id: string): void {
    const control = this.controls.get(id);
    if (id === "okButton" && control?.parentElement !== this.errorElement)
      this.errorElement.append(control!);
  }

  drawImageButton(node: SettingsNode, rectangle: UiRectangle): void {
    const id = attribute(node, "name") ?? "";
    const imagePrefix = attribute(node, "autoLoadImage") ?? "";
    const buttonId = `close-${id}`;
    const image = this.assets.images.get(`${imagePrefix}${this.state(buttonId, true) + 1}`)!;
    this.context.drawImage(image.image,
      rectangle.x + (rectangle.width - image.width) * 0.5,
      rectangle.y + (rectangle.height - image.height) * 0.5);
    this.button(buttonId, this.text("#sb(cancel)"), rectangle, false, () => {
      this.options.onActivate();
      this.options.onCancel();
    });
  }

  drawCheck(node: SettingsNode, rectangle: UiRectangle, owner?: SettingsNode): void {
    const id = attribute(node, "name") ?? "";
    const field = CHECK_FIELDS[id];
    const checked = field ? Boolean(this.draft[field]) : staticCheckState(id);
    this.drawFrame(this.assets.frames.get("DefaultCheckButton")![Number(checked)]!, rectangle);
    const label = [...node.children, ...(owner?.children ?? [])]
      .find(child => child.name === "Label");
    const text = this.text((label && attribute(label, "text")) || id);
    const target = { ...rectangle,
      width: Math.max(rectangle.width, 25 + this.context.measureText(text).width) };
    this.button(id, text, target, !field, () => this.toggle(field!));
    this.controls.get(id)?.setAttribute("aria-pressed", String(checked));
  }

  drawRadio(node: SettingsNode, rectangle: UiRectangle): void {
    const id = attribute(node, "name") ?? "";
    const imagePrefix = attribute(node, "autoImage") ?? "";
    const preset = graphicsPreset(this.draft);
    const image = this.assets.images.get(`${imagePrefix}${id === preset ? 2 : 1}`)!;
    this.context.drawImage(image.image, rectangle.x, rectangle.y);
    const text = this.text(attribute(node.children[0]!, "text") ?? "");
    this.button(id, text, rectangle, !["poorMachine", "normMachine"].includes(id), () => {
      this.options.onActivate();
      this.applyGraphicsPreset(id === "normMachine");
      this.render();
    });
    this.controls.get(id)?.setAttribute("role", "radio");
    this.controls.get(id)?.setAttribute("aria-checked", String(id === preset));
  }

  drawCombo(node: SettingsNode, rectangle: UiRectangle, frame: SettingsFrame): void {
    const id = attribute(node, "name");
    if (id === SPEED_VERSION) return this.drawVersionCombo(rectangle, frame);
    if (id === SPEED_CHANNEL) return this.drawSpeedCombo(rectangle, frame);
    if (id === "mainMenuBgm") return this.drawBgmCombo(rectangle, frame);
    this.drawFrame(frame, rectangle);
    const texts: Record<string, string> = {
      resol: "1600 X 900 (16:9)", windowed: "#sb(windowed)",
      mainMenuBgm: "#sb(defaultBgm)",
    };
    this.drawText(this.text(texts[id ?? ""] ?? ""),
      this.dependencies.clientRect(frame, rectangle), "bold16", "center",
      "#838383", "button");
  }

  drawVersionCombo(rectangle: UiRectangle, frame: SettingsFrame): void {
    this.drawFrame(frame, rectangle);
    const client = this.dependencies.clientRect(frame, rectangle);
    this.versionCombo = { rect: rectangle, client };
    const status = this.dependencies.versionStatus(this.raceVersion);
    this.drawText(this.raceVersion, client, "bold16", "left",
      status.available ? INK : DISABLED_INK, "button");
    this.button(SPEED_VERSION, `速度版本：${this.raceVersion}`, rectangle,
      Boolean(this.options.speedLocked), () => this.toggleCombo("version"));
    this.drawComboRoles(SPEED_VERSION, "version");
  }

  drawSpeedCombo(rectangle: UiRectangle, frame: SettingsFrame): void {
    this.drawFrame(frame, rectangle);
    const client = this.dependencies.clientRect(frame, rectangle);
    this.speedCombo = { rect: rectangle, client };
    const channel = this.raceSpeedChannel();
    const text = channel === undefined ? "—" : this.channelText(channel);
    this.drawText(text, client, "bold16", "left",
      channel?.available ? INK : DISABLED_INK, "button");
    this.button(SPEED_CHANNEL, `速度频道：${text}`, rectangle,
      Boolean(this.options.speedLocked), () => this.toggleCombo("speed"));
    this.drawComboRoles(SPEED_CHANNEL, "speed");
  }

  drawBgmCombo(rectangle: UiRectangle, frame: SettingsFrame): void {
    this.drawFrame(frame, rectangle);
    const client = this.dependencies.clientRect(frame, rectangle);
    this.bgmCombo = { rect: rectangle, client };
    const text = this.bgmChoices.find(choice => choice.path === this.draft.mainMenuBgmPath)
      ?.label ?? (this.draft.mainMenuBgmPath === ""
        ? this.text("#sb(defaultBgm)") : "未找到曲目");
    this.drawText(text, client, "bold16", "left", INK, "button");
    this.button("mainMenuBgm", `主页面音乐：${text}`, rectangle,
      this.bgmChoices.length === 0, () => this.toggleCombo("bgm"));
    this.drawComboRoles("mainMenuBgm", "bgm");
  }

  drawComboRoles(id: string, combo: string): void {
    const control = this.controls.get(id)!;
    control.setAttribute("role", "combobox");
    control.setAttribute("aria-haspopup", "listbox");
    control.setAttribute("aria-expanded", String(this.openCombo === combo));
  }

  drawSpeedMenu(): void {
    if (this.openCombo !== "speed" || !this.speedCombo) return;
    const choices = this.dependencies.speedChoices(this.raceVersion);
    const { rows, list } = this.comboBoxGeometries(this.speedCombo, choices.length);
    this.drawComboListFrame(list);
    choices.forEach((choice, index) => {
      const rectangle = { ...rows, y: rows.y + index * KEY_ROW_HEIGHT,
        height: KEY_ROW_HEIGHT };
      const id = `${SPEED_CHANNEL}-${choice.speed}`;
      this.drawComboRow(id, rectangle, this.channelText(choice), choice.available,
        choice.unavailableReason, () => this.selectSpeed(choice));
      if (choice.available && this.raceSpeed === choice.speed)
        this.controls.get(id)?.setAttribute("aria-selected", "true");
    });
  }

  drawVersionMenu(): void {
    if (this.openCombo !== "version" || !this.versionCombo) return;
    const { rows, list } = this.comboBoxGeometries(
      this.versionCombo, this.dependencies.versions.length);
    this.drawComboListFrame(list);
    this.dependencies.versions.forEach((version, index) => {
      const rectangle = { ...rows, y: rows.y + index * KEY_ROW_HEIGHT,
        height: KEY_ROW_HEIGHT };
      const id = `${SPEED_VERSION}-${version}`;
      const status = this.dependencies.versionStatus(version);
      this.drawComboRow(id, rectangle, version, status.available,
        status.unavailableReason, () => this.selectVersion(version));
      if (status.available && version === this.raceVersion)
        this.controls.get(id)?.setAttribute("aria-selected", "true");
    });
  }

  drawBgmMenu(): void {
    if (this.openCombo !== "bgm" || !this.bgmCombo) return;
    const choices: SettingsBgmChoice[] = [
      { id: 0, label: this.text("#sb(defaultBgm)"), path: "" }, ...this.bgmChoices];
    const count = Math.min(8, choices.length);
    const geometry = this.comboBoxGeometries(this.bgmCombo, count);
    const shift = Math.min(0, UI_BOUNDS.height -
      (geometry.list.y + geometry.list.height) - 12);
    const list = { ...geometry.list, y: geometry.list.y + shift };
    const rows = { ...geometry.rows, y: geometry.rows.y + shift };
    this.drawComboListFrame(list);
    choices.slice(this.bgmOffset, this.bgmOffset + count).forEach((choice, index) => {
      const rectangle = { ...rows, y: rows.y + index * KEY_ROW_HEIGHT,
        height: KEY_ROW_HEIGHT };
      const id = `mainMenuBgm-${choice.path}`;
      this.drawComboRow(id, rectangle, choice.label, true, undefined, () => {
        this.options.onActivate();
        this.draft = { ...this.draft, mainMenuBgmPath: choice.path };
        this.openCombo = undefined;
        this.render();
      });
      if (choice.path === this.draft.mainMenuBgmPath)
        this.controls.get(id)?.setAttribute("aria-selected", "true");
    });
  }

  drawComboListFrame(rectangle: UiRectangle): void {
    const frame = this.assets.frames.get("DefaultEdit")?.[0];
    if (frame) this.drawFrame(frame, rectangle);
  }

  comboBoxGeometries(combo: { client: UiRectangle }, count: number): {
    rows: UiRectangle; list: UiRectangle;
  } {
    const frame = this.assets.frames.get("DefaultEdit")?.[0];
    const rows = { ...combo.client, height: count * KEY_ROW_HEIGHT };
    const list = frame ? {
      x: rows.x - frame.left.width,
      y: rows.y - frame.caption.height,
      width: rows.width + frame.left.width + frame.right.width,
      height: rows.height + frame.caption.height + frame.bottom.height,
    } : rows;
    return { rows, list };
  }

  drawComboRow(id: string, rectangle: UiRectangle, label: string,
    available: boolean, reason: string | undefined, select: () => void): void {
    const frames = this.assets.frames.get("SelectBtn");
    const state = available ? pressedState(id, this.hovered, this.pressed) : 0;
    if (frames?.length) this.drawFrame(frames[Math.min(state, frames.length - 1)]!, rectangle);
    this.drawText(label, { ...rectangle, x: rectangle.x + 4 },
      "bold16", "left", available ? INK : DISABLED_INK, "button");
    const accessibleLabel = available ? label : `${label}（${reason ?? ""}）`;
    this.button(id, accessibleLabel, rectangle, !available, select);
  }

  setRoomSpeed(speed: number, version: string): void {
    setSettingsRoomSpeed(this as unknown as SettingsInteractionHost, speed, version);
  }

  raceSpeedChannel(): SettingsChoice | undefined {
    return this.dependencies.speedChannel(this.raceVersion, this.raceSpeed);
  }

  channelText(choice: SettingsChoice): string {
    return this.dependencies.channelText(choice, value => this.text(value));
  }

  speedChannelHint(): string {
    if (this.options.speedLocked)
      return "多人游戏的速度由房间统一决定，不能在个人设置中修改。";
    const status = this.dependencies.versionStatus(this.raceVersion);
    if (!status.available)
      return `速度版本${this.raceVersion}当前不可选：${status.unavailableReason ?? ""}`;
    const choices = this.dependencies.speedChoices(this.raceVersion);
    const available = choices.filter(choice => choice.available);
    const unavailable = choices.filter(choice => !choice.available);
    if (unavailable.length === 0) return "";
    const labels = available.map(choice => this.channelText(choice)).join("、");
    return `速度频道设置：当前可选 ${labels || "无"}。其余 ${unavailable.length} 个档位缺少车辆快照，暂不可选。`;
  }

  private interactionDependencies(): SettingsInteractionDependencies {
    const dependencies = this.dependencies;
    return {
      tabs: dependencies.tabs, versions: dependencies.versions,
      versionStatus: dependencies.versionStatus, speedChoices: dependencies.speedChoices,
      fallbackSpeed: dependencies.fallbackSpeed, defaultSound: dependencies.defaultSound,
      volumeThumb,
    };
  }

  toggleCombo(name: string): void {
    toggleSettingsCombo(this as unknown as SettingsInteractionHost, name);
  }

  selectVersion(version: string): void {
    selectSettingsVersion(this as unknown as SettingsInteractionHost,
      version, this.interactionDependencies());
  }

  selectSpeed(choice: SettingsChoice): void {
    selectSettingsSpeed(this as unknown as SettingsInteractionHost, choice);
  }

  closeCombo(): boolean {
    return closeSettingsCombo(this as unknown as SettingsInteractionHost);
  }

  moveSelection(direction: number): void {
    moveSettingsSelection(this as unknown as SettingsInteractionHost,
      direction, this.interactionDependencies());
  }

  drawKeyEdit(node: SettingsNode, rectangle: UiRectangle): void {
    const id = attribute(node, "name") ?? "";
    const index = Number(id.slice(6));
    const editing = id.startsWith("modKey");
    const frame = this.assets.frames.get("DefaultEdit")![0]!;
    const client = this.dependencies.clientRect(frame, rectangle);
    this.drawFrame(frame, rectangle);
    if (editing && this.keyFocus === index) this.drawKeyCursor(client);
    else this.drawText(this.keyBindingLabel(index, editing), client,
      "bold16", "center", INK, "button");
    this.keyControl(id, index, editing, rectangle);
  }

  keyValue(index: number, editing: boolean): number {
    return editing ? this.keyChanges[index] ?? 0
      : this.options.initial.keyMap[index] ?? 1;
  }

  keyControl(id: string, index: number, editing: boolean,
    rectangle: UiRectangle): void {
    const text = `${this.keyActionLabel(index)} ${this.text(
      editing ? "#sb(newKey)" : "#sb(currentKey)")}：${this.keyBindingLabel(index, editing)}`;
    this.button(id, text, rectangle, !editing || index === 17,
      () => this.focusKey(index));
    const control = this.controls.get(id)!;
    if (editing && index !== 17) control.dataset.keyIndex = String(index);
    if ([7, 17, 21, 22].includes(index))
      control.title = "当前计时赛尚未接入此功能。";
  }

  keyActionLabel(index: number): string {
    const remap: Record<number, number> = {
      0: 2, 1: 1, 2: 0, 3: 3, 20: 8, 21: 10, 22: 11,
    };
    const base = index === 20 ? 8 : repeatedKeyIndex(index);
    return `${this.text(`#sb(kartKey${remap[base] ?? base})`)}` +
      (base !== index ? "（备用）" : "");
  }

  drawKeyCursor(rectangle: UiRectangle): void {
    if (!this.cursorVisible) return;
    this.context.fillStyle = "black";
    this.context.fillRect(rectangle.x + rectangle.width / 2,
      rectangle.y + (rectangle.height - 12) / 2, 2, 12);
  }

  focusKey(index?: number): void {
    if (this.keyFocus === index) return;
    clearInterval(this.cursorTimer);
    clearInterval(this.gamepadPoll);
    this.gamepadPoll = undefined;
    this.keyFocus = index;
    this.cursorVisible = true;
    if (index !== undefined) {
      this.cursorTimer = setInterval(() => {
        this.cursorVisible = !this.cursorVisible;
        this.render();
      }, 501);
      this.gamepadHeld = this.dependencies.gamepadButtons(
        Array.from(navigator.getGamepads?.() ?? []));
      this.gamepadPoll = setInterval(() => this.pollGamepad(), 60);
    }
    this.render();
  }

  pollGamepad(): void {
    const pressed = this.dependencies.gamepadButtons(
      Array.from(navigator.getGamepads?.() ?? []));
    if (this.keyFocus !== undefined) {
      for (const button of pressed) {
        if (!this.gamepadHeld.has(button)) {
          this.recordGamepad(button);
          break;
        }
      }
    }
    this.gamepadHeld = pressed;
  }

  recordGamepad(code: string): void {
    const index = this.keyFocus;
    if (index === undefined || !this.dependencies.validGamepadCode(code)) return;
    if (this.dependencies.usedGamepadCode(this.draft.gamepadMap, index, code)) {
      this.showKeyError("alreadyUsedKey");
      return;
    }
    this.draft = { ...this.draft,
      gamepadMap: { ...this.draft.gamepadMap, [index]: code } };
    this.render();
  }

  keyBindingLabel(index: number, editing: boolean): string {
    const key = this.dependencies.keyboardLabel(this.keyValue(index, editing));
    const gamepad = this.dependencies.gamepadLabel(this.draft.gamepadMap[index]);
    return gamepad === "" ? key : key === "" ? gamepad : `${key} / ${gamepad}`;
  }

  recordKey(code: string): void {
    const index = this.keyFocus;
    const key = this.dependencies.browserKeyCode(code);
    this.element.focus();
    if (!this.dependencies.validKeyCode(key)) {
      this.showKeyError("invalidKey");
      return;
    }
    const used = this.dependencies.keyActions.some(action =>
      action.index !== index && ![18, 19].includes(action.index) &&
      this.draft.keyMap[action.index] === key);
    if (used) {
      this.showKeyError("alreadyUsedKey");
      return;
    }
    this.keyChanges[index!] = key;
    this.draft = { ...this.draft,
      keyMap: { ...this.draft.keyMap, [index!]: key } };
    this.render();
  }

  showKeyError(error: string): void {
    this.keyError = error;
    const message = this.text(`#sb(${error})`);
    this.keyErrorLines = this.wrapKeyError(message, 408);
    this.errorElement.setAttribute("aria-description", message);
    this.render();
    this.controls.get("okButton")?.focus();
  }

  private wrapKeyError(message: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let line = "";
    let width = 0;
    for (const character of message) {
      const characterWidth = this.dependencies.measureText(this.context, character,
        { family: FONT_FAMILY, size: 16 }).width;
      if (width + characterWidth > maxWidth) {
        lines.push(line);
        line = "";
        width = 0;
      }
      if (line.length === 0 && character === " ") continue;
      line += character;
      width += characterWidth;
    }
    lines.push(line);
    return lines;
  }

  dismissKeyError(): void {
    this.keyError = undefined;
    this.render();
    this.element.focus();
  }

  keyMessageRect(node: SettingsNode, frame?: SettingsFrame): UiRectangle {
    const rectangle = this.dependencies.layoutRect(node, UI_BOUNDS, frame);
    const lineHeight = this.dependencies.measureText(this.context, "",
      { family: FONT_FAMILY, size: 16 }).height;
    return this.dependencies.layoutRect(node, UI_BOUNDS, frame, undefined, {
      width: rectangle.width,
      height: rectangle.height + (this.keyErrorLines.length - 1) * lineHeight,
    });
  }

  drawKeyErrorText(rectangle: UiRectangle): void {
    const lineHeight = this.dependencies.measureText(this.context, "",
      { family: FONT_FAMILY, size: 16 }).height;
    const top = rectangle.y + Math.max(0,
      (rectangle.height - this.keyErrorLines.length * lineHeight) / 2);
    this.keyErrorLines.forEach((line, index) =>
      this.drawText(line, { ...rectangle, y: top + index * lineHeight,
        height: lineHeight }, "bold16", "hcenter", INK));
  }

  resetKeys(): void {
    this.keyChanges = Object.fromEntries(this.dependencies.keyActions
      .filter(action => ![18, 19].includes(action.index))
      .map(action => [action.index, this.dependencies.defaultKeyMap[action.index]!]));
    this.draft = { ...this.draft,
      keyMap: { ...this.draft.keyMap, ...this.keyChanges } };
  }

  drawKeyScroll(rectangle: UiRectangle): void {
    const scrollbar = this.assets.keymapScrollbar!;
    const geometry = this.keyScroll.layout(scrollbar, rectangle, 21, 0, 630);
    const image = this.assets.images.get(scrollbar.areaFrame.texture)!.image;
    this.dependencies.paintFrame(this.context, scrollbar.areaFrame, image, geometry.area);
    this.dependencies.paintFrame(this.context,
      scrollbar.buttonFrames[this.keyScroll.buttonState]!, image, geometry.button);
    const alreadyRegistered = this.controls.has("keymapScroll");
    this.button("keymapScroll", "滚动键位列表", rectangle, false, () => {});
    const control = this.controls.get("keymapScroll")!;
    control.setAttribute("aria-valuenow", String(this.keyScroll.contentOffset));
    if (alreadyRegistered) return;
    control.setAttribute("role", "scrollbar");
    control.setAttribute("aria-orientation", "vertical");
    control.setAttribute("aria-valuemin", "0");
    control.setAttribute("aria-valuemax", "102");
    control.addEventListener("pointerdown", event => {
      if (event.button === 0 && this.keyScroll.down(this.pointerPoint(event)))
        control.setPointerCapture(event.pointerId);
    });
    control.addEventListener("pointermove", event => this.keyScroll.move(
      this.pointerPoint(event), (event.buttons & 1) !== 0));
    control.addEventListener("pointerup", () => this.keyScroll.up());
    control.addEventListener("pointercancel", () => this.keyScroll.up());
    control.addEventListener("lostpointercapture", () => this.keyScroll.up());
    control.addEventListener("pointerleave", () => this.keyScroll.leave());
  }

  pointerPoint(event: PointerEvent): { x: number; y: number } {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) * 1600) / bounds.width,
      y: ((event.clientY - bounds.top) * 900) / bounds.height,
    };
  }

  drawVolume(node: SettingsNode, rectangle: UiRectangle): void {
    const field = attribute(node, "name") === "bgmVolumeScroll"
      ? "bgmVolume" : "fxVolume";
    const { area, thumb } = volumeGeometry(rectangle, Number(this.draft[field]));
    this.drawFrame(this.assets.frames.get("NewHorizonScrollArea")![0]!, area);
    const gauge = this.assets.images.get("setting_gaugeBar")!;
    this.context.drawImage(gauge.image, area.x + 1, area.y + 1,
      thumb.x - area.x, 12);
    const frame = this.assets.frames.get("NewHorizonScrollButton")![
      this.volumeDrag?.field === field ? 2 : 3]!;
    this.drawFrame(frame, thumb);
    this.volumeInput(field, area);
    this.volumeArrow(field,
      { ...rectangle, y: rectangle.y - 3, width: 20, height: 20 }, -1);
    this.volumeArrow(field,
      { ...rectangle, x: rectangle.x + rectangle.width - 20,
        y: rectangle.y - 3, width: 20, height: 20 }, 1);
  }

  volumeArrow(field: string, rectangle: UiRectangle, direction: number): void {
    const id = `${field}-${direction}`;
    const frames = this.assets.frames.get(
      direction < 0 ? "BulletLeftButton" : "BulletRightButton")!;
    this.drawFrame(frames[this.state(id, true)]!, rectangle);
    const alreadyRegistered = this.controls.has(id);
    const step = () => this.stepVolume(field, direction * 500);
    this.button(id, `${direction < 0 ? "降低" : "提高"}${this.volumeLabel(field)}`,
      rectangle, false, event => {
        if (event.detail === 0) step();
      });
    if (alreadyRegistered) return;
    const control = this.controls.get(id)!;
    control.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      control.setPointerCapture(event.pointerId);
      step();
      this.repeatVolume(step);
    });
    control.addEventListener("pointerup", () => this.stopVolumePointer());
    control.addEventListener("pointercancel", () => this.stopVolumePointer());
    control.addEventListener("lostpointercapture", () => this.stopVolumePointer());
  }

  volumeInput(field: string, rectangle: UiRectangle): void {
    let input = this.controls.get(field) as HTMLInputElement | undefined;
    if (!input) {
      input = document.createElement("input");
      input.type = "range";
      input.min = "0";
      input.max = "4778";
      input.step = "any";
      input.setAttribute("aria-label", this.volumeLabel(field));
      input.addEventListener("input", () =>
        this.changeVolume(field, Number(input!.value) / 4778));
      this.addVolumePointer(input, field);
      this.registerControl(field, input);
    }
    input.value = String(Number(this.draft[field]) * 4778);
    input.setAttribute("aria-valuetext", `${Math.round(Number(this.draft[field]) * 100)}%`);
    this.placeControl(input, { ...rectangle, height: 20 });
  }

  volumeLabel(field: string): string {
    return this.text(field === "bgmVolume" ? "#sb(soundBgm)" : "#sb(soundEffect)");
  }

  addVolumePointer(input: HTMLInputElement, field: string): void {
    input.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      event.preventDefault();
      input.focus();
      input.setPointerCapture(event.pointerId);
      const bounds = input.getBoundingClientRect();
      const area = { x: 0, y: 0, width: 182, height: 14 };
      const pointerX = ((event.clientX - bounds.left) * 182) / bounds.width;
      const thumbX = volumeThumb(Number(this.draft[field]));
      if (pointerX >= thumbX && pointerX <= thumbX + 8) {
        this.volumeDrag = { field, area, grab: pointerX - thumbX };
        this.render();
      } else {
        const direction = pointerX < thumbX ? -1 : 1;
        this.stepVolume(field, direction * 222);
        this.repeatVolume(() => this.repeatTrackVolume(field, direction, pointerX));
      }
    });
    input.addEventListener("pointermove", event => {
      const drag = this.volumeDrag;
      if (!drag) return;
      const bounds = input.getBoundingClientRect();
      const pointerX = ((event.clientX - bounds.left) * drag.area.width) / bounds.width;
      const scaled = Math.fround(Math.fround(5000 *
        Math.fround(pointerX - drag.grab)) / drag.area.width);
      this.changeVolume(drag.field, Math.fround(scaled / 4778));
    });
    input.addEventListener("pointerup", () => this.stopVolumePointer());
    input.addEventListener("pointercancel", () => this.stopVolumePointer());
    input.addEventListener("lostpointercapture", () => this.stopVolumePointer());
  }

  stepVolume(field: string, delta: number): void {
    stepSettingsVolume(this as unknown as SettingsInteractionHost, field, delta);
  }

  repeatTrackVolume(field: string, direction: number, pointerX: number): boolean {
    return repeatSettingsVolumeStep(this as unknown as SettingsInteractionHost,
      field, direction, pointerX, this.interactionDependencies());
  }

  repeatVolume(step: () => boolean | void): void {
    clearTimeout(this.volumeRepeat);
    const repeat = () => {
      if (step() !== false) this.volumeRepeat = setTimeout(repeat, 77);
    };
    this.volumeRepeat = setTimeout(repeat, 300);
  }

  stopVolumePointer(): void {
    stopSettingsVolumePointer(this as unknown as SettingsInteractionHost);
  }

  toggle(name: string): void {
    toggleSettingsOption(this as unknown as SettingsInteractionHost, name);
  }

  changeVolume(field: string, value: number): void {
    changeSettingsVolume(this as unknown as SettingsInteractionHost, field, value);
  }

  activate(name: string): void {
    activateSettingsControl(this as unknown as SettingsInteractionHost,
      name, this.interactionDependencies());
  }

  applyPreset(name: string): void {
    applySettingsPreset(this as unknown as SettingsInteractionHost, name);
  }

  applyGraphicsPreset(highQuality: boolean): void {
    applySettingsGraphicsPreset(this as unknown as SettingsInteractionHost, highQuality);
  }

  resetSound(): void {
    resetSettingsSound(this as unknown as SettingsInteractionHost,
      this.interactionDependencies());
  }

  button(id: string, label: string, rectangle: UiRectangle,
    disabled: boolean, action: (event: MouseEvent) => void): void {
    let control = this.controls.get(id) as HTMLButtonElement | undefined;
    if (!control) {
      control = document.createElement("button");
      control.type = "button";
      control.addEventListener("click", action);
      this.registerControl(id, control);
    }
    control.setAttribute("aria-label", label);
    control.disabled = disabled;
    this.placeControl(control, rectangle);
  }

  registerControl(id: string, control: HTMLElement): void {
    Object.assign(control.style, {
      position: "absolute", opacity: "0", margin: "0", padding: "0", cursor: "pointer",
    });
    control.addEventListener("pointerenter", () => {
      this.hovered = id;
      this.render();
    });
    control.addEventListener("pointerleave", () => {
      this.hovered = undefined;
      this.render();
    });
    control.addEventListener("pointerdown", () => {
      this.pressed = id;
      this.render();
    });
    control.addEventListener("pointerup", () => {
      this.pressed = undefined;
      this.render();
    });
    control.addEventListener("focus", () => {
      this.hovered = id;
      this.render();
    });
    this.element.append(control);
    this.controls.set(id, control);
  }

  placeControl(control: HTMLElement, rectangle: UiRectangle): void {
    const viewport = this.keyViewport;
    this.renderedControls.add(control);
    control.hidden = false;
    control.inert = Boolean(this.keyError) && control !== this.controls.get("okButton");
    Object.assign(control.style, {
      left: `${rectangle.x / 16}%`, top: `${rectangle.y / 9}%`,
      width: `${rectangle.width / 16}%`, height: `${rectangle.height / 9}%`,
      clipPath: viewport
        ? `inset(${(Math.max(0, viewport.y - rectangle.y) / rectangle.height) * 100}% 0 ${(Math.max(0,
          rectangle.y + rectangle.height - viewport.y - viewport.height) / rectangle.height) * 100}% 0)`
        : "",
      pointerEvents: "auto",
    });
  }

  state(id: string, active: boolean): number {
    return active ? pressedState(id, this.hovered, this.pressed) : 3;
  }

  drawFrame(frame: SettingsFrame, rectangle: UiRectangle): void {
    if (frame.texture) this.dependencies.paintFrame(this.context, frame,
      this.assets.images.get(frame.texture)!.image, rectangle);
  }

  text(value: string): string {
    return value.replace(/^#sb\(([^)]+)\)$/,
      (original, key: string) => this.assets.strings.get(key) ?? original);
  }

  drawText(value: string, rectangle: UiRectangle, render: string,
    alignment: string, ink: string, kind = "label"): void {
    const terms = new Set(alignment.split(/[,;|.\s]+/));
    this.dependencies.paintText(this.context, value, rectangle, {
      family: FONT_FAMILY, size: fontSize(render), kind, color: ink,
      align: terms.has("right") ? "right" : terms.has("center") || terms.has("hcenter")
        ? "center" : "left",
      verticalAlign: terms.has("bottom") ? "bottom"
        : terms.has("center") || terms.has("vcenter") ? "center" : "top",
    });
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (this.keyError) return this.keyErrorShortcut(event);
    if (this.comboShortcut(event)) return;
    if (this.dialogShortcut(event)) {
      event.preventDefault();
      return;
    }
    if (this.keyFocus !== undefined) {
      event.preventDefault();
      this.recordKey(event.code);
      return;
    }
    if (/^F\d+$/.test(event.code)) event.preventDefault();
    if (event.code === "Tab") this.moveFocus(event);
  }

  comboShortcut(event: KeyboardEvent): boolean {
    if (!this.openCombo) return false;
    const actions: Record<string, () => void> = {
      Escape: () => { this.closeCombo(); },
      Enter: () => { this.closeCombo(); },
      NumpadEnter: () => { this.closeCombo(); },
      ArrowDown: () => this.moveSelection(1),
      ArrowUp: () => this.moveSelection(-1),
    };
    const action = actions[event.code];
    if (!action) return false;
    event.preventDefault();
    action();
    this.render();
    return true;
  }

  keyErrorShortcut(event: KeyboardEvent): void {
    event.preventDefault();
    if (["Escape", "Enter", "NumpadEnter"].includes(event.code))
      this.dismissKeyError();
  }

  dialogShortcut(event: KeyboardEvent): boolean {
    const actions: Record<string, () => void> = {
      Escape: this.options.onCancel,
      Enter: () => this.options.onConfirm(this.draft, this.raceSpeed, this.raceVersion),
      NumpadEnter: () => this.options.onConfirm(this.draft, this.raceSpeed, this.raceVersion),
    };
    if (actions[event.code]) {
      actions[event.code]!();
      return true;
    }
    const toggle = this.dependencies.dialogShortcuts[event.code];
    if (toggle) {
      this.toggle(toggle);
      return true;
    }
    return ["F9", "F10", "F11"].includes(event.code) ||
      (event.code === "KeyP" && event.ctrlKey);
  }

  moveFocus(event: KeyboardEvent): void {
    const controls = [...this.controls.values()].filter(control =>
      !control.hidden && !(control as HTMLButtonElement).disabled);
    const current = controls.indexOf(document.activeElement as HTMLElement);
    event.preventDefault();
    controls[(current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
  }
}

/** Bind release data and drawing helpers without importing generated modules here. */
export function createSettingsWindowClass(dependencies: SettingsWindowDependencies):
  typeof SettingsWindow {
  return class extends SettingsWindow {
    static override dependencies = dependencies;
  };
}
