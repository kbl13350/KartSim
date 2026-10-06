/** Race track information card visibility, slide timing, drawing, and cleanup. */

interface Rect { x: number; y: number; width: number; height: number }
interface LabelLayout { rect: Rect; color: string; align: string;
  verticalAlign: string }
interface ImageResource { image: unknown; width: number; height: number }
interface Layout {
  adjustX: number;
  adjustY: number;
  width: number;
  height: number;
  stripIndex: number;
  stripHeight: number;
  cardTop: number;
  cardHeight: number;
  trackRect: Rect;
  gameSpeed: LabelLayout;
  gameInfo: LabelLayout;
  teamName: LabelLayout;
  bgmRect: Rect;
  bgmColor: string;
  trackNameRect: Rect;
  trackNameColor: string;
}

interface CardCanvas {
  hidden: boolean;
  remove(): void;
}

interface CardContext {
  font: string;
  textBaseline: string;
  textAlign: string;
  fillStyle: string;
  clearRect(x: number, y: number, width: number, height: number): void;
  drawImage(image: unknown, ...coordinates: number[]): void;
  save(): void;
  beginPath(): void;
  rect(x: number, y: number, width: number, height: number): void;
  clip(): void;
  fillText(text: string, x: number, y: number): void;
  restore(): void;
}

export interface TrackInfoCardHost {
  root: { clientWidth: number; clientHeight: number };
  trackTitle: string;
  trackDifficulty?: number;
  bgmTitles: Map<string, string>;
  gameLabels: { gameSpeed: string; gameInfo: string; teamName: string };
  assets: {
    layout: Layout;
    frame: ImageResource;
    label: ImageResource;
    track: ImageResource;
    reverseStamp?: ImageResource;
    difficulty: unknown;
    font: unknown;
  };
  canvas: CardCanvas;
  context: CardContext;
  resizeObserver: { disconnect(): void };
  onWindowResize: unknown;
  bgmName: string;
  visible: boolean;
  slidingOut: boolean;
  adjustX: number;
  lastUpdateMs?: number;
  disposed: boolean;
  render(): void;
  setVisible(visible: boolean): void;
  drawLabel(text: string, layout: LabelLayout, x: number, y: number): void;
  drawClippedText(text: string, rect: Rect, x: number, y: number,
    color: string): void;
}

export interface TrackInfoCardDependencies {
  configureCanvas(canvas: CardCanvas, context: CardContext, width: number,
    height: number, pixelRatio: number, designWidth: number,
    designHeight: number): void;
  pixelRatio(): number;
  drawTrack(context: CardContext, image: ImageResource, rect: Rect,
    x: number, y: number): void;
  drawReverse(context: CardContext, image: ImageResource, x: number,
    y: number, width: number, height: number): void;
  drawDifficulty(context: CardContext, difficulty: number | undefined,
    assets: unknown, x: number, y: number): void;
  drawLabel(context: CardContext, text: string, rect: Rect,
    options: Record<string, unknown>): void;
  releaseFont(font: unknown): void;
  removeResizeListener(listener: unknown): void;
}

const designWidth = 1600;
const designHeight = 900;
const fontFamily = "P3553 Source Han Sans CN TrackInfoCard";

export function setTrackCardBgm(host: TrackInfoCardHost, trackId: string): void {
  if (host.disposed) return;
  const title = host.bgmTitles.get(trackId) ?? "";
  if (host.bgmName !== title) {
    host.bgmName = title;
    host.render();
  }
}

export function setTrackCardVisible(host: TrackInfoCardHost, visible: boolean): void {
  if (host.disposed || host.visible === visible) return;
  host.visible = visible;
  host.slidingOut = false;
  if (visible) host.adjustX = host.assets.layout.adjustX;
  host.canvas.hidden = !visible;
  if (visible) host.render();
}

export function slideTrackCardOut(host: TrackInfoCardHost): void {
  if (!host.disposed && host.visible) host.slidingOut = true;
}

/** Preserve the released unsigned clock delta and float32 slide increments. */
export function updateTrackCard(host: TrackInfoCardHost, nowMs: number): void {
  if (host.disposed) return;
  const previous = host.lastUpdateMs;
  host.lastUpdateMs = nowMs;
  if (!host.visible || !host.slidingOut || previous === undefined) return;
  const elapsed = (Math.trunc(nowMs) - Math.trunc(previous)) >>> 0;
  const step = Math.fround(Math.min(4, elapsed));
  const adjustX = Math.fround(Math.fround(host.adjustX) -
    Math.fround(Math.fround(3) * step));
  host.adjustX = adjustX;
  if (-host.assets.layout.width > adjustX) host.setVisible(false);
  else host.render();
}

export function disposeTrackCard(host: TrackInfoCardHost,
  dependencies: TrackInfoCardDependencies): void {
  if (host.disposed) return;
  host.disposed = true;
  host.resizeObserver.disconnect();
  dependencies.removeResizeListener(host.onWindowResize);
  host.canvas.remove();
  dependencies.releaseFont(host.assets.font);
}

export function renderTrackCard(host: TrackInfoCardHost,
  dependencies: TrackInfoCardDependencies): void {
  if (host.disposed || !host.visible) return;
  const width = host.root.clientWidth;
  const height = host.root.clientHeight;
  if (width <= 0 || height <= 0) return;
  dependencies.configureCanvas(host.canvas, host.context, width, height,
    dependencies.pixelRatio(), designWidth, designHeight);
  const { layout, frame, label, track, reverseStamp, difficulty } = host.assets;
  const context = host.context;
  context.clearRect(0, 0, designWidth, designHeight);
  const x = designWidth - host.adjustX - layout.width;
  const y = designHeight - layout.adjustY - layout.height;
  context.drawImage(label.image, 0, layout.stripIndex * layout.stripHeight,
    layout.width, layout.stripHeight, x, y, layout.width, layout.stripHeight);
  const cardY = y + layout.cardTop;
  context.drawImage(frame.image, x, cardY);
  dependencies.drawTrack(context, track, layout.trackRect,
    x + layout.trackRect.x, cardY + layout.trackRect.y);
  if (reverseStamp) dependencies.drawReverse(context, reverseStamp, x,
    cardY, layout.width, layout.cardHeight);
  dependencies.drawDifficulty(context, host.trackDifficulty, difficulty,
    x + layout.trackRect.x, cardY + layout.trackRect.y);
  host.drawLabel(host.gameLabels.gameSpeed, layout.gameSpeed, x, y);
  host.drawLabel(host.gameLabels.gameInfo, layout.gameInfo, x, y);
  host.drawLabel(host.gameLabels.teamName, layout.teamName, x, y);
  context.font = `16px "${fontFamily}"`;
  context.textBaseline = "middle";
  context.textAlign = "left";
  host.drawClippedText(host.bgmName, layout.bgmRect, x, y, layout.bgmColor);
  host.drawClippedText(host.trackTitle, layout.trackNameRect,
    x, cardY, layout.trackNameColor);
}

export function drawTrackCardLabel(host: TrackInfoCardHost, text: string,
  layout: LabelLayout, x: number, y: number,
  dependencies: TrackInfoCardDependencies): void {
  if (!text) return;
  dependencies.drawLabel(host.context, text, {
    x: x + layout.rect.x,
    y: y + layout.rect.y,
    width: layout.rect.width,
    height: layout.rect.height,
  }, {
    kind: "label", family: fontFamily, size: 16, color: layout.color,
    align: layout.align, verticalAlign: layout.verticalAlign,
  });
}

export function drawTrackCardClippedText(host: TrackInfoCardHost,
  text: string, rect: Rect, x: number, y: number,
  color: string): void {
  if (!text) return;
  const context = host.context;
  context.save();
  context.beginPath();
  context.rect(x + rect.x, y + rect.y, rect.width, rect.height);
  context.clip();
  context.fillStyle = color;
  context.fillText(text, x + rect.x, y + rect.y + rect.height / 2);
  context.restore();
}
