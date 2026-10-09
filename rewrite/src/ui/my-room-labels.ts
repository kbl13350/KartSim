import { C9, Ft, m9 } from "../generated/formats.js";
import { F9 } from "../generated/library.js";
import { wrapLobbyChatBubble } from "../multiplayer/lobby-room-helpers";
import { ImageCache, type MyRoomDataLibrary } from "../myroom/myroom-data";
import type { MyRoomHead } from "./my-room-scene";

/**
 * Name tags and talk balloons over the riders in My Room, on a transparent
 * canvas above the 3D scene. The balloon is the release monocoque talk
 * balloon (stage_myRoom mq_window@zz talkBalloon0..7: frame YellowTalkBalloon,
 * bold14 text, its tail at the bottom left); the name tag is the release
 * ready room's (stage_mqReady talkBalloon@zz nametag: bold16, 52 95 128 on a
 * white outline). A balloon stays up as long as the ready room's.
 */

export interface MyRoomLabel {
  name: string;
  /** The text of the balloon, when it is up. */
  balloon?: string;
}

/** stage_mqReady talk balloons last 5 s (multiplayer.js chatBubbleDurationMs). */
export const MY_ROOM_BALLOON_MS = 5000;

interface Frame { texture: string; caption: { height: number }; bottom: { height: number } }

type Rect = { x: number; y: number; width: number; height: number };

/** The balloon's box for a text: 140 wide, one 19-px row per wrapped line. */
export function balloonLayout(lines: number, scale: number): { width: number; height: number; text: Rect } {
  const width = 140 * scale;
  const top = 9 * scale;
  const bottom = 23 * scale;
  const height = top + bottom + (lines * 19 + 10) * scale;
  return { width, height, text: { x: 10 * scale, y: top + 5 * scale, width: 120 * scale, height: lines * 19 * scale } };
}

export class MyRoomRiderLabels {
  readonly canvas = document.createElement("canvas");
  private readonly context: CanvasRenderingContext2D;
  private readonly images: ImageCache;
  private balloonFrame?: Frame;
  private disposed = false;

  constructor(readonly host: HTMLElement, readonly library: MyRoomDataLibrary, readonly fontFamily: string) {
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("无法创建小屋名字画布");
    this.context = context;
    this.images = new ImageCache(library, () => undefined);
    this.canvas.setAttribute("aria-hidden", "true");
    Object.assign(this.canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%",
      pointerEvents: "none" });
    host.append(this.canvas);
    void (F9(library, "gui_/monocoque", "frame") as Promise<{ children: Array<{ name: string;
      children: unknown[] }> }>).then(tree => {
      const entry = tree.children.find(child => child.name === "YellowTalkBalloon");
      if (entry?.children[0]) this.balloonFrame = Ft(entry.children[0]) as Frame;
    }, error => console.warn("小屋聊天气泡边框加载失败", error));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.remove();
  }

  /** Draws each head's name tag and balloon (riders without a label are skipped). */
  draw(heads: readonly MyRoomHead[], label: (id: string) => MyRoomLabel | undefined): void {
    if (this.disposed) return;
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    const context = this.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, pixelWidth, pixelHeight);
    if (!width || !height) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    // Release sizes are for a 900-px-high stage.
    const scale = height / 900;
    // Farther riders (higher on the screen) first, so nearer labels stay on top.
    const shown = heads.flatMap(head => {
      const value = label(head.id);
      return value ? [{ head, value }] : [];
    }).sort((a, b) => a.head.y - b.head.y);
    for (const { head, value } of shown) {
      const tagSize = Math.max(11, 16 * scale);
      const tag = { x: head.x - 100 * scale, y: head.y - (8 + 22) * scale, width: 200 * scale, height: 22 * scale };
      m9(context, value.name, tag, { family: this.fontFamily, size: tagSize, kind: "label",
        color: "rgb(52, 95, 128)", align: "center", verticalAlign: "center", stroke: 2, strokeColor: "white" });
      if (value.balloon) this.drawBalloon(value.balloon, head.x, tag.y - 2 * scale, scale);
    }
  }

  private drawBalloon(text: string, x: number, bottom: number, scale: number): void {
    const lines = wrapLobbyChatBubble(text);
    const layout = balloonLayout(lines.length, scale);
    // The tail sits about 20 px in from the balloon's left edge.
    const rect = { x: x - 20 * scale, y: bottom - layout.height, width: layout.width, height: layout.height };
    const context = this.context;
    const frame = this.balloonFrame;
    const image = frame && this.images.get(`gui_/monocoque/${frame.texture}.png`);
    if (frame && image) {
      context.save();
      context.translate(rect.x, rect.y);
      context.scale(scale, scale);
      C9(context, frame, image, { x: 0, y: 0, width: rect.width / scale, height: rect.height / scale });
      context.restore();
    } else {
      context.fillStyle = "rgba(255, 246, 200, 0.95)";
      context.fillRect(rect.x, rect.y, rect.width, rect.height - 12 * scale);
    }
    const size = Math.max(10, 14 * scale);
    lines.forEach((line, index) => m9(context, line, {
      x: rect.x + layout.text.x, y: rect.y + layout.text.y + index * 19 * scale,
      width: layout.text.width, height: 19 * scale,
    }, { family: this.fontFamily, size, kind: "label", color: "black", align: "left", verticalAlign: "top",
      stroke: 0, strokeColor: "black" }));
  }
}
