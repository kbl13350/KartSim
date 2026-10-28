import { CanvasHitController, type CanvasHitRegion } from "./canvas-hit-controller";
import { C9, E9, Ft, G1, T, V0, ct, f5, m9, p2, s2, st } from "../generated/formats.js";
import { U1 } from "../generated/library.js";
import { showGameToast } from "./game-popups";
import { scrollbarGeometry } from "./scrollbar";
import { loadRiderSchoolArt, type RiderSchoolArt } from "./rider-school-art";
import { gameLocale, resourceText, tr } from "../i18n/locale";

/**
 * The release MainMenuStage home, stage_mainMenu.rho/mq_window@cn.bml
 * (container "mainmenu"), drawn with its own textures and strings. Panels the
 * release filled from server data are filled from local release art: the
 * promotion carousel shows the race loading illustrations, the kart pass shows
 * its "coming soon" boards and the event list keeps only its title bar.
 *
 * The same view also draws the release 单人游戏 page, the "singleplay_pop"
 * tab of that layout: category tabs on the left with their mode cards, and
 * the category overview or the time attack mode boards on the right.
 */

export interface MainMenuNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: MainMenuNode[];
}

interface Texture { image: CanvasImageSource; width: number; height: number }
interface ResourceFile { bytes(): Promise<Uint8Array> }
export interface MainMenuLibrary { canonicalCandidates(path: string): ResourceFile[] }

export interface MainMenuAssets {
  root: MainMenuNode;
  textures: Map<MainMenuNode, Texture[]>;
  strings: Map<string, string>;
  channels: Array<{ channel: string; states: Texture[] }>;
  banners: Texture[];
  backdrop?: Texture;
  font: FontFace;
  story?: StoryTabArt;
  /** The lobby 活动 buttons (eventMenu.xml), four states each. */
  events?: Array<{ id: LobbyEventId; label: string; states: Texture[] }>;
  /** 驾照考试 page art; the tab keeps its overview without it. */
  riderSchool?: RiderSchoolArt;
  /** 回放 tab art (replayCard): the card states and its 删除 button. */
  replay?: ReplayTabArt;
  /** The monocoque TextButton frames (four states) for the 地图工坊 button. */
  textButton?: { frames: WindowFrame[]; image: Texture };
}

/** Release art of the 回放 tab's cards: replay_list_01…04 (750×128) and btn_replayDelete_1…4. */
export interface ReplayTabArt {
  card: Texture[];
  remove: Texture[];
}

/** The 回放 tab's pages: 我的回放 / 联赛回放 / 其他回放 (TIMEATTACK.md 4). */
export type ReplayTab = "my" | "league" | "other";

/** One card on a 回放 list (timeattack/ready-replays). */
export interface ReplayMenuEntry {
  key: string;
  /** local: this browser's Ghost; featured: 联赛回放; ranked: another rider's ranked record. */
  source: "local" | "featured" | "ranked";
  trackId: string;
  trackTitle: string;
  riderName: string;
  /** Optional UI marker, kept separate from the rider's canonical nickname. */
  displayRiderName?: string;
  kartName: string;
  elapsedMs: number;
  recordedAt?: number;
  /** The card's title line: track and time, or the published title. */
  title: string;
  /** A second title line (the published note). */
  note?: string;
  /** "标准速度 / 个人赛". */
  settings: string;
  dateText: string;
  /** Local records have a 删除 button. */
  deletable: boolean;
  speed: number;
  booster: number;
  accountId?: string;
  featuredId?: number;
}

/** 其他回放: the settings card above the list. */
export interface ReplayBrowseHeader {
  trackTitle: string;
  settings: string;
}

export type LobbyEventId = "treasureHunt" | "gacha";

/**
 * The lobby 活动 buttons the rewrite runs (zeta_/cn/content/eventMenu.xml
 * TreasureHuntBtn event_thg_0 and LimitedGachaBtn limitedGacha_0; the latter
 * opens the 精品道具场).
 */
const LOBBY_EVENTS: ReadonlyArray<{ id: LobbyEventId; label: string; image: string }> = [
  { id: "treasureHunt", label: tr("寻宝活动"), image: "event_thg_0" },
  { id: "gacha", label: tr("精品道具"), image: "limitedGacha_0" },
];

export type MainMenuPage = "home" | "single";

/** One chapter card on the 故事模式 tab. */
export interface StoryMenuChapter {
  name: string;
  title: string;
  subTitle?: string;
  desc: string;
  /** One image, or the four button states. */
  card?: Texture[];
  /** select/sub/<chapter>.png, the 420×103 picture on the chapter board. */
  sub?: Texture;
  open: boolean;
  cleared: boolean;
  /** showNewIcon: the blinking NEW badge. */
  showNew: boolean;
  progress: string;
}

/** A monocoque window frame, as Ft reads it from gui_monocoque frame.bml. */
interface WindowFrame { texture: string }

/** Release art of the 故事模式 tab: card stamps, the chapter board and the list scrollbar. */
export interface StoryTabArt {
  /** scenarioCard chapterCompleted, 클리어라벨 (70×70). */
  completed?: Texture;
  /** scenarioCard chapterNew, scenario_new_01 / _05 blinking every 500 ms. */
  newBadge: Texture[];
  /** scenarioChapterCard board, scenario_select_chapter_btn_01…04 (750×140). */
  board: Texture[];
  lock?: Texture;
  clear?: Texture;
  scrollbar?: { area: WindowFrame; buttons: WindowFrame[]; minButtonHeight: number;
    images: Map<string, Texture> };
}

/** One step card on a license page. */
export interface LicenseMenuStep {
  step: number;
  name: string;
  /** missionIcon_* states 1-4. */
  icon?: Texture[];
  cleared: boolean;
  open: boolean;
  /** Right of the card: the clear condition and best time. */
  detail: string;
}

/** A license tab: 新手 … L1 (steps) or PRO (pro). */
export interface LicenseMenuLevel {
  level: number;
  /** The clearLevelN badge. */
  taken: boolean;
  /** Why it cannot be played yet. */
  lock?: string;
  steps: LicenseMenuStep[];
  canTake: boolean;
}

/** The PRO tab: the qualification (riderSchoolPro1) until its emblem is earned, then the missions. */
export interface LicenseMenuPro {
  qualified: boolean;
  emblem?: Texture;
  emblemName: string;
  rows: Array<{ track: string; title: string; record: string }>;
  canClaim: boolean;
  /** The period's time trial and duel (riderSchoolPro2 button0 / button1). */
  missions: LicenseMenuStep[];
  canTake: boolean;
  /** "PRO驾照有效期至 …" when held. */
  status?: string;
}

export interface LicenseMenu {
  /** The tab shown first. */
  selected: number;
  levels: LicenseMenuLevel[];
  pro: LicenseMenuPro;
}

export interface MainMenuOptions {
  /** 计时赛竞争战: the release lobby shortcut into single-play time attack. */
  onTimeAttack(): void;
  /** 练习计时赛 on the single-play page: the time attack Ready page. */
  onPractice?(): void;
  /** 排位计时赛 on the single-play page: the ranking window (TIMEATTACK.md). */
  onRanking?(): void;
  /** 回放 on the single-play page: a 我的回放 card plays its record. */
  onReplay?(entry: ReplayMenuEntry): void;
  /** 回放: a card's 删除 button. */
  onReplayDelete?(entry: ReplayMenuEntry): void;
  /** 回放: a page tab (我的 / 联赛 / 其他) was chosen; the page's cards reload. */
  onReplayTab?(tab: ReplayTab): void;
  /** 其他回放: 选择赛道 on the settings card. */
  onReplayPickTrack?(): void;
  /** 其他回放: 切换速度 / 切换模式 on the settings card. */
  onReplaySetting?(kind: "speed" | "booster"): void;
  /** 地图工坊 (maps riders made in the map editor, server-go/MAPS.md): the button on the single-play title bar. */
  onCustomGame?(): void;
  /** 极速方程: single-player championship with 19 release NPCs. */
  onFormula?(): void;
  /** A favourite channel opens the multiplayer lobby on that channel. */
  onChannel(channel: string): void;
  onHover?(): void;
  onActivate?(): void;
  /** Assets cached for reuse keep their font registered after dispose. */
  keepFont?: boolean;
  /** A single-play category tab was chosen. */
  onCategory?(category: SingleCategory): void;
  /** A story chapter card was clicked. */
  onStoryChapter?(name: string): void;
  /** 驾照考试: a step card or a PRO mission was clicked. */
  onLicenseStep?(step: number): void;
  /** 驾照考试: 获得驾照 of a license tab. */
  onLicenseTake?(level: number): void;
  /** 驾照考试: a PRO qualification track row was clicked. */
  onLicenseQualify?(track: string): void;
  /** 驾照考试: 获得徽章 of the PRO qualification. */
  onLicenseEmblem?(): void;
}

const ROOTS = ["stage_/mainMenu", "stage_/common", "zeta_/cn/stage/mainMenu",
  "zeta_/cn_stage/mainMenu", "zeta_cn_stage_/mainMenu", "dialog2_/timeAttackCompetitive"];
const CHANNEL_ROOTS = ROOTS.map(root => `${root}/favoriteChannel`);
export const MAIN_MENU_FONT_FAMILY = "KartSim Main Menu";
const FONT_FAMILY = MAIN_MENU_FONT_FAMILY;
const STAGE = { x: 0, y: 0, width: 1600, height: 900 };
/** The bottom 7.333% of the 1600x900 stage belongs to the shared taskbar. */
const VISIBLE_HEIGHT = 900 * (1 - 0.07333333);
/** Home panels of "mainmenu"; the single/multi pop-ups and room list open elsewhere. */
const SHOWN = new Set(["favoriteChannelCon", "eventmenu_pop", "timeAttackCompetitive",
  "promotionCon", "promotionRadioBg", "kartPassInfo"]);
/** Web choices for favourite channels: the two channels the local server runs. */
const FAVORITE_CHANNELS = [
  { channel: "speedIndiCombine", image: "cn_스개_통합_0" },
  { channel: "speedTeamCombine", image: "cn_스팀_통합_0" },
];
/**
 * The release lobby draws img_mainSideBG (a black edge vignette) over a 3D
 * lobby scene the Web build does not have; one release loading illustration
 * stands in as the backdrop and the other four rotate as promotion banners.
 */
const BACKDROP = "백기사_신_로딩페이지_1600";
const BANNERS = ["블랙샤크 신 로딩페이지_1600", "스토커 신 로딩페이지_1600",
  "웨이브 신 로딩페이지_1600", "공동묘지페리_로딩페이지_1600"];
/** Keys the cn string bag lacks. */
const FALLBACK_STRINGS: Record<string, string> = { event: tr("活动"), kartPass: tr("跑跑通行证") };
const BANNER_INTERVAL_MS = 5_000;
const SINGLE_PAGE = "singleplay_pop";
/** Single-play categories in tab order; the first opens by default. */
export const SINGLE_CATEGORIES = ["cat_timeAttack", "cat_riderSchool", "cat_scenario",
  "cat_trainingCenter", "cat_replay"] as const;
export type SingleCategory = typeof SINGLE_CATEGORIES[number];
/** Categories whose page fills the right side; the others show the overview. */
const RIGHT_FILLED = new Set<string>(["cat_timeAttack", "cat_scenario", "cat_riderSchool", "cat_replay"]);
/** replayCard: four 750×128 cards a page in the 748×556 list container. */
const REPLAY_CARD = { width: 750, height: 128, gap: 4, perPage: 4 };
/** Labels for the release mode cards, whose names are baked into their art. */
export const SINGLE_LABELS: Record<string, string> = {
  cat_timeAttack: tr("计时赛"), cat_riderSchool: tr("驾照考试"), cat_scenario: tr("故事模式"),
  cat_trainingCenter: tr("车手学院"), cat_replay: tr("回放"),
  timeAttack_train: tr("练习计时赛"), timeAttack_ranking: tr("排位计时赛"),
  timeAttack_competitive: tr("竞争排位赛"),
  riderSchool_Level1: tr("新手驾照"), riderSchool_Level2: tr("初级驾照"), riderSchool_Level3: tr("L3驾照"),
  riderSchool_Level4: tr("L2驾照"), riderSchool_Level5: tr("L1驾照"), riderSchool_Level6: tr("PRO驾照"),
  trainingCenter_Level1: tr("基础驾驶技巧"), trainingCenter_Level2: tr("高级驾驶技巧"),
  trainingCenter_Level3: tr("特殊驾驶技巧"),
  replay_my: tr("我的回放"), replay_league: tr("联赛回放"), replay_other: tr("其他回放"),
};
const NOTICE_MS = 2_600;
/** riderSchoolPage GridSelector "grid": one column of 750×74 step cards, 4 px apart. */
const LICENSE_CARD = { width: 750, height: 74, gap: 4 };
/** GridSelector "scenario_bnt_list": two columns of 272×134 cards, 8/4 px apart. */
const STORY_CARD = { width: 272, height: 134, gapX: 8, gapY: 4 };

const attribute = (node: MainMenuNode, name: string): string | undefined =>
  T(node, name) as string | undefined;

export function mainMenuColor(value: string | undefined, fallback = "white"): string {
  if (!value) return fallback;
  const channels = value.trim().split(/\s+/).map(Number);
  if (channels.length === 4 && channels.every(Number.isFinite)) {
    const [a, r, g, b] = channels as [number, number, number, number];
    return `rgba(${r},${g},${b},${a / 255})`;
  }
  return value;
}

export function readMainMenuStrings(bag: MainMenuNode): Map<string, string> {
  const strings = new Map<string, string>(Object.entries(FALLBACK_STRINGS).map(([key, value]) => [key, tr(value)]));
  const visit = (node: MainMenuNode): void => {
    if (node.name === "k") {
      const key = attribute(node, "n");
      const value = resourceText(node.children, attribute);
      if (key && value) strings.set(key, value);
      return;
    }
    node.children.forEach(visit);
  };
  visit(bag);
  return strings;
}

let sharedBackdrop: Texture | undefined;

/** The home backdrop, shared with the multiplayer lobby once home has loaded. */
export function mainMenuBackdrop(): Texture | undefined {
  return sharedBackdrop;
}

/** Dark fill plus the cover-cropped backdrop illustration. */
export function drawMainMenuBackdrop(context: CanvasRenderingContext2D,
  backdrop: Texture | undefined, area: Rect): void {
  context.fillStyle = "#0b1426";
  context.fillRect(area.x, area.y, area.width, area.height);
  if (!backdrop) return;
  const crop = coverCrop(backdrop, area);
  context.drawImage(backdrop.image, crop.x, crop.y, crop.width, crop.height,
    area.x, area.y, area.width, area.height);
}

/** Centre-crop source rectangle that fills a target box. */
export function coverCrop(source: { width: number; height: number },
  target: { width: number; height: number }): { x: number; y: number; width: number; height: number } {
  const scale = Math.max(target.width / source.width, target.height / source.height);
  const width = target.width / scale;
  const height = target.height / scale;
  return { x: (source.width - width) / 2, y: (source.height - height) / 2, width, height };
}

async function decode(file: ResourceFile): Promise<Texture> {
  const image = await p2(await file.bytes()) as
    { width: number; height: number; pixels: ArrayLike<number> };
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")!.putImageData(new ImageData(
    new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0);
  return { image: canvas, width: image.width, height: image.height };
}

export async function loadMainMenuAssets(library: MainMenuLibrary): Promise<MainMenuAssets> {
  const find = (roots: string[], name: string, extension = ".png"): ResourceFile =>
    U1(library, roots, name, extension) as ResourceFile;
  const definition = s2(await find(ROOTS, "mq_window@zz", ".bml").bytes()) as MainMenuNode;
  const root = definition.name === "Container" && attribute(definition, "name") === "mainmenu"
    ? definition : definition.children.find(child => attribute(child, "name") === "mainmenu");
  if (!root) throw new Error("缺少原版主菜单布局");
  const strings = readMainMenuStrings(s2(await find(ROOTS, "stage_stringBag", ".bml").bytes()) as MainMenuNode);
  const cache = new Map<string, Promise<Texture | undefined>>();
  const texture = (roots: string[], name: string): Promise<Texture | undefined> => {
    const key = `${roots.join(";")}:${name}`;
    let pending = cache.get(key);
    if (!pending) {
      // Art the release fetched from its servers may be missing locally; skip it.
      pending = Promise.resolve().then(() => decode(find(roots, name))).catch(() => undefined);
      cache.set(key, pending);
    }
    return pending;
  };
  const textures = new Map<MainMenuNode, Texture[]>();
  const visit = async (node: MainMenuNode, top: boolean): Promise<void> => {
    const name = attribute(node, "name") ?? "";
    if (top && name && !SHOWN.has(name) && name !== SINGLE_PAGE) return;
    const states = attribute(node, "autoLoadImage");
    const single = attribute(node, "texture") ?? attribute(node, "image");
    if (states) {
      const loaded = await Promise.all([1, 2, 3, 4].map(index =>
        texture(ROOTS, `${states}${index}`)));
      if (loaded.every(Boolean)) textures.set(node, loaded as Texture[]);
    } else if (single) {
      const loaded = await texture(ROOTS, single);
      if (loaded) textures.set(node, [loaded]);
    }
    await Promise.all(node.children.map(child => visit(child, false)));
  };
  const font = await f5(FONT_FAMILY,
    await find(["gui_/font"], "SourceHanSansCN-Bold", ".otf").bytes());
  try {
    await Promise.all(root.children.map(child => visit(child, true)));
    const channels = (await Promise.all(FAVORITE_CHANNELS.map(async entry => ({
      channel: entry.channel,
      states: await Promise.all([1, 2, 3, 4].map(index =>
        texture(CHANNEL_ROOTS, `${entry.image}${index}`))),
    })))).filter((entry): entry is { channel: string; states: Texture[] } =>
      entry.states.every(Boolean));
    const banners = (await Promise.all(BANNERS.map(name =>
      texture(["zeta_/cn/loading"], name)))).filter((item): item is Texture => !!item);
    const backdrop = await texture(["zeta_/cn/loading"], BACKDROP);
    sharedBackdrop = backdrop ?? sharedBackdrop;
    const frames = () => s2Promise(find(["gui_/monocoque"], "frame", ".bml"));
    const story = await loadStoryTabArt(root, texture, frames);
    const replay = await loadReplayTabArt(texture);
    const riderSchool = await loadRiderSchoolArt(library, texture, frames as never).catch(error => {
      console.warn("[main menu] 驾照考试 art", error);
      return undefined;
    });
    const textButton = await loadTextButtonArt(texture, frames).catch(() => undefined);
    const events = (await Promise.all(LOBBY_EVENTS.map(async entry => ({
      id: entry.id, label: entry.label,
      states: await Promise.all([1, 2, 3, 4].map(index => texture(ROOTS, `${entry.image}${index}`))),
    })))).filter((entry): entry is { id: LobbyEventId; label: string; states: Texture[] } =>
      entry.states.every(Boolean));
    return { root, textures, strings, channels, banners, backdrop, font, story, events, riderSchool, replay,
      textButton };
  } catch (error) {
    G1(font);
    throw error;
  }
}

type Rect = { x: number; y: number; width: number; height: number };

async function s2Promise(file: ResourceFile): Promise<MainMenuNode> {
  return s2(await file.bytes()) as MainMenuNode;
}

function findMenuNode(node: MainMenuNode, wanted: string): MainMenuNode | undefined {
  if (attribute(node, "name") === wanted) return node;
  for (const child of node.children) {
    const found = findMenuNode(child, wanted);
    if (found) return found;
  }
  return undefined;
}

async function loadStoryTabArt(root: MainMenuNode,
  texture: (roots: string[], name: string) => Promise<Texture | undefined>,
  frames: () => Promise<MainMenuNode>): Promise<StoryTabArt> {
  const all = <T>(items: Array<T | undefined>): T[] => items.filter((item): item is T => !!item);
  const [completed, newBadge, board, lock, clear] = await Promise.all([
    texture(ROOTS, "클리어라벨"),
    Promise.all(["scenario_new_01", "scenario_new_05"].map(name => texture(ROOTS, name))).then(all),
    Promise.all([1, 2, 3, 4].map(index => texture(ROOTS, `scenario_select_chapter_btn_0${index}`)))
      .then(all),
    texture(ROOTS, "scenario_select_chapter_btn_lock"),
    texture(ROOTS, "img_clearIcon"),
  ]);
  let scrollbar: StoryTabArt["scrollbar"];
  try {
    // ScrollBar "scenario_bnt_listBar": the default vertical monocoque frames.
    const bar = findMenuNode(root, "scenario_bnt_listBar");
    const tree = await frames();
    const group = (key: string, fallback: string): WindowFrame[] =>
      (tree.children.find(child => child.name === ((bar && attribute(bar, key)) ?? fallback))
        ?.children ?? []).map(child => Ft(child) as WindowFrame);
    const area = group("scrollArea", "DefaultVerticalScrollArea")[0];
    const buttons = group("scrollButton", "DefaultVerticalScrollButton");
    if (area && buttons.length) {
      const images = new Map<string, Texture>();
      for (const frame of [area, ...buttons]) {
        if (!frame.texture || images.has(frame.texture)) continue;
        const image = await texture(["gui_/monocoque"], frame.texture);
        if (image) images.set(frame.texture, image);
      }
      scrollbar = { area, buttons, images,
        minButtonHeight: Number((bar && attribute(bar, "minScrollButtonHeight")) ?? 25) };
    }
  } catch {
    scrollbar = undefined;
  }
  return { completed, newBadge, board, lock, clear, scrollbar };
}

/** gui_/monocoque frame.bml TextButton: the frames of its four states and their texture. */
async function loadTextButtonArt(texture: (roots: string[], name: string) => Promise<Texture | undefined>,
  frames: () => Promise<MainMenuNode>): Promise<{ frames: WindowFrame[]; image: Texture } | undefined> {
  const tree = await frames();
  const states = (tree.children.find(child => child.name === "TextButton")?.children ?? [])
    .map(child => Ft(child) as WindowFrame);
  const image = states[0] ? await texture(["gui_/monocoque"], states[0].texture) : undefined;
  return image && states.length ? { frames: states, image } : undefined;
}

/** replayCard's ImageBoardButton states and its 删除 ImageButton. */
async function loadReplayTabArt(texture: (roots: string[], name: string) => Promise<Texture | undefined>):
  Promise<ReplayTabArt | undefined> {
  const card = await Promise.all([1, 2, 3, 4].map(index => texture(ROOTS, `replay_list_0${index}`)));
  const remove = await Promise.all([1, 2, 3, 4].map(index => texture(ROOTS, `btn_replayDelete_${index}`)));
  if (!card.every(Boolean)) return undefined;
  return { card: card as Texture[], remove: remove.every(Boolean) ? remove as Texture[] : [] };
}

/** "01:23:45" on a replay card (the ranking's record format). */
function formatCardTime(ms: number): string {
  if (!ms) return "—";
  const pad = (value: number) => Math.floor(Math.max(0, value)).toString().padStart(2, "0");
  return `${pad(ms / 60_000)}:${pad((ms / 1_000) % 60)}:${pad((ms / 10) % 100)}`;
}

/** NEW badges blink between their two images every 500 ms. */
const STORY_BLINK_MS = 500;

/** Canvas home screen over the Ready stage, below the shared taskbar. */
export class MainMenuView {
  readonly element = document.createElement("section");
  readonly canvas = document.createElement("canvas");
  private readonly context: CanvasRenderingContext2D;
  private readonly buttons: CanvasHitController<string>;
  private readonly observer?: ResizeObserver;
  private regions: Array<CanvasHitRegion<string>> = [];
  private hovered?: string;
  private pressed?: string;
  private banner = 0;
  private bannerTimer = 0;
  private disposed = false;
  private currentPage: MainMenuPage = "home";
  /** The single-play category shown; none is the overview (the five mode cards and the banner). */
  private category: SingleCategory | undefined;
  private story?: StoryMenuChapter[];
  private storyRow = 0;
  /** The 回放 pages' cards; undefined while a page loads. */
  private replays: Partial<Record<ReplayTab, ReplayMenuEntry[]>> = {};
  private replayPages: Record<ReplayTab, number> = { my: 0, league: 0, other: 0 };
  private replayTab: ReplayTab = "my";
  private replayHeader?: ReplayBrowseHeader;
  private storyFocus?: string;
  private storyListRect?: Rect;
  private license?: LicenseMenu;
  private licenseLevel?: number;
  /** The right panel's title strip, where the license pages are laid out. */
  private rightTitleRect?: Rect;

  constructor(readonly root: HTMLElement, readonly assets: MainMenuAssets,
    readonly options: MainMenuOptions) {
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("无法创建主菜单");
    this.context = context;
    this.element.dataset.uiLayer = "stage";
    this.element.setAttribute("aria-label", tr("主菜单"));
    // Above Ready's stage (1), below dialogs (3); the taskbar strip stays visible.
    Object.assign(this.element.style, { position: "absolute", inset: "0 0 7.333333%",
      zIndex: "2", userSelect: "none" });
    Object.assign(this.canvas.style, { position: "absolute", inset: "0",
      width: "100%", height: "100%" });
    this.element.append(this.canvas);
    root.append(this.element);
    this.buttons = new CanvasHitController(this.canvas, this.element,
      () => ({ width: STAGE.width, height: VISIBLE_HEIGHT }), (hovered, pressed) => {
        if (hovered !== undefined && hovered !== this.hovered) this.options.onHover?.();
        this.hovered = hovered;
        this.pressed = pressed;
        this.render();
      });
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.render());
      this.observer.observe(this.element);
    }
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    if (assets.banners.length > 1)
      this.bannerTimer = window.setInterval(() => this.showBanner(this.banner + 1),
        BANNER_INTERVAL_MS);
    this.render();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.clearInterval(this.bannerTimer);
    window.clearTimeout(this.storyBlinkTimer);
    this.observer?.disconnect();
    this.buttons.dispose();
    this.element.remove();
    if (!this.options.keepFont) G1(this.assets.font);
  }

  get page(): MainMenuPage {
    return this.currentPage;
  }

  get singleCategory(): SingleCategory | undefined {
    return this.category;
  }

  /** Switch between home and the single-play page; single play reopens on its overview. */
  setPage(page: MainMenuPage): void {
    if (page === this.currentPage) return;
    this.currentPage = page;
    this.category = undefined;
    this.element.setAttribute("aria-label", tr(page === "single" ? "单人游戏" : "主菜单"));
    this.render();
  }

  selectCategory(category: SingleCategory): void {
    this.category = category;
    this.render();
    this.options.onCategory?.(category);
  }

  /** The 驾照考试 tabs; undefined while they load. */
  setLicenseMenu(menu: LicenseMenu | undefined): void {
    this.license = menu;
    this.render();
  }

  /** The license tab shown on the 驾照考试 page. */
  get selectedLicense(): number {
    return this.licenseLevel ?? this.license?.selected ?? 1;
  }

  selectLicense(level: number): void {
    this.licenseLevel = level;
    const lock = this.license?.levels.find(entry => entry.level === level)?.lock;
    if (lock) this.showNotice(lock);
    this.render();
  }

  /** Chapters for the 故事模式 tab; undefined while they load. */
  setStoryChapters(chapters: StoryMenuChapter[] | undefined): void {
    this.story = chapters;
    this.storyRow = Math.min(this.storyRow, this.maxStoryRow());
    this.render();
  }

  /** Cards for a 回放 page; undefined while they load. */
  setReplays(tab: ReplayTab, entries: ReplayMenuEntry[] | undefined): void {
    this.replays[tab] = entries;
    this.replayPages[tab] = Math.min(this.replayPages[tab], this.maxReplayPage(tab));
    this.render();
  }

  /** 其他回放: the track and settings on its first card. */
  setReplayHeader(header: ReplayBrowseHeader | undefined): void {
    this.replayHeader = header;
    this.render();
  }

  get currentReplayTab(): ReplayTab { return this.replayTab; }

  /** Show a 回放 page (and ask for its cards). */
  showReplayTab(tab: ReplayTab): void {
    this.replayTab = tab;
    this.render();
    this.options.onReplayTab?.(tab);
  }

  /** 其他回放 keeps a settings card in its first slot. */
  private replayPerPage(tab: ReplayTab): number {
    return tab === "other" ? REPLAY_CARD.perPage - 1 : REPLAY_CARD.perPage;
  }

  private maxReplayPage(tab: ReplayTab): number {
    return Math.max(0, Math.ceil((this.replays[tab]?.length ?? 0) / this.replayPerPage(tab)) - 1);
  }

  private turnReplayPage(delta: number): void {
    const tab = this.replayTab;
    const next = Math.min(this.maxReplayPage(tab), Math.max(0, this.replayPages[tab] + delta));
    if (next === this.replayPages[tab]) return;
    this.replayPages[tab] = next;
    this.render();
  }

  private maxStoryRow(): number {
    return Math.max(0, Math.ceil((this.story?.length ?? 0) / 2) - 4);
  }

  private readonly onWheel = (event: WheelEvent): void => {
    if (this.currentPage === "single" && this.category === "cat_replay" && this.replays[this.replayTab]) {
      event.preventDefault();
      this.turnReplayPage(event.deltaY > 0 ? 1 : event.deltaY < 0 ? -1 : 0);
      return;
    }
    if (this.currentPage !== "single" || this.category !== "cat_scenario" || !this.story) return;
    event.preventDefault();
    const next = Math.min(this.maxStoryRow(), Math.max(0,
      this.storyRow + (event.deltaY > 0 ? 1 : event.deltaY < 0 ? -1 : 0)));
    if (next === this.storyRow) return;
    this.storyRow = next;
    this.render();
  };

  /** A short notice in the game's look (ui/game-popups.ts), for modes the Web build does not run yet. */
  showNotice(message: string): void {
    if (this.disposed) return;
    showGameToast(message, NOTICE_MS, { root: this.root });
  }

  showBanner(index: number): void {
    const count = this.assets.banners.length;
    if (!count) return;
    this.banner = ((index % count) + count) % count;
    this.render();
  }

  render(): void {
    if (this.disposed) return;
    const width = this.element.clientWidth;
    const height = this.element.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    const context = this.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, pixelWidth, pixelHeight);
    context.setTransform(width / STAGE.width * ratio, 0, 0, height / VISIBLE_HEIGHT * ratio, 0, 0);
    context.imageSmoothingQuality = "high";
    this.regions = [];
    drawMainMenuBackdrop(context, this.assets.backdrop,
      { x: 0, y: 0, width: STAGE.width, height: VISIBLE_HEIGHT });
    const rect = V0(this.assets.root, STAGE) as Rect;
    for (const child of this.assets.root.children) {
      const name = attribute(child, "name") ?? "";
      if (this.currentPage === "single" ? !name || name === SINGLE_PAGE
        : !name || SHOWN.has(name)) this.draw(child, rect);
    }
    if (this.currentPage === "single" && this.category === "cat_riderSchool") this.drawRiderSchool();
    if (this.currentPage === "single") {
      if (this.options.onCustomGame) this.drawSingleModeButton("customGame", "地图工坊", 540, this.options.onCustomGame);
      if (this.options.onFormula) this.drawSingleModeButton("formula", "极速方程", 400, this.options.onFormula);
    }
    this.buttons.update(this.regions);
  }

  private draw(node: MainMenuNode, parent: Rect, menu?: string): void {
    const name = attribute(node, "name") ?? "";
    if (node.name === "Skip" || (attribute(node, "visible") === "false" &&
        name !== SINGLE_PAGE && !this.forcedVisible(name))) return;
    if (!this.singleNodeShown(node, name)) return;
    const textures = this.assets.textures.get(node) ?? this.assets.riderSchool?.textures.get(node);
    const rect = V0(node, parent, undefined, textures?.[0]) as Rect;

    if ((node.name === "ImageButton" || node.name === "ImageBoardButton") && textures) {
      // The same category names sit in two tab menus; keep their hit keys apart.
      const key = menu ? `${menu}:${name}` : name;
      const action = this.action(name);
      const selected = (name === this.category &&
        (menu === "singleplay_cats" || menu === "singleplay_subCats")) ||
        (this.category === "cat_riderSchool" && name === `riderSchool_Level${this.selectedLicense}`) ||
        (this.category === "cat_replay" && menu === "cats" && name === `replay_${this.replayTab}`);
      const state = selected ? 2 : action ? st(key, this.hovered, this.pressed) : 3;
      ct(this.context, textures[state]!, rect);
      if (action) this.regions.push({ key, rect, label: this.label(node, name),
        activate: () => { this.options.onActivate?.(); action(); } });
    } else if (textures) {
      const texture = textures[0]!;
      const uv = attribute(node, "uvRect")?.split(/\s+/).map(Number);
      if (uv?.length === 4)
        this.context.drawImage(texture.image, uv[0]!, uv[1]!, uv[2]! - uv[0]!,
          uv[3]! - uv[1]!, rect.x, rect.y, rect.width, rect.height);
      else this.context.drawImage(texture.image, rect.x, rect.y, rect.width, rect.height);
    }

    if (name === "rightTitleName") this.rightTitleRect = parent;
    // The overview: the lobby's promotion banner under the five mode cards.
    if (name === "singleplay_subCats" && this.currentPage === "single" && this.category === undefined)
      this.drawOverviewBanner(rect);
    if (name === "favoriteChannel") this.drawChannels(rect);
    if (name === "promotionNew") this.drawBanner(rect);
    if (name === "scenario_bnt_list") this.drawStoryList(rect);
    if (this.category === "cat_replay" && this.currentPage === "single" &&
        (name === "my" || name === "league" || name === "other") && name === this.replayTab) this.drawReplayList(rect, name);
    if (this.category === "cat_riderSchool" && this.currentPage === "single") {
      if (name === "grid") this.drawLicenseSteps(rect);
      if (name === "mainEmblemText" && this.license) {
        const lines = (this.assets.strings.get("licenseProInfo2") ?? "")
          .replace("%s", this.license.pro.emblemName).replaceAll("&apos;", "'").split("|");
        lines.forEach((line, index) => m9(this.context, line,
          { x: rect.x, y: rect.y + index * 24, width: 560, height: 22 }, {
            family: FONT_FAMILY, size: 16, kind: "label", color: "rgb(42,55,80)", align: "left",
            verticalAlign: "top", stroke: 0, strokeColor: "black" }));
      }
      if (name === "mainEmblem0" && this.license?.pro.emblem) {
        const emblem = this.license.pro.emblem;
        this.context.drawImage(emblem.image, rect.x, rect.y, rect.width, rect.height);
      }
      const row = /^proTrackName([0-2])$/.exec(name);
      const entry = row && this.license?.pro.rows[Number(row[1])];
      if (entry && this.options.onLicenseQualify) {
        const key = `license-qualify:${entry.track}`;
        if (this.hovered === key) {
          this.context.save();
          this.context.strokeStyle = "rgba(16,136,199,.9)";
          this.context.lineWidth = 2;
          this.context.strokeRect(parent.x + 1, parent.y + 1, parent.width - 2, parent.height - 2);
          this.context.restore();
        }
        this.regions.push({ key, rect: parent, label: tr("资格审核：{0}", { "0": entry.title }), activate: () => {
          this.options.onActivate?.();
          this.options.onLicenseQualify!(entry.track);
        } });
      }
      const mission = /^button([01])$/.exec(name);
      const step = mission && this.license?.pro.missions[Number(mission[1])];
      if (step?.cleared) {
        const clear = node.children.find(child => attribute(child, "name") === "clear");
        const clearTexture = clear && this.assets.riderSchool?.textures.get(clear)?.[0];
        if (clear && clearTexture) {
          const at = V0(clear, rect, undefined, clearTexture) as Rect;
          this.context.drawImage(clearTexture.image, at.x, at.y, at.width, at.height);
        }
      }
      if (step) {
        // The boards are the same every period: name the period's course on them.
        for (const [dy, color] of [[1, "rgba(0,0,0,.8)"], [0, "white"]] as const)
          m9(this.context, `${step.name}    ${step.detail}`, { x: rect.x + 24, y: rect.y + rect.height - 46 + dy,
            width: rect.width - 48, height: 30 }, { family: FONT_FAMILY, size: 18, kind: "label", color,
            align: "left", verticalAlign: "center", stroke: 0, strokeColor: "black" });
      }
      if (step && !step.open) {
        this.context.save();
        this.context.fillStyle = "rgba(255,255,255,.45)";
        this.context.fillRect(rect.x, rect.y, rect.width, rect.height);
        this.context.restore();
      }
    }
    if (name === "scenario_grid") this.drawStoryInfo(rect);
    if (name === "scenario_bnt_listBar") this.drawStoryScrollbar(rect);
    // promotionRadioGroup's windowRect is degenerate; centre the dots on the strip.
    if (name === "promotionRadioBg") this.drawBannerDots(rect);

    const text = this.text(node);
    if (text) this.drawLabel(node, text, rect);
    const childMenu = node.name === "TabMenu" ? name : menu;
    for (const child of node.children) this.draw(child, rect, childMenu);
  }

  /** Which parts of "singleplay_pop" the current category shows. */
  private singleNodeShown(node: MainMenuNode, name: string): boolean {
    if (this.currentPage !== "single") return true;
    if (node.name === "TabPage") {
      // Category pages; their per-level pages open from cards that are not run here.
      // 回放 shows its 我的回放 page (联赛 / 其他 are not built).
      return name === this.category || (this.category === "cat_replay" && name === `replay_${this.replayTab}`);
    }
    if (name === "singleplay_subCats") return this.category === undefined || !RIGHT_FILLED.has(this.category);
    return true;
  }

  private action(name: string): (() => void) | undefined {
    if (name === "timeAttackCompetitiveBtn") return () => this.options.onTimeAttack();
    if (this.currentPage !== "single") return undefined;
    if ((SINGLE_CATEGORIES as readonly string[]).includes(name))
      return () => this.selectCategory(name as SingleCategory);
    if (name === "timeAttack_train") return () => (this.options.onPractice ??
      this.options.onTimeAttack)();
    if (name === "timeAttack_ranking" && this.options.onRanking) return () => this.options.onRanking!();
    if (this.category === "cat_replay") {
      const tab = /^replay_(my|league|other)$/.exec(name)?.[1] as ReplayTab | undefined;
      if (tab) return () => { if (tab !== this.replayTab) this.showReplayTab(tab); };
      const page = this.replayPages[this.replayTab];
      if (name === "prev") return page > 0 ? () => this.turnReplayPage(-1) : undefined;
      if (name === "next") return page < this.maxReplayPage(this.replayTab) ? () => this.turnReplayPage(1) : undefined;
    }
    // 竞争排位赛 (seasonal ranked, dialog2_timeAttackCompetitive) is not built yet.
    if (name === "timeAttack_competitive") return () => this.showNotice(tr("竞争排位赛暂未开放"));
    const license = /^riderSchool_Level([1-6])$/.exec(name);
    if (license) return () => this.selectLicense(Number(license[1]));
    if (this.category === "cat_riderSchool" && this.license) {
      const level = this.selectedLicense;
      const tab = this.license.levels.find(entry => entry.level === level);
      if (name === "updateLevel") {
        const can = level === 6 ? this.license.pro.canTake : tab?.canTake;
        return can && this.options.onLicenseTake ? () => this.options.onLicenseTake!(level) : undefined;
      }
      if (name === "rewardEmblem")
        return this.license.pro.canClaim && this.options.onLicenseEmblem
          ? () => this.options.onLicenseEmblem!() : undefined;
      const mission = /^button([01])$/.exec(name);
      if (mission) {
        const step = this.license.pro.missions[Number(mission[1])];
        return step?.open && this.options.onLicenseStep ? () => this.options.onLicenseStep!(step.step) : undefined;
      }
    }
    if (SINGLE_LABELS[name])
      return () => this.showNotice(tr("{0}暂未开放", { "0": SINGLE_LABELS[name]! }));
    return undefined;
  }

  /** Release nodes the license pages show although they ship hidden. */
  private forcedVisible(name: string): boolean {
    const badge = /^clearLevel([1-6])$/.exec(name);
    if (badge && this.category === "cat_riderSchool")
      return !!this.license?.levels.find(entry => entry.level === Number(badge[1]))?.taken;
    return false;
  }

  /** Texts the license pages fill in. */
  private licenseText(name: string): string | undefined {
    if (this.currentPage !== "single" || this.category !== "cat_riderSchool") return undefined;
    if (name === "rightTitleName") return this.assets.strings.get("license") ?? tr("驾照考试");
    const pro = this.license?.pro;
    if (!pro) return undefined;
    const row = /^proTrack(Name|Record)([0-2])$/.exec(name);
    if (row) {
      const entry = pro.rows[Number(row[2])];
      return row[1] === "Name" ? entry?.title ?? "" : entry?.record ?? "-";
    }
    // Drawn line by line where the page is laid out.
    if (name === "mainEmblemText") return "";
    return undefined;
  }

  /** The selected license tab's page on the right: riderSchoolPage, Pro1 or Pro2. */
  private drawRiderSchool(): void {
    const art = this.assets.riderSchool;
    const title = this.rightTitleRect;
    if (!art || !title) return;
    const window = { x: title.x, y: title.y, width: 776, height: 634 };
    const area = { x: window.x, y: window.y + 48, width: 776, height: 586 };
    if (!this.license) {
      this.drawStoryText(tr("正在读取驾照信息…"), area, 18, "rgb(42,55,80)", "center");
      return;
    }
    const level = this.selectedLicense;
    if (level === 6) {
      const pro = this.license.pro;
      const tab = this.license.levels.find(entry => entry.level === 6);
      if (tab?.lock) {
        this.draw(art.page, window);
        this.drawStoryText(tab.lock, { ...area, y: area.y + 160, height: 40 }, 18, "rgb(42,55,80)", "center");
        return;
      }
      this.draw(pro.qualified ? art.pro2 : art.pro1, window);
      if (!pro.qualified)
        this.drawStoryText(tr("* 点击完成条件，即可用标准速度进行资格审核计时赛。"),
          { x: area.x + 17, y: area.y + 495, width: 480, height: 20 }, 16, "rgb(42,55,80)", "left");
      if (pro.status)
        this.drawStoryText(pro.status, { x: area.x + 17, y: area.y + 455, width: 480, height: 24 }, 16,
          "rgb(16,136,199)", "left");
      return;
    }
    this.draw(art.page, window);
  }

  /** riderSchoolPage "grid": the license's step cards (riderSchoolStepCard). */
  private drawLicenseSteps(grid: Rect): void {
    const art = this.assets.riderSchool;
    const tab = this.license?.levels.find(entry => entry.level === this.selectedLicense);
    if (!art || !tab || this.selectedLicense === 6) return;
    const context = this.context;
    const x = grid.x + (grid.width - LICENSE_CARD.width) / 2;
    const color = (key: string, fallback: string): string => mainMenuColor(attribute(art.card, key), fallback);
    tab.steps.forEach((step, index) => {
      const box = { x, y: grid.y + index * (LICENSE_CARD.height + LICENSE_CARD.gap),
        width: LICENSE_CARD.width, height: LICENSE_CARD.height };
      const key = `license-step:${step.step}`;
      const state = step.open ? st(key, this.hovered, this.pressed) : 3;
      const frame = art.frames[state] ?? art.frames[0];
      const image = frame && art.frameImages.get(frame.texture);
      if (frame && image) C9(context, frame, image.image, box);
      const icon = step.icon?.[state] ?? step.icon?.[0];
      // iconPos "-41 2": the icon is centred 41 px in from the card's left edge.
      if (icon) context.drawImage(icon.image, box.x + 41 - icon.width / 2,
        box.y + (box.height - icon.height) / 2 + 2, icon.width, icon.height);
      const textColor = !step.open ? color("disabledTextColor", "rgb(103,103,103)")
        : state === 1 ? color("overTextColor", "rgb(16,136,199)")
          : state === 2 ? color("clickedTextColor", "rgb(48,73,81)") : color("textColor", "rgb(42,55,80)");
      m9(context, `${index + 1}. ${step.name}`, { x: box.x + 83, y: box.y, width: 360, height: box.height }, {
        family: FONT_FAMILY, size: 20, kind: "label", color: textColor, align: "left",
        verticalAlign: "center", stroke: 0, strokeColor: "black" });
      m9(context, step.detail, { x: box.x + 400, y: box.y, width: 220, height: box.height }, {
        family: FONT_FAMILY, size: 14, kind: "label", color: step.open ? "rgb(72,106,163)" : "rgb(130,130,130)",
        align: "right", verticalAlign: "center", stroke: 0, strokeColor: "black" });
      const clear = art.card.children.find(child => attribute(child, "name") === "clear");
      const clearTexture = clear && art.textures.get(clear)?.[0];
      if (step.cleared && clear && clearTexture) {
        // The card's children lay out in the RiderSchoolButton client area (46 px borders):
        // adjust "-40 -1" stamps 过关 over the arrow, 6 px inside the right edge.
        const client = art.frames[0] ? E9(art.frames[0], box) as Rect : box;
        const at = V0(clear, client, undefined, clearTexture) as Rect;
        context.drawImage(clearTexture.image, at.x, at.y, at.width, at.height);
      }
      if (step.open && this.options.onLicenseStep)
        this.regions.push({ key, rect: box, label: step.name, activate: () => {
          this.options.onActivate?.();
          this.options.onLicenseStep!(step.step);
        } });
    });
    if (tab.lock)
      this.drawStoryText(tab.lock, { x: grid.x, y: grid.y + 6 * (LICENSE_CARD.height + LICENSE_CARD.gap) - 30,
        width: grid.width, height: 24 }, 16, "rgb(200,60,60)", "center");
  }

  private drawStoryList(rect: Rect): void {
    const context = this.context;
    this.storyListRect = rect;
    if (!this.story) return;
    const art = this.assets.story;
    const blink = Math.floor(performance.now() / STORY_BLINK_MS) % 2;
    let blinking = false;
    const first = this.storyRow * 2;
    this.story.slice(first, first + 8).forEach((chapter, offset) => {
      const index = first + offset;
      const box = {
        x: rect.x + (index % 2) * (STORY_CARD.width + STORY_CARD.gapX),
        y: rect.y + Math.floor(offset / 2) * (STORY_CARD.height + STORY_CARD.gapY),
        width: STORY_CARD.width, height: STORY_CARD.height,
      };
      const key = `story:${chapter.name}`;
      const states = chapter.card;
      if (states?.length === 4)
        ct(context, states[chapter.open ? st(key, this.hovered, this.pressed) : 3]!, box);
      else if (states?.[0]) {
        // One-image cards: the release greys a locked ImageButton out.
        context.save();
        if (!chapter.open) context.filter = "grayscale(1) brightness(.7)";
        else if (this.hovered === key) context.filter = "brightness(1.12)";
        context.drawImage(states[0].image, box.x, box.y, box.width, box.height);
        context.restore();
      }
      // scenarioCard: chapterCompleted at the card's corner, chapterNew top right.
      if (chapter.cleared && art?.completed)
        context.drawImage(art.completed.image, box.x, box.y, art.completed.width,
          art.completed.height);
      const badge = art?.newBadge[blink] ?? art?.newBadge[0];
      if (chapter.showNew && !chapter.cleared && badge) {
        blinking = true;
        context.drawImage(badge.image, box.x + box.width - badge.width, box.y - 2,
          badge.width, badge.height);
      }
      this.regions.push({ key, rect: box, label: `${chapter.subTitle ?? ""}${chapter.title}`,
        activate: () => {
          this.storyFocus = chapter.name;
          // A locked chapter only shows its locked board on the right.
          if (!chapter.open) {
            this.render();
            return;
          }
          this.options.onActivate?.();
          this.options.onStoryChapter?.(chapter.name);
        } });
    });
    if (blinking) this.scheduleStoryBlink();
  }

  private storyBlinkTimer = 0;

  private scheduleStoryBlink(): void {
    if (this.storyBlinkTimer) return;
    this.storyBlinkTimer = window.setTimeout(() => {
      this.storyBlinkTimer = 0;
      if (this.currentPage === "single" && this.category === "cat_scenario") this.render();
    }, STORY_BLINK_MS - (performance.now() % STORY_BLINK_MS));
  }

  /**
   * 回放 lists: stage_mainMenu replayCard rows (750×128): the title line, 删除
   * at the corner of a local record, and the 车手 / 日期 / 赛道 columns; this
   * build adds 卡丁车 / 记录 / 设置 beside them. 其他回放 keeps its track and
   * settings card in the first slot.
   */
  private drawReplayList(rect: Rect, tab: ReplayTab): void {
    const context = this.context;
    const art = this.assets.replay;
    const label = (text: string, box: Rect, size: number, color: string, align: "left" | "center") =>
      m9(context, text, box, { family: FONT_FAMILY, size, kind: "label", color, align,
        verticalAlign: "center", stroke: 0, strokeColor: "black" });
    const slot = (index: number): Rect => ({ x: rect.x - 1, y: rect.y + index * (REPLAY_CARD.height + REPLAY_CARD.gap),
      width: REPLAY_CARD.width, height: REPLAY_CARD.height });
    const face = (key: string | undefined, box: Rect): void => {
      const image = (key ? art?.card[st(key, this.hovered, this.pressed)] : undefined) ?? art?.card[0];
      if (image) context.drawImage(image.image, box.x, box.y, box.width, box.height);
      else {
        context.save();
        context.fillStyle = key && this.hovered === key ? "rgba(255,255,255,.9)" : "rgba(240,244,250,.9)";
        context.fillRect(box.x, box.y, box.width, box.height);
        context.restore();
      }
    };
    const column = (box: Rect, left: number, rows: Array<[string, string]>): void => {
      rows.forEach(([caption, value], row) => {
        const y = box.y + 44 + row * 22;
        label(caption, { x: box.x + left, y: y - 2, width: 83, height: 18 }, 14, "rgb(88,105,129)", "left");
        context.save();
        context.fillStyle = "rgb(170,176,190)";
        context.fillRect(box.x + left + 83, y, 1, 18);
        context.restore();
        label(value, { x: box.x + left + 95, y: y - 2, width: 270, height: 18 }, 14, "rgb(42,55,80)", "left");
      });
    };
    let listTop = rect.y;
    if (tab === "other") {
      // The settings card: the track and settings, with 选择赛道 / 切换速度 / 切换模式.
      const box = slot(0);
      face(undefined, box);
      label(tr("其他回放　排位榜上其他车手的录像"), { x: box.x, y: box.y, width: 722, height: 31 }, 20, "white", "center");
      const header = this.replayHeader;
      column(box, 18, [[tr("赛道"), header?.trackTitle ?? "—"], [tr("设置"), header?.settings ?? "—"]]);
      const buttons: Array<[string, string, (() => void) | undefined]> = [
        ["replay-pick-track", tr("选择赛道"), this.options.onReplayPickTrack],
        ["replay-setting-speed", tr("切换速度"), this.options.onReplaySetting && (() => this.options.onReplaySetting!("speed"))],
        ["replay-setting-booster", tr("切换模式"), this.options.onReplaySetting && (() => this.options.onReplaySetting!("booster"))],
      ];
      buttons.forEach(([key, text, action], index) => {
        const button = { x: box.x + 430 + index * 104, y: box.y + 62, width: 96, height: 32 };
        context.save();
        context.fillStyle = !action ? "rgba(160,170,185,.6)" : this.pressed === key ? "rgb(16,110,180)"
          : this.hovered === key ? "rgb(52,150,230)" : "rgb(36,129,255)";
        context.beginPath();
        context.roundRect(button.x, button.y, button.width, button.height, 6);
        context.fill();
        context.restore();
        label(text, button, 15, "white", "center");
        if (action) this.regions.push({ key, rect: button, label: tr(text), activate: () => {
          this.options.onActivate?.();
          action();
        } });
      });
      listTop = box.y + box.height + REPLAY_CARD.gap;
    }
    const entries = this.replays[tab];
    const listRect = { x: rect.x, y: listTop, width: rect.width, height: 60 };
    if (!entries) {
      label(tr("读取中…"), listRect, 16, "rgb(88,105,129)", "center");
      return;
    }
    if (entries.length === 0) {
      const empty = tab === "my" ? tr("还没有回放记录。完成练习计时赛或排位计时赛后，这里会保存你的跑法。")
        : tab === "league" ? tr("管理员还没有发布联赛回放。") : tr("这个赛道和设置的排位榜上还没有带录像的纪录。");
      label(empty, listRect, 16, "rgb(88,105,129)", "center");
      return;
    }
    const perPage = this.replayPerPage(tab);
    const first = this.replayPages[tab] * perPage;
    const offset0 = tab === "other" ? 1 : 0;
    entries.slice(first, first + perPage).forEach((entry, offset) => {
      const box = slot(offset0 + offset);
      const key = `replay:${entry.key}`;
      const removeKey = `replay-delete:${entry.key}`;
      face(key, box);
      label(entry.title, { x: box.x, y: box.y, width: 722, height: 31 }, 20, "white", "center");
      column(box, 18, [[tr("车手"), entry.displayRiderName ?? entry.riderName], [tr("日期 / 时间"), entry.dateText], [tr("赛道"), entry.trackTitle]]);
      column(box, 400, [[tr("卡丁车"), entry.kartName || "—"], [tr("记录"), formatCardTime(entry.elapsedMs)], [tr("设置"), entry.settings]]);
      if (entry.note)
        label(entry.note, { x: box.x + 18, y: box.y + 106, width: 700, height: 18 }, 13, "rgb(88,105,129)", "left");
      this.regions.push({ key, rect: box, label: tr("回放：{0}", { "0": entry.title }), activate: () => {
        this.options.onActivate?.();
        this.options.onReplay?.(entry);
      } });
      if (entry.deletable && this.options.onReplayDelete) {
        const remove = { x: box.x + box.width - 26 - 3, y: box.y + 2, width: 26, height: 26 };
        const state = art?.remove[st(removeKey, this.hovered, this.pressed)];
        if (state) context.drawImage(state.image, remove.x, remove.y, remove.width, remove.height);
        else label("×", remove, 18, this.hovered === removeKey ? "white" : "rgb(220,220,220)", "center");
        this.regions.push({ key: removeKey, rect: remove, label: tr("删除回放：{0}", { "0": entry.title }), activate: () => {
          this.options.onActivate?.();
          this.options.onReplayDelete!(entry);
        } });
      }
    });
    // Hit regions are tested last-first: the 删除 buttons go after their cards above.
  }

  /** ScrollBar "scenario_bnt_listBar" in its monocoque frames. */
  private drawStoryScrollbar(rect: Rect): void {
    const bar = this.assets.story?.scrollbar;
    const rows = Math.ceil((this.story?.length ?? 0) / 2);
    if (!bar || rows <= 4) return;
    const geometry = scrollbarGeometry({ minButtonHeight: bar.minButtonHeight }, rect,
      rows / 4, this.storyRow / 4);
    const paint = (frame: WindowFrame, area: Rect): void => {
      const image = this.assets.story?.scrollbar?.images.get(frame.texture);
      if (image) C9(this.context, frame, image.image, area);
    };
    paint(bar.area, geometry.area);
    paint(bar.buttons[0]!, geometry.button);
  }

  /** The hovered or last chosen chapter, else the first one still to play. */
  private storyChapterShown(): StoryMenuChapter | undefined {
    const hovered = this.hovered?.startsWith("story:") ? this.hovered.slice(6) : undefined;
    const wanted = hovered ?? this.storyFocus;
    return this.story?.find(chapter => chapter.name === wanted) ??
      this.story?.find(chapter => chapter.open && !chapter.cleared) ?? this.story?.[0];
  }

  /**
   * stage_mainMenu scenarioChapterCard: the 750×140 chapter board with its
   * picture (bgImg), title and story, lock cover, clear icon and NEW badge.
   */
  private drawStoryInfo(rect: Rect): void {
    const chapter = this.storyChapterShown();
    const art = this.assets.story;
    if (!chapter || !art) return;
    const context = this.context;
    const board = { x: rect.x, y: rect.y, width: 750, height: 140 };
    const face = art.board[0];
    if (face) ct(context, face, board);
    if (chapter.sub)
      context.drawImage(chapter.sub.image, board.x + board.width - 420 - 2,
        board.y + board.height - 103 - 5, 420, 103);
    const label = { x: board.x + 25, width: 700 };
    m9(context, chapter.title, { ...label, y: board.y + 4, height: 25 }, {
      family: FONT_FAMILY, size: 16, kind: "label", color: "white", align: "center",
      verticalAlign: "center", stroke: 0, strokeColor: "black" });
    // story over its white storyShadow one pixel lower.
    context.save();
    const localized = gameLocale() !== "zh-CN";
    let fontSize = 14;
    let lineStep = 21;
    let lines: string[] = [];
    do {
      context.font = `${fontSize}px "${FONT_FAMILY}"`;
      lines = [];
      for (const paragraph of chapter.desc.split("\n")) {
        let current = "";
        for (const character of paragraph) {
          if (current && context.measureText(current + character).width > label.width) {
            lines.push(current);
            current = "";
          }
          current += character;
        }
        lines.push(current);
      }
      if (!localized || lines.length * lineStep <= 84 || fontSize <= 8) break;
      fontSize--;
      lineStep = fontSize + 3;
    } while (true);
    context.restore();
    (localized ? lines : lines.slice(0, 4)).forEach((line, index) => {
      for (const [dy, color] of [[1, "white"], [0, "rgb(42,55,80)"]] as const)
        m9(context, line, { ...label, y: board.y + 39 + dy + index * lineStep, height: lineStep }, {
          family: FONT_FAMILY, size: fontSize, kind: "label", color, align: "left",
          verticalAlign: "top", stroke: 0, strokeColor: "black" });
    });
    if (!chapter.open && art.lock) ct(context, art.lock, board);
    if (chapter.cleared && art.clear)
      context.drawImage(art.clear.image, board.x + board.width - 72, board.y + board.height - 72,
        72, 72);
    const badge = art.newBadge[Math.floor(performance.now() / STORY_BLINK_MS) % 2] ?? art.newBadge[0];
    if (chapter.showNew && !chapter.cleared && badge) {
      context.drawImage(badge.image, board.x + board.width - badge.width - 6, board.y + 7,
        badge.width, badge.height);
      this.scheduleStoryBlink();
    }
  }

  private drawStoryText(text: string, rect: Rect, size: number, color: string,
    align: "left" | "center"): void {
    m9(this.context, tr(text), rect, { family: FONT_FAMILY, size, kind: "label", color, align,
      verticalAlign: "center", stroke: 0, strokeColor: "black" });
  }

  /** Extra single-player modes on the release title bar (monocoque TextButtons). */
  private drawSingleModeButton(key: string, title: string, x: number, activate: () => void): void {
    const art = this.assets.textButton;
    const rect = { x, y: 131, width: 128, height: 32 };
    const state = st(key, this.hovered, this.pressed);
    const frame = art?.frames[state] ?? art?.frames[0];
    if (art && frame) C9(this.context, frame, art.image.image, rect);
    else {
      this.context.fillStyle = state ? "rgb(255,214,120)" : "rgb(240,244,250)";
      this.context.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    m9(this.context, tr(title), { x: rect.x, y: rect.y + (state === 2 ? 1 : 0), width: rect.width, height: rect.height }, {
      family: FONT_FAMILY, size: 16, kind: "label", color: "rgb(42,55,80)", align: "center",
      verticalAlign: "center", stroke: 0, strokeColor: "black" });
    this.regions.push({ key, rect, label: tr(title),
      activate: () => { this.options.onActivate?.(); activate(); } });
  }



  private text(node: MainMenuNode): string | undefined {
    const override = this.licenseText(attribute(node, "name") ?? "");
    if (override !== undefined) return override;
    // The right panel is titled after the category it shows (计时赛 …), 单人游戏 on the overview.
    if (attribute(node, "name") === "rightTitleName" && this.currentPage === "single" && this.category &&
        RIGHT_FILLED.has(this.category))
      return tr(SINGLE_LABELS[this.category] ?? this.assets.strings.get("singlePlay") ?? "单人游戏");
    const raw = attribute(node, "text");
    if (!raw) return undefined;
    const key = /^#sb\(([^)]+)\)$/.exec(raw)?.[1];
    const value = key ? this.assets.strings.get(key) : raw;
    // The shared StringBag row describes the PRO emblem. Ordinary license
    // pages must name their own button in every language.
    if (key === "licenseInfo1" && this.category === "cat_riderSchool" && this.selectedLicense !== 6)
      return tr("* 完成所有任务后，点击下方的“获得驾照”按钮。");
    return value === undefined ? undefined : tr(value);
  }

  private label(node: MainMenuNode, name: string): string {
    if (name === "timeAttackCompetitiveBtn") return tr("计时赛");
    if (name === "prev") return tr("上一页");
    if (name === "next") return tr("下一页");
    return tr(SINGLE_LABELS[name] ?? this.text(node) ?? name);
  }

  private drawLabel(node: MainMenuNode, text: string, rect: Rect): void {
    const alignment = attribute(node, "textAlign") ?? "";
    const render = attribute(node, "textRender") ?? "";
    const size = Number(/\d+/.exec(render)?.[0] ?? 14);
    const disabled = node.name === "ImageButton" && !this.action(attribute(node, "name") ?? "");
    const stringPos = attribute(node, "stringPos")?.split(/\s+/).map(Number) ?? [0, 0];
    m9(this.context, text, { ...rect, x: rect.x + (stringPos[0] ?? 0) }, {
      family: FONT_FAMILY, size, kind: "label",
      color: mainMenuColor(attribute(node, disabled ? "disabledTextColor" : "textColor")),
      align: alignment.includes("right") ? "right"
        : alignment === "center" || alignment.includes("hcenter") ? "center" : "left",
      verticalAlign: alignment.includes("vcenter") || alignment === "center" ? "center" : "top",
      stroke: render.startsWith("outline") ? 1 : 0, strokeColor: "black",
    });
  }

  /** GridSelector "favoriteChannel": one column, 8px apart, release channel buttons. */
  private drawChannels(rect: Rect): void {
    let y = rect.y;
    for (const entry of this.assets.channels) {
      const first = entry.states[0]!;
      const box = { x: rect.x + (rect.width - first.width) / 2, y,
        width: first.width, height: first.height };
      const key = `channel:${entry.channel}`;
      ct(this.context, entry.states[st(key, this.hovered, this.pressed)]!, box);
      this.regions.push({ key, rect: box, label: entry.channel === "speedTeamCombine"
        ? tr("组队竞速频道") : tr("个人竞速频道"), activate: () => {
        this.options.onActivate?.();
        this.options.onChannel(entry.channel);
      } });
      y += first.height + 8;
    }
  }

  /** The overview's banner strip below the mode cards (the right panel is 586 tall, the cards 348). */
  private drawOverviewBanner(cards: Rect): void {
    const banner = { x: cards.x + 14, y: cards.y + cards.height - 6, width: cards.width - 28, height: 586 - cards.height - 24 };
    this.drawBanner(banner);
    this.drawBannerDots({ x: banner.x, y: banner.y + banner.height - 2, width: banner.width, height: 24 });
  }

  private drawBanner(rect: Rect): void {
    const banner = this.assets.banners[this.banner];
    if (!banner) return;
    const crop = coverCrop(banner, rect);
    this.context.drawImage(banner.image, crop.x, crop.y, crop.width, crop.height,
      rect.x, rect.y, rect.width, rect.height);
  }

  /** Radio dots below the carousel, centred on the promotionRadioBg strip. */
  private drawBannerDots(rect: Rect): void {
    const count = this.assets.banners.length;
    if (count < 2) return;
    const gap = 22;
    const start = rect.x + rect.width / 2 - ((count - 1) * gap) / 2;
    const y = rect.y + rect.height / 2;
    for (let index = 0; index < count; index++) {
      const x = start + index * gap;
      const key = `banner:${index}`;
      const context = this.context;
      context.beginPath();
      context.arc(x, y, 6, 0, Math.PI * 2);
      context.fillStyle = index === this.banner ? "#ffd84a"
        : this.hovered === key ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.45)";
      context.fill();
      this.regions.push({ key, rect: { x: x - 9, y: y - 9, width: 18, height: 18 },
        label: tr("宣传图 {0}", { "0": index + 1 }), activate: () => this.showBanner(index) });
    }
  }
}
