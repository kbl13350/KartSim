/** RP draw result window, from asset selection to timed reveal and cleanup. */

interface SceneNode {
  name: string;
  children: SceneNode[];
}

interface KartItem { itemId: number; title: string }
interface EquipmentItem { itemId: number; kind: string; title: string }

interface RpRace {
  rp?: { draws: Record<string, { kartId: number; flyingPetId: number }> };
  roster: Array<{ playerId: string }>;
}

interface RpLibrary {
  timeAttackGarageCatalog(): Promise<{ karts: KartItem[];
    equipment: EquipmentItem[] }>;
}

interface RpScene {
  play(panel: SceneNode, nowMs: number): void;
  paintKart(canvas: unknown, rect: unknown, nowMs: number): void;
  paint(panel: SceneNode, canvas: unknown, rect: unknown, nowMs: number): void;
  dispose(): void;
}

interface RpSound {
  prepare(): Promise<void>;
  play(kind: "opening" | "lucky" | "unlucky"): void;
  stop(): void;
  dispose(): void;
}

interface RpView {
  element: { dataset: Record<string, string> };
  show(): void;
  hide(): void;
  render(): void;
  dispose(): void;
}

export interface RpResultNoticeDependencies {
  validDraws(draws: RpRace["rp"], playerIds: string[]): boolean;
  loadDefinition(library: RpLibrary, directory: string,
    name: string): Promise<SceneNode>;
  decorateDefinition(root: SceneNode, kartTitle: string,
    petTitle: string): SceneNode;
  nodeName(node: SceneNode): string | undefined;
  loadScene(library: RpLibrary, definition: SceneNode,
    kart: KartItem): Promise<RpScene>;
  loadSound(library: RpLibrary, audioContext: unknown): Promise<RpSound>;
  loadView(options: Record<string, unknown>): Promise<RpView>;
  nowMs(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(id: number): void;
}

export class RpResultNotice {
  view?: RpView;
  scene?: RpScene;
  sound?: RpSound;
  phase: "opening" | "result" = "opening";
  now = 0;
  animation?: number;
  since = 0;
  complete?: (error?: unknown) => void;
  cancel?: () => void;
  disposed = false;
  started = false;

  constructor(readonly lucky: boolean, readonly box: SceneNode,
    readonly sparkle: SceneNode,
    readonly dependencies: RpResultNoticeDependencies) {}

  static async load<T extends RpResultNotice>(
    this: new (lucky: boolean, box: SceneNode, sparkle: SceneNode,
      dependencies: RpResultNoticeDependencies) => T,
    library: RpLibrary, root: unknown, race: RpRace, playerId: string,
    audioContext: unknown, dependencies: RpResultNoticeDependencies): Promise<T> {
    if (!dependencies.validDraws(race.rp,
      race.roster.map(member => member.playerId)) ||
      !Object.hasOwn(race.rp!.draws, playerId)) {
      throw new Error("RP 结果窗口缺少本局抽取身份。");
    }
    const draw = { ...race.rp!.draws[playerId]! };
    const [originalDefinition, catalog] = await Promise.all([
      dependencies.loadDefinition(library, "dialog/bokbulbok", "bokbulbok"),
      library.timeAttackGarageCatalog(),
    ]);
    const kart = catalog.karts.find(item => item.itemId === draw.kartId);
    const pet = draw.flyingPetId
      ? catalog.equipment.find(item => item.kind === "flyingPet" &&
        item.itemId === draw.flyingPetId)
      : undefined;
    if (!kart || (draw.flyingPetId && !pet)) {
      throw new Error("RP 抽取物品缺少精确资源身份。");
    }
    const definition = dependencies.decorateDefinition(originalDefinition,
      kart.title, pet?.title ?? "无");
    const resultPanel = definition.children[1]!;
    const box = definition.children[0]!.children[0]!;
    const sparkle = resultPanel.children.find(node =>
      dependencies.nodeName(node) === "당첨")!.children[0]!;
    const notice = new this(draw.flyingPetId !== 0, box, sparkle, dependencies);
    try {
      notice.scene = await dependencies.loadScene(library, definition, kart);
      notice.sound = await dependencies.loadSound(library, audioContext);
      await notice.sound.prepare();
      notice.view = await dependencies.loadView({
        library, root, definition, roots: ["dialog/bokbulbok"],
        label: `本局 RP 赛车：${kart.title}，飞宠：${pet?.title ?? "无"}`,
        state: (node: SceneNode) => notice.state(node), modal: true,
      });
      notice.view.element.dataset.uiLayer = "notice";
      return notice;
    } catch (error) {
      notice.dispose();
      throw error;
    }
  }

  state(node: SceneNode): Record<string, unknown> {
    const name = this.dependencies.nodeName(node);
    if (name === "boxOpen") return { visible: this.phase === "opening" };
    if (name === "noticeDlg") return { visible: this.phase === "result" };
    if (name === "당첨") return { visible: this.lucky };
    if (name === "꽝") return { visible: !this.lucky };
    if (name === "main") return {
      paint: (canvas: unknown, rect: unknown) =>
        this.scene!.paintKart(canvas, rect, this.now),
    };
    if (node === this.box || node === this.sparkle) return {
      paint: (canvas: unknown, rect: unknown) =>
        this.scene!.paint(node, canvas, rect, this.now),
    };
    return {};
  }

  present(signal: AbortSignal): Promise<void> {
    if (this.disposed || signal.aborted) {
      return Promise.reject(new Error("本局 RP 结果展示已取消。"));
    }
    if (this.started) throw new Error("本局 RP 结果不能重复展示。");
    this.started = true;
    this.now = this.since = this.dependencies.nowMs() >>> 0;
    return new Promise<void>((resolve, reject) => {
      const onAbort = () => this.finish(new Error("本局 RP 结果展示已取消。"));
      this.cancel = () => signal.removeEventListener("abort", onAbort);
      this.complete = error => error ? reject(error) : resolve();
      signal.addEventListener("abort", onAbort, { once: true });
      try {
        this.scene!.play(this.box, this.now);
        this.sound!.play("opening");
        this.view!.show();
        this.animation = this.dependencies.requestFrame(() =>
          this.update(this.dependencies.nowMs()));
      } catch (error) {
        this.finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  update(nowMs: number): void {
    if (!this.complete || this.disposed) return;
    try {
      this.now = nowMs >>> 0;
      const elapsed = (this.now - this.since) >>> 0;
      if (this.phase === "opening" && elapsed > 2500) {
        this.phase = "result";
        this.since = this.now;
        this.sound!.play(this.lucky ? "lucky" : "unlucky");
        if (this.lucky) this.scene!.play(this.sparkle, this.now);
      } else if (this.phase === "result" && elapsed > 3500) {
        this.finish();
        return;
      }
      this.view!.render();
      this.animation = this.dependencies.requestFrame(() =>
        this.update(this.dependencies.nowMs()));
    } catch (error) {
      this.finish(error instanceof Error ? error : new Error(String(error)));
    }
  }

  finish(error?: unknown): void {
    if (this.animation !== undefined) this.dependencies.cancelFrame(this.animation);
    this.animation = undefined;
    this.cancel?.();
    this.cancel = undefined;
    this.sound?.stop();
    this.view?.hide();
    const complete = this.complete;
    this.complete = undefined;
    complete?.(error);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.finish(new Error("本局 RP 结果展示已释放。"));
    this.view?.dispose();
    this.scene?.dispose();
    this.sound?.dispose();
  }
}
