/** Brief lobby notice shown when the room host changes the selected track. */

export interface TrackChangeNode {
  name: string;
  children: TrackChangeNode[];
  [key: string]: unknown;
}

interface StringBagNode { children: StringBagNode[]; [key: string]: unknown }
interface TrackChangeRoom {
  hostId: string;
  phase: string;
  roomId: string;
  trackId: string;
  randomTrackCode: string;
}

interface LabelLayout { lines: string[]; lineHeight: number }
interface TrackChangeView {
  element: {
    dataset: Record<string, string>;
    style: { pointerEvents: string };
    setAttribute(name: string, value: string): void;
  };
  wrapLabel(text: string, maxWidth: number, fontSize: number): LabelLayout;
  paintLabelLines(canvas: unknown, lines: string[], rect: unknown,
    fontSize: number, color: string, lineHeight: number): void;
  show(): void;
  hide(): void;
  dispose(): void;
}

export interface TrackChangeNoticeDependencies {
  loadDefinition(library: unknown, folder: string, name: string):
    Promise<TrackChangeNode>;
  loadStringBag(library: unknown): Promise<Uint8Array>;
  parseStringBag(bytes: Uint8Array): { root: { children: StringBagNode[] } };
  nodeAttribute(node: TrackChangeNode, name: string): string;
  stringAttribute(node: StringBagNode, name: string): string | undefined;
  clone(node: TrackChangeNode, attributes: Record<string, string>): TrackChangeNode;
  loadView(options: Record<string, unknown>): Promise<TrackChangeView>;
  nowMs(): number;
}

export class TrackChangeNotice {
  until = 0;
  view!: TrackChangeView;
  layouts = new Map<boolean, LabelLayout>();
  activeLayout: LabelLayout = { lines: [], lineHeight: 0 };

  constructor(public room: TrackChangeRoom,
    readonly playerId: string, readonly caption: TrackChangeNode,
    readonly definition: TrackChangeNode, readonly width: number,
    readonly height: number, readonly messageHeight: number,
    readonly dependencies: TrackChangeNoticeDependencies) {}

  static async load<T extends TrackChangeNotice>(
    this: new (room: TrackChangeRoom, playerId: string,
      caption: TrackChangeNode, definition: TrackChangeNode,
      width: number, height: number, messageHeight: number,
      dependencies: TrackChangeNoticeDependencies) => T,
    library: unknown, root: unknown, room: TrackChangeRoom, playerId: string,
    dependencies: TrackChangeNoticeDependencies): Promise<T> {
    const [caption, stringBytes] = await Promise.all([
      dependencies.loadDefinition(library, "gui_/windowTemplate",
        "blinkMessageWindow"),
      dependencies.loadStringBag(library),
    ]);
    const message = caption.children.find(child =>
      dependencies.nodeAttribute(child, "name") === "message");
    if (!message) throw new Error("换图提示缺少原版 message 标签");

    const [width, height] = dependencies.nodeAttribute(caption, "clientSize")
      .split(/\s+/).map(Number);
    const [, , maxTextWidth, messageHeight] = dependencies
      .nodeAttribute(message, "leftTopWH").split(/\s+/).map(Number);
    const fontSize = Number(/\d+/.exec(dependencies
      .nodeAttribute(message, "textRender"))![0]);
    const stringKeys = new Map<boolean, string>([
      [true, "trackChangeWaitForMaster"],
      [false, "trackChangeWait"],
    ]);
    const strings = dependencies.parseStringBag(stringBytes).root.children;
    const definition: TrackChangeNode = {
      name: "Container", text: "",
      attributes: [{ name: "windowRect", value: "fullscreen" }],
      children: [caption],
    };
    const notice = new this(room, playerId, caption, definition,
      width!, height!, messageHeight!, dependencies);
    notice.view = await dependencies.loadView({
      library, root, definition,
      roots: ["gui_/windowTemplate", "stage_/common"],
      label: "赛道变更提示",
      preserveDisplayPixels: true, smoothImages: true,
      state: (node: TrackChangeNode) => node === message ? {
        text: "",
        paint: (canvas: unknown, rect: unknown) => notice.view.paintLabelLines(
          canvas, notice.activeLayout.lines, rect, fontSize,
          "rgb(42,55,80)", notice.activeLayout.lineHeight),
      } : {},
    });
    try {
      for (const [isHost, key] of stringKeys) {
        const entry = strings.find(node =>
          dependencies.stringAttribute(node, "n") === key)
          ?.children.find(node => dependencies.stringAttribute(node, "c") === "cn");
        const text = entry && dependencies.stringAttribute(entry, "v");
        if (!text) throw new Error(`换图提示原版文字缺失：${key}`);
        notice.layouts.set(isHost,
          notice.view.wrapLabel(text, maxTextWidth!, fontSize));
      }
      notice.view.element.dataset.uiLayer = "notice";
      notice.view.element.style.pointerEvents = "none";
      notice.view.element.setAttribute("role", "status");
      notice.view.element.setAttribute("aria-live", "polite");
      return notice;
    } catch (error) {
      notice.view.dispose();
      throw error;
    }
  }

  show(): void {
    this.activeLayout = this.layouts.get(this.room.hostId === this.playerId)!;
    this.definition.children = [this.dependencies.clone(this.caption, {
      clientSize: `${this.width} ${this.height + Math.max(0,
        this.activeLayout.lines.length * this.activeLayout.lineHeight -
        this.messageHeight)}`,
    })];
    this.view.element.setAttribute("aria-label", this.activeLayout.lines.join(""));
    this.view.show();
  }

  update(room: TrackChangeRoom, active: boolean): void {
    const previous = this.room;
    this.room = room;
    if (!active || room.phase !== "open" || room.roomId !== previous.roomId) {
      this.hide();
      return;
    }
    if (previous.trackId !== room.trackId ||
      previous.randomTrackCode !== room.randomTrackCode) {
      this.until = this.dependencies.nowMs() + 3000;
      this.show();
    }
  }

  tick(): void {
    if (this.until && this.dependencies.nowMs() >= this.until) this.hide();
  }

  hide(): void {
    this.until = 0;
    this.view.hide();
  }

  dispose(): void {
    this.until = 0;
    this.view.dispose();
  }
}
