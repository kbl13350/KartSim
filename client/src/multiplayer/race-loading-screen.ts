/** The loading board shown while a multiplayer race is being prepared. */

export interface RaceLoadingImage {
  width: number;
  height: number;
  pixels: ArrayLike<number>;
}

export interface RaceLoadingAssets {
  imageBytes(library: unknown, roots: string[], name: string): Promise<Uint8Array>;
  decodeImage(bytes: Uint8Array): Promise<RaceLoadingImage>;
}

export class RaceLoadingScreen {
  readonly element = document.createElement("section");
  readonly progress = document.createElement("div");
  readonly board = document.createElement("canvas");
  readonly context: CanvasRenderingContext2D;
  readonly observer: ResizeObserver;
  disposed = false;

  constructor(readonly root: HTMLElement, readonly background: HTMLCanvasElement) {
    this.element.className = "multiplayer-loading";
    this.element.dataset.uiLayer = "system";
    this.element.setAttribute("aria-label", "比赛加载中");
    this.element.hidden = true;

    this.progress.className = "multiplayer-loading-progress";
    this.progress.setAttribute("aria-live", "polite");
    Object.assign(this.progress.style, {
      width: "1px",
      height: "1px",
      overflow: "hidden",
      clipPath: "inset(50%)",
    });

    this.board.className = "multiplayer-loading-board";
    this.board.width = background.width;
    this.board.height = background.height;
    const context = this.board.getContext("2d");
    if (!context) throw new Error("无法创建多人加载画面。");
    this.context = context;

    this.observer = new ResizeObserver(() => this.paint());
    this.observer.observe(root);
    this.element.append(this.board, this.progress);
    root.append(this.element);
  }

  static async load<T extends RaceLoadingScreen>(
    this: new (root: HTMLElement, background: HTMLCanvasElement) => T,
    library: unknown, root: HTMLElement, assets: RaceLoadingAssets,
  ): Promise<T> {
    const image = await assets.decodeImage(await assets.imageBytes(
      library, ["zeta_/cn/loading"], "백기사_신_로딩페이지_1600",
    ));
    const background = document.createElement("canvas");
    background.className = "multiplayer-loading-board";
    background.width = image.width;
    background.height = image.height;
    background.getContext("2d")!.putImageData(new ImageData(
      new Uint8ClampedArray(image.pixels), image.width, image.height,
    ), 0, 0);
    return new this(root, background);
  }

  show(loaded: number, total: number): void {
    if (this.disposed) return;
    this.progress.textContent = `游戏即将开始，稍等一下哦~。  ${loaded}/${total}`;
    this.paint();
    this.element.hidden = false;
  }

  paint(): void {
    const message = this.progress.textContent;
    if (this.disposed || !message) return;
    const context = this.context;
    const width = this.board.width;
    const height = this.board.height;
    context.clearRect(0, 0, width, height);
    context.drawImage(this.background, 0, 0);

    const bounds = this.root.getBoundingClientRect();
    const scale = height / Math.max(1, bounds.height);
    context.font = `bold ${Math.max(12, Math.min(22, window.innerWidth * 0.013)) * scale}px "Microsoft YaHei",sans-serif`;
    context.textAlign = "right";
    context.textBaseline = "bottom";
    context.strokeStyle = "#000";
    context.lineWidth = 2 * scale;
    context.lineJoin = "round";
    context.fillStyle = "#ffe500";
    context.strokeText(message, width * 0.98, height * 0.98);
    context.fillText(message, width * 0.98, height * 0.98);
  }

  hide(): void {
    this.element.hidden = true;
  }

  dispose(): void {
    this.disposed = true;
    this.observer.disconnect();
    this.element.remove();
  }
}
