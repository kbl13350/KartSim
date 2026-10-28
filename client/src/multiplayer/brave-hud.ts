import { Vector3, type Camera } from "three";
import { BraveSignals, type BraveRacer, type BraveSignalConnection } from "./brave-signals";
interface Point { x: number; y: number; z: number }
export interface BraveHudFrame {
  active: boolean;
  camera: Camera;
  position: Point;
  pose(playerId: string): { position: Point } | undefined;
  finished(playerId: string): boolean;
}
/** Approaching opponents, red contact flash and teammate beacon. P3553 has no
 * identified original warning layout; these visuals reconstruct its behavior. */
export class BraveHud {
  readonly canvas: HTMLCanvasElement;
  readonly signals: BraveSignals;
  private readonly context: CanvasRenderingContext2D;
  private readonly target = new Vector3();
  private disposed = false;
  private active = false;
  constructor(root: HTMLElement, physics: object, private readonly playerId: string,
    private readonly roster: readonly BraveRacer[], connection: BraveSignalConnection,
    now: () => number) {
    this.canvas = root.ownerDocument.createElement("canvas");
    this.canvas.dataset.braveHud = "true";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5";
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("勇者模式缺少 Canvas 2D 支持。");
    this.context = context;
    this.canvas.hidden = true;
    root.append(this.canvas);
    this.signals = new BraveSignals(physics, playerId, roster, connection, now);
  }
  setVisible(visible: boolean): void { this.canvas.hidden = !visible || !this.active; }
  update(nowMs: number, frame: BraveHudFrame): void {
    if (this.disposed) return;
    this.active = frame.active;
    this.signals.setActive(frame.active);
    this.setVisible(frame.active);
    const width = Math.max(1, Math.round(this.canvas.clientWidth));
    const height = Math.max(1, Math.round(this.canvas.clientHeight));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    const ctx = this.context;
    ctx.clearRect(0, 0, width, height);
    if (!frame.active) return;
    const team = this.roster.find(racer => racer.playerId === this.playerId)?.team;
    for (const racer of this.roster) {
      if (racer.team === team || frame.finished(racer.playerId)) continue;
      const pose = frame.pose(racer.playerId);
      if (!pose) continue;
      const distance = Math.hypot(pose.position.x - frame.position.x,
        pose.position.y - frame.position.y, pose.position.z - frame.position.z);
      if (distance > 120) continue;
      this.target.set(pose.position.x, pose.position.y + 1.5, pose.position.z).project(frame.camera);
      // No depth/occlusion test: the original warns through track scenery.
      if (this.target.z < -1 || this.target.z > 1) continue;
      const x = Math.min(width - 25, Math.max(25, (this.target.x + 1) * width / 2));
      const y = Math.min(height - 50, Math.max(45, (1 - this.target.y) * height / 2));
      const size = 15 + Math.max(0, 1 - distance / 120) * 11;
      ctx.strokeStyle = racer.team === 1 ? "#ff4c45" : "#43bcff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
        ctx.moveTo(x + dx * size, y + dy * size * 0.5);
        ctx.lineTo(x + dx * size, y + dy * size);
        ctx.lineTo(x + dx * size * 0.5, y + dy * size);
      }
      ctx.stroke();
      ctx.fillStyle = "white"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`${Math.round(distance)} m`, x, y + size + 16);
    }
    const flash = Math.max(0, 1 - (nowMs - this.signals.selfHitAt) / 500);
    if (flash > 0) {
      const gradient = ctx.createRadialGradient(width / 2, height / 2, height * 0.15,
        width / 2, height / 2, Math.max(width, height) * 0.65);
      gradient.addColorStop(0, "rgba(255,0,0,0)");
      gradient.addColorStop(1, `rgba(255,20,10,${flash * 0.7})`);
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    }
    const warning = nowMs - this.signals.teamHitAt;
    if (warning >= 0 && warning < 1000) {
      const x = width / 2, y = height * 0.12;
      const left = Math.floor(warning / 150) % 2 === 0;
      ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x - 38, y - 4, 76, 31);
      ctx.fillStyle = left ? "#ff433a" : "#78352e"; ctx.fillRect(x - 32, y, 29, 22);
      ctx.fillStyle = left ? "#22497a" : "#45b6ff"; ctx.fillRect(x + 3, y, 29, 22);
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.signals.dispose(); this.canvas.remove();
  }
}
