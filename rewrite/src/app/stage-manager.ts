/** A rendered screen in the game loop. */
export interface GameStage<Parameter = unknown, Frame = unknown, Packet = unknown> {
  enter(parameter: Parameter | undefined): void;
  exit(): void;
  update(frame: Frame): void;
  render(): void;
  onPacket(packet: Packet): void;
}

/**
 * Owns the active screen and applies requested changes at the start of a frame.
 * A later request replaces an earlier pending request, as in the released client.
 */
export class StageManager<Parameter = unknown, Frame = unknown, Packet = unknown> {
  private readonly factories = new Map<string, () => GameStage<Parameter, Frame, Packet>>();
  private current?: { name: string; stage: GameStage<Parameter, Frame, Packet> };
  private pending?: { name: string; param: Parameter | undefined };

  register(name: string, factory: () => GameStage<Parameter, Frame, Packet>): void {
    if (this.factories.has(name)) {
      throw new Error(`StageManager 重复注册 stage：${name}。`);
    }
    this.factories.set(name, factory);
  }

  isRegistered(name: string): boolean {
    return this.factories.has(name);
  }

  changeStage(name: string, param?: Parameter): boolean {
    if (!this.factories.has(name)) return false;
    this.pending = { name, param };
    return true;
  }

  enter(): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = undefined;
    this.current?.stage.exit();
    const stage = this.factories.get(pending.name)!();
    this.current = { name: pending.name, stage };
    stage.enter(pending.param);
  }

  update(frame: Frame): void {
    this.current?.stage.update(frame);
  }

  render(): void {
    this.current?.stage.render();
  }

  onPacket(packet: Packet): void {
    this.current?.stage.onPacket(packet);
  }

  get currentName(): string | undefined {
    return this.current?.name;
  }
}
