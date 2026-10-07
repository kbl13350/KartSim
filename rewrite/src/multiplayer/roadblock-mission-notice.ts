/** The roadblock mode's opening mission banner and its timed two-frame animation. */

export interface RoadblockNoticeNode {
  name: string;
  children: RoadblockNoticeNode[];
  [key: string]: unknown;
}

interface RoadblockNoticeView {
  element: { dataset: Record<string, string>; style: { pointerEvents: string } };
  show(): void;
  render(): void;
  hide(): void;
  dispose(): void;
}

interface RoadblockRace {
  roadblock?: { runnerId: string };
  roster: Array<{ playerId: string }>;
}

export interface RoadblockMissionDependencies {
  loadDefinition(library: unknown, folder: string, name: string):
    Promise<RoadblockNoticeNode>;
  attribute(node: RoadblockNoticeNode, name: string): string | undefined;
  clone(node: RoadblockNoticeNode, attributes: Record<string, string>,
    children?: RoadblockNoticeNode[]): RoadblockNoticeNode;
  loadView(options: Record<string, unknown>): Promise<RoadblockNoticeView>;
  nowMs(): number;
  requestFrame(callback: (timestamp: number) => void): number;
  cancelFrame(id: number): void;
}

function findNamedNode(node: RoadblockNoticeNode, name: string,
  attribute: RoadblockMissionDependencies["attribute"]):
    RoadblockNoticeNode | undefined {
  if (attribute(node, "name") === name) return node;
  for (const child of node.children) {
    const found = findNamedNode(child, name, attribute);
    if (found) return found;
  }
  return undefined;
}

export class RoadblockMissionNotice {
  view!: RoadblockNoticeView;
  frame = 0;
  since = 0;
  lastFrame = 0;
  animation?: number;
  cancel?: () => void;
  complete?: (error?: unknown) => void;
  disposed = false;
  started = false;

  constructor(readonly dependencies: RoadblockMissionDependencies) {}

  static async load<T extends RoadblockMissionNotice>(
    this: new (dependencies: RoadblockMissionDependencies) => T,
    library: unknown, root: unknown, race: RoadblockRace, playerId: string,
    dependencies: RoadblockMissionDependencies): Promise<T> {
    if (!race.roadblock || !race.roster.some(member =>
      member.playerId === playerId)) {
      throw new Error("挡人任务横幅缺少本局身份。");
    }

    const definition = await dependencies.loadDefinition(library,
      "stage_/mqReady", "stage_window@zz");
    const scene = findNamedNode(definition, "roadBlockFinalScene",
      dependencies.attribute);
    const mission = scene && findNamedNode(scene, "roadBlockMisson",
      dependencies.attribute);
    if (!scene || !mission) {
      throw new Error("挡人开赛缺少原版任务横幅。");
    }
    const size = dependencies.attribute(mission, "windowSize");
    if (!size) throw new Error("挡人开赛缺少原版任务横幅尺寸。");

    const notice = new this(dependencies);
    const role = race.roadblock.runnerId === playerId ? "runner" : "blocker";
    const frames = [0, 1].map(index => dependencies.clone(mission, {
      name: `roadBlockMission${index}`,
      texture: `roadblock_${role}Mission_${index}@cn`,
      visible: "true",
    }));
    const viewDefinition = {
      name: "Container", text: "",
      attributes: [{ name: "windowRect", value: "fullscreen" }],
      children: [dependencies.clone(scene, {
        windowRect: `0 0 ${size}`, visible: "true",
      }, frames)],
    };
    notice.view = await dependencies.loadView({
      library, root, definition: viewDefinition,
      roots: ["stage_/mqReady", "stage_/common"],
      label: role === "runner" ? "红方任务" : "蓝方任务",
      preserveDisplayPixels: true, smoothImages: true,
      state: (node: RoadblockNoticeNode) => frames.includes(node)
        ? { visible: frames.indexOf(node) === notice.frame } : {},
    });
    notice.view.element.dataset.uiLayer = "notice";
    notice.view.element.style.pointerEvents = "none";
    return notice;
  }

  present(signal: AbortSignal): Promise<void> {
    if (this.disposed || signal.aborted) {
      return Promise.reject(new Error("本局任务横幅已取消。"));
    }
    if (this.started) throw new Error("本局任务横幅不能重复开始。");
    this.started = true;
    this.frame = 0;
    this.since = this.lastFrame = this.dependencies.nowMs();
    return new Promise<void>((resolve, reject) => {
      const onAbort = () => this.finish(new Error("本局任务横幅已取消。"));
      this.cancel = () => signal.removeEventListener("abort", onAbort);
      this.complete = error => error ? reject(error) : resolve();
      signal.addEventListener("abort", onAbort, { once: true });
      try {
        this.view.show();
        this.animation = this.dependencies.requestFrame(timestamp =>
          this.update(timestamp));
      } catch (error) {
        this.finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  update(timestamp: number): void {
    if (!this.complete || this.disposed) return;
    try {
      if (timestamp - this.lastFrame > 500) {
        this.frame = 1 - this.frame;
        this.lastFrame = timestamp;
        this.view.render();
      }
      if (timestamp - this.since > 4000) {
        this.finish();
        return;
      }
      this.animation = this.dependencies.requestFrame(next => this.update(next));
    } catch (error) {
      this.finish(error instanceof Error ? error : new Error(String(error)));
    }
  }

  finish(error?: unknown): void {
    if (this.animation !== undefined) this.dependencies.cancelFrame(this.animation);
    this.animation = undefined;
    this.cancel?.();
    this.cancel = undefined;
    this.view.hide();
    const complete = this.complete;
    this.complete = undefined;
    complete?.(error);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.finish(new Error("本局任务横幅已释放。"));
    this.view.dispose();
  }
}
