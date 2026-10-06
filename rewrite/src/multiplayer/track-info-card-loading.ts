/** Finds the exact P3553 track card sources and creates the in-race card. */

interface SourceEntry {
  bytes(): Promise<Uint8Array>;
  text(): Promise<string>;
}

interface TrackCardLibrary {
  get(path: string): SourceEntry | undefined;
  exactCanonicalCandidates(path: string): SourceEntry[];
}

interface ImageResource { image: unknown; width: number; height: number }
interface CardLayout {
  width: number;
  height: number;
  cardHeight: number;
  stripHeight: number;
  stripCount: number;
  stripIndex: unknown;
  trackRect: { x: number; y: number; width: number; height: number };
}

export interface TrackCardLoadOptions {
  library: TrackCardLibrary;
  root: unknown;
  trackDirectory: string;
  trackId: string;
  trackTitle: string;
  difficulty?: number;
  game: { team?: number; modeKey: string; modeSuffixKey?: string;
    speed: number };
}

export interface TrackCardLoadDependencies<T> {
  configEnabled(library: TrackCardLibrary): Promise<boolean>;
  cardPath(trackDirectory: string): string;
  parseXml(text: string, path: string): Map<string, string>;
  gameLabels(game: TrackCardLoadOptions["game"],
    labels: Map<string, string>): unknown;
  uniqueResource(library: TrackCardLibrary, path: string): SourceEntry;
  parseNode(bytes: Uint8Array): unknown;
  layout(node: unknown): CardLayout;
  stripIndex(defaultIndex: unknown, team: number | undefined): unknown;
  decodeImage(source: SourceEntry): Promise<ImageResource>;
  difficultyLayout(node: unknown, trackRect: CardLayout["trackRect"],
    text: ImageResource, glyphs: ImageResource): unknown;
  registerFont(family: string, bytes: Uint8Array): Promise<unknown>;
  releaseFont(font: unknown): void;
  title(title: string, trackId: string): string;
  create(root: unknown, title: string, difficulty: number | undefined,
    bgmTitles: Map<string, string>, gameLabels: unknown,
    assets: Record<string, unknown>): T;
}

const configPath = "zeta_/cn/content/config.xml";
const bgmPath = "etc_/bgmList.xml";
const stringsPath = "etc_/baseStringBag.xml";
const layoutPath = "gui_/windowTemplate/trackInfoCard.bml";
const framePath = "gui_/windowTemplate/trackcard.png";
const labelPath = "gui_/windowTemplate/trackInfoLabel.png";
const difficultyPath = "gui_/windowTemplate/trackDifficulty.bml";
const difficultyTextPath = "gui_/windowTemplate/난이도text@cn.png";
const difficultyGlyphPath = "gui_/windowTemplate/난이도원.png";
const reversePath = "stage_/common/큰리버스트랙.png";
const fontPath = "gui_/font/SourceHanSansCN-Bold.otf";
const fontFamily = "P3553 Source Han Sans CN TrackInfoCard";

export async function loadTrackInfoCard<T>(options: TrackCardLoadOptions,
  dependencies: TrackCardLoadDependencies<T>): Promise<T | undefined> {
  const { library } = options;
  if (!await dependencies.configEnabled(library)) return undefined;
  const cardSource = library.get(dependencies.cardPath(options.trackDirectory));
  if (!cardSource) return undefined;
  const bgmSources = library.exactCanonicalCandidates(bgmPath);
  if (bgmSources.length === 0) return undefined;
  if (bgmSources.length !== 1) {
    throw new Error(`${bgmPath} source 数量必须为 1，实际 ${bgmSources.length}。`);
  }
  const bgmTitles = dependencies.parseXml(await bgmSources[0]!.text(), bgmPath);
  const stringSources = library.exactCanonicalCandidates(stringsPath);
  if (stringSources.length !== 1) {
    throw new Error(`${stringsPath} source 数量必须为 1，实际 ${stringSources.length}。`);
  }
  const gameLabels = dependencies.gameLabels(options.game,
    dependencies.parseXml(await stringSources[0]!.text(), stringsPath));
  const layoutNode = dependencies.parseNode(await dependencies.uniqueResource(
    library, layoutPath).bytes());
  const parsedLayout = dependencies.layout(layoutNode);
  const layout = { ...parsedLayout,
    stripIndex: dependencies.stripIndex(parsedLayout.stripIndex, options.game.team) };
  const reverse = /_rvs$/i.test(options.trackId);
  const [frame, label, track, reverseStamp, difficultyNode, difficultyText,
    difficultyGlyphs, fontBytes] = await Promise.all([
      dependencies.decodeImage(dependencies.uniqueResource(library, framePath)),
      dependencies.decodeImage(dependencies.uniqueResource(library, labelPath)),
      dependencies.decodeImage(cardSource),
      reverse
        ? dependencies.decodeImage(dependencies.uniqueResource(library, reversePath))
        : Promise.resolve(undefined),
      dependencies.uniqueResource(library, difficultyPath).bytes()
        .then(bytes => dependencies.parseNode(bytes)),
      dependencies.decodeImage(dependencies.uniqueResource(library, difficultyTextPath)),
      dependencies.decodeImage(dependencies.uniqueResource(library, difficultyGlyphPath)),
      dependencies.uniqueResource(library, fontPath).bytes(),
    ]);

  if (frame.width !== layout.width || frame.height !== layout.cardHeight) {
    throw new Error(`trackcard.png 应为 ${layout.width}x${layout.cardHeight}，实际 ${frame.width}x${frame.height}。`);
  }
  if (label.width !== layout.width ||
    label.height !== layout.stripHeight * layout.stripCount) {
    throw new Error(`trackInfoLabel.png 应为 ${layout.width}x${layout.stripHeight * layout.stripCount}，实际 ${label.width}x${label.height}。`);
  }
  if (reverseStamp && (reverseStamp.width !== track.width ||
    reverseStamp.height !== track.height)) {
    throw new Error("反向标记与赛道预览图尺寸不一致。");
  }
  const difficulty = { layout: dependencies.difficultyLayout(difficultyNode,
    layout.trackRect, difficultyText, difficultyGlyphs),
  text: difficultyText, glyphs: difficultyGlyphs };
  if (options.difficulty !== undefined &&
    (!Number.isInteger(options.difficulty) || options.difficulty < 0)) {
    throw new Error(`赛道难度无效：${options.difficulty}。`);
  }
  const font = await dependencies.registerFont(fontFamily, fontBytes);
  try {
    return dependencies.create(options.root,
      dependencies.title(options.trackTitle, options.trackId),
      options.difficulty, bgmTitles, gameLabels, {
        layout, frame, label, track, reverseStamp, difficulty, font,
      });
  } catch (error) {
    dependencies.releaseFont(font);
    throw error;
  }
}

export interface TrackCardConstructionHost {
  root: unknown;
  trackTitle: string;
  trackDifficulty?: number;
  bgmTitles: Map<string, string>;
  gameLabels: unknown;
  assets: { layout: { adjustX: number } };
  adjustX: number;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  resizeObserver: ResizeObserver;
  onWindowResize: () => void;
  render(): void;
}

export function initializeTrackInfoCard(host: TrackCardConstructionHost,
  root: HTMLElement, trackTitle: string, difficulty: number | undefined,
  bgmTitles: Map<string, string>, gameLabels: unknown,
  assets: TrackCardConstructionHost["assets"]): void {
  host.root = root;
  host.trackTitle = trackTitle;
  host.trackDifficulty = difficulty;
  host.bgmTitles = bgmTitles;
  host.gameLabels = gameLabels;
  host.assets = assets;
  host.adjustX = assets.layout.adjustX;
  const context = host.canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("浏览器无法创建 trackInfoCard Canvas。");
  host.context = context;
  Object.assign(host.canvas.style, {
    position: "absolute", inset: "0", width: "100%", height: "100%",
    pointerEvents: "none",
  });
  host.canvas.dataset.uiLayer = "hud";
  host.canvas.setAttribute("aria-hidden", "true");
  root.append(host.canvas);
  host.resizeObserver = new ResizeObserver(() => host.render());
  host.resizeObserver.observe(root);
  window.addEventListener("resize", host.onWindowResize);
  host.render();
}
