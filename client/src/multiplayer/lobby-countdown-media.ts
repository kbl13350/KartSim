/** Lobby countdown scene digits, alpha tracks, tick sound and canvas painting. */

interface ResourceEntry { bytes(): Promise<Uint8Array> }
interface ResourceLibrary { get(path: string): ResourceEntry | undefined }

export interface CountdownSceneNode {
  kind?: string;
  name?: string;
  children?: CountdownSceneNode[];
  slots?: CountdownSceneNode[];
  alphaController?: unknown;
}

interface CanvasImage { width: number; height: number }
interface DecodedImage { width: number; height: number; pixels: Uint8Array }
interface AlphaTrack { update(frame: number): number; reset(frame: number): void }
interface AudioLike {
  currentTime: number;
  play(): Promise<unknown>;
  pause(): void;
}

interface PaintContext {
  globalAlpha: number;
  save(): void;
  drawImage(image: CanvasImage, x: number, y: number,
    width: number, height: number): void;
  restore(): void;
}

export interface LobbyCountdownDependencies {
  parseScene(bytes: Uint8Array): { root: CountdownSceneNode };
  decodeImage(bytes: Uint8Array): Promise<DecodedImage>;
  createCanvas(image: DecodedImage): CanvasImage;
  alphaFromParsed(controller: unknown): AlphaTrack;
  createSoundUrl(bytes: Uint8Array): string;
  createAudio(url: string): AudioLike;
  revokeSoundUrl(url: string): void;
}

function digitAlphaControllers(root: CountdownSceneNode): Map<number, unknown> {
  const controllers = new Map<number, unknown>();
  const visit = (node: CountdownSceneNode | null | undefined): void => {
    if (!node || typeof node !== "object") return;
    if (node.kind === "node" && /^[1-9]$/.test(node.name ?? "")) {
      const geometry = node.children?.find(child =>
        typeof child === "object" && child !== null &&
        child.name === `${node.name}_Geom`);
      const texture = geometry?.slots?.find(slot =>
        typeof slot === "object" && slot !== null && slot.kind === "texture");
      if (texture?.alphaController) {
        controllers.set(Number(node.name), texture.alphaController);
      }
    }
    node.children?.forEach(visit);
  };
  visit(root);
  return controllers;
}

export class LobbyCountdownMedia {
  readonly sound: AudioLike;

  constructor(readonly digits: Array<{ image: CanvasImage; alpha: AlphaTrack }>,
    readonly soundUrl: string,
    readonly dependencies: LobbyCountdownDependencies) {
    this.sound = dependencies.createAudio(soundUrl);
    this.reset();
  }

  static async load<T extends LobbyCountdownMedia>(
    this: new (digits: Array<{ image: CanvasImage; alpha: AlphaTrack }>,
      soundUrl: string, dependencies: LobbyCountdownDependencies) => T,
    library: ResourceLibrary, dependencies: LobbyCountdownDependencies): Promise<T> {
    const sceneEntry = library.get("stage_/mqReady/대기실카운트.1s");
    if (!sceneEntry) throw new Error("房间倒数场景缺失");
    const scene = dependencies.parseScene(await sceneEntry.bytes());
    const controllers = digitAlphaControllers(scene.root);
    if (controllers.size !== 9) throw new Error("房间倒数数字动画不完整");

    const digits = await Promise.all(Array.from({ length: 9 }, async (_, index) => {
      const digit = index + 1;
      const imageEntry = library.get(`stage_/mqReady/${digit}.png`);
      if (!imageEntry) throw new Error(`房间倒数数字 ${digit} 贴图缺失`);
      const decoded = await dependencies.decodeImage(await imageEntry.bytes());
      return { image: dependencies.createCanvas(decoded),
        alpha: dependencies.alphaFromParsed(controllers.get(digit)) };
    }));
    const soundEntry = library.get("sound_/fx/interface/waitingroom_countdown.ogg");
    if (!soundEntry) throw new Error("房间倒数音效缺失");
    const soundUrl = dependencies.createSoundUrl(await soundEntry.bytes());
    return new this(digits, soundUrl, dependencies);
  }

  paint(context: PaintContext, rect: { x: number; y: number;
    width: number; height: number }, elapsed: number): void {
    const frame = 1 + Math.max(0, Math.min(10000, Math.trunc(elapsed)));
    context.save();
    for (const { image, alpha } of this.digits) {
      const opacity = alpha.update(frame);
      if (opacity <= 0) continue;
      context.globalAlpha = Math.min(1, opacity);
      context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    }
    context.restore();
  }

  reset(): void {
    this.digits.forEach(digit => digit.alpha.reset(1));
  }

  playTick(): void {
    this.sound.currentTime = 0;
    this.sound.play().catch(() => {});
  }

  dispose(): void {
    this.sound.pause();
    this.dependencies.revokeSoundUrl(this.soundUrl);
  }
}
