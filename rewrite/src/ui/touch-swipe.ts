/** Converts a vertical touch drag into discrete pages in the track picker. */
export class TouchPageSwipe {
  pointer?: number;
  startY = 0;
  steps = 0;
  moved = false;

  constructor(
    readonly pagePixels = 48,
    readonly tapSlop = 8,
    readonly onPage?: (direction: number) => boolean,
  ) {}

  isActive(pointerId: number): boolean {
    return this.pointer === pointerId;
  }

  begin(pointerId: number, y: number): void {
    this.pointer = pointerId;
    this.startY = y;
    this.steps = 0;
    this.moved = false;
  }

  move(pointerId: number, y: number): void {
    if (this.pointer !== pointerId) return;
    const delta = y - this.startY;
    if (Math.abs(delta) >= this.tapSlop) this.moved = true;
    const targetSteps = Math.trunc(-delta / this.pagePixels);
    const direction = targetSteps > this.steps ? 1 : -1;
    while (this.steps !== targetSteps && this.onPage?.(direction)) {
      this.steps += direction;
    }
  }

  /** Returns whether the gesture moved far enough to suppress a tap. */
  finish(pointerId: number): boolean {
    if (this.pointer !== pointerId) return false;
    const moved = this.moved;
    this.pointer = undefined;
    this.steps = 0;
    this.moved = false;
    return moved;
  }
}
