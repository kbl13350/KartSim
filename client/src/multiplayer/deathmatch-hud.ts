import { tr } from "../i18n/locale";
import { decodePngRgba } from "../resources/png-decoder";
import { DEATHMATCH_RULES, type DeathmatchState } from "./deathmatch-rules";

export interface DeathmatchHudFrame {
  scores: DeathmatchState["scores"];
  remainingMs: number;
  respawnRemainingMs: number;
  protectedRemainingMs: number;
  kills: number;
  deaths: number;
  team: 1 | 2;
  finished: boolean;
  outcome?: DeathmatchState["outcome"];
}

interface Library { canonicalCandidates(path: string): Array<{ bytes(): Promise<Uint8Array> }> }
interface Texture { image: HTMLCanvasElement; width: number; height: number }
const ROOT = "stage_/mqDeathMatchTeamGame";
const COLORS = { 1: "#ff665f", 2: "#58baff" };
const FONT = "'KartSim Main Menu', 'PingFang SC', 'Microsoft YaHei', sans-serif";

/** The server's remaining time, rounded up so a live final second never reads 00:00. */
export function deathmatchTimeText(remainingMs: number): string {
  const seconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** A dedicated team scoreboard; lap rankings and finish times do not decide Deathmatch. */
export class DeathmatchHud {
  readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly textures = new Map<string, Texture>();
  private lastFrame?: DeathmatchHudFrame;
  private disposed = false;

  constructor(root: HTMLElement, library: Library, _playerId: string) {
    this.canvas = root.ownerDocument.createElement("canvas");
    this.canvas.dataset.deathmatchHud = "true";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5";
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("死斗模式缺少 Canvas 2D 支持。");
    this.context = context;
    this.canvas.hidden = true;
    root.append(this.canvas);
    // Original blue/red digit strips and respawn boards are a visual enhancement.
    // The score and life state remain readable while these lazy resources load.
    for (const name of ["블루숫자_01", "레드숫자_01", "deathMatch_img_respawn1_1@cn"])
      void this.loadTexture(library, name).catch(() => {});
  }

  private async loadTexture(library: Library, name: string): Promise<void> {
    const file = library.canonicalCandidates(`${ROOT}/${name}.png`)[0];
    if (!file) return;
    const decoded = await decodePngRgba(await file.bytes());
    if (this.disposed) return;
    const image = this.canvas.ownerDocument.createElement("canvas");
    image.width = decoded.width;
    image.height = decoded.height;
    const context = image.getContext("2d");
    if (!context) return;
    context.putImageData(new ImageData(new Uint8ClampedArray(decoded.pixels), decoded.width, decoded.height), 0, 0);
    this.textures.set(name, { image, width: decoded.width, height: decoded.height });
    if (this.lastFrame) this.draw(this.lastFrame);
  }

  update(_nowMs: number, frame: DeathmatchHudFrame): void {
    if (this.disposed) return;
    this.lastFrame = frame;
    this.canvas.hidden = false;
    this.draw(frame);
  }

  private draw(frame: DeathmatchHudFrame): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const ratio = Math.min(this.canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1, 2);
    const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    const context = this.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, pixelWidth, pixelHeight);
    // Uniform scaling keeps the score readable on narrow game windows.
    const scale = Math.min(width / 1600, height / 900);
    context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
    const w = width / scale, h = height / scale;
    const cx = w / 2;
    this.panel(cx - 290, 12, 580, 118);
    this.text(tr("蓝队"), cx - 205, 40, 18, COLORS[2]);
    this.text(tr("红队"), cx + 205, 40, 18, COLORS[1]);
    this.score(frame.scores[2], cx - 145, 57, 2);
    this.score(frame.scores[1], cx + 145, 57, 1);
    this.text(":", cx, 68, 32);
    this.text(deathmatchTimeText(frame.remainingMs), cx, 103, 25);
    this.text(tr("率先获得 {score} 分获胜", { score: DEATHMATCH_RULES.targetScore }), cx, 151, 18);
    this.panel(18, h - 204, 286, 76);
    this.text(tr(frame.team === 1 ? "红队" : "蓝队"), 161, h - 180, 18, COLORS[frame.team]);
    this.text(tr("击落 {kills} · 坠落 {deaths}", { kills: frame.kills, deaths: frame.deaths }),
      161, h - 149, 20);

    if (frame.finished) {
      this.panel(cx - 340, h / 2 - 85, 680, 170);
      const winningTeam = frame.outcome?.winningTeam;
      const title = winningTeam === 1 ? tr("红队胜利！") : winningTeam === 2 ? tr("蓝队胜利！") : tr("平局");
      this.text(title, cx, h / 2 - 24, 40, winningTeam ? COLORS[winningTeam] : "white");
      this.text(`${frame.scores[1]} : ${frame.scores[2]}`, cx, h / 2 + 26, 32);
      this.text(tr("比赛结束"), cx, h / 2 + 62, 19);
    } else if (frame.respawnRemainingMs > 0) {
      this.panel(cx - 240, h / 2 - 64, 480, 128);
      const image = this.textures.get("deathMatch_img_respawn1_1@cn");
      if (image) context.drawImage(image.image, cx - 222, h / 2 - 54, 444, 70);
      this.text(tr("{seconds} 秒后复活", { seconds: Math.ceil(frame.respawnRemainingMs / 1000) }),
        cx, h / 2 + 38, 25);
    } else if (frame.protectedRemainingMs > 0) {
      this.text(tr("复活保护 {seconds} 秒", { seconds: Math.ceil(frame.protectedRemainingMs / 1000) }),
        cx, h * 0.66, 25, "#9fe9ff");
    }
  }

  private panel(x: number, y: number, width: number, height: number): void {
    this.context.fillStyle = "rgba(8,20,38,.82)";
    this.context.fillRect(x, y, width, height);
  }

  private text(text: string, x: number, y: number, size: number, color = "white"): void {
    const context = this.context;
    context.font = `bold ${size}px ${FONT}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = 3;
    context.strokeStyle = "rgba(0,0,0,.7)";
    context.strokeText(text, x, y);
    context.fillStyle = color;
    context.fillText(text, x, y);
  }

  private score(value: number, x: number, y: number, team: 1 | 2): void {
    const text = String(value).padStart(2, "0");
    const texture = this.textures.get(team === 1 ? "레드숫자_01" : "블루숫자_01");
    if (!texture) { this.text(text, x, y + 8, 40, COLORS[team]); return; }
    // scoreUi.bml: ':0123456789', 32×44 cells; preserve native RGBA digit art.
    for (const [index, digit] of [...text].entries()) this.context.drawImage(texture.image,
      (Number(digit) + 1) * 32, 0, 32, 44, x - text.length * 16 + index * 32, y - 14, 32, 44);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.lastFrame = undefined;
    this.textures.clear();
    this.canvas.remove();
  }
}
