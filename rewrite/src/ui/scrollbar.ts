/** Rectangle coordinates use the game's 1600 × 900 logical UI space. */
export interface UiRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UiPoint {
  x: number;
  y: number;
}

export interface ScrollbarSkin {
  minButtonHeight: number;
}

export interface ScrollPosition {
  contentOffset: number;
  position: number;
}

export interface ScrollbarGeometry {
  area: UiRectangle;
  button: UiRectangle;
}

interface ScrollbarLayout {
  scrollbar: ScrollbarSkin;
  rect: UiRectangle;
  count: number;
  contentLength: number;
  value: ScrollPosition;
  geometry: ScrollbarGeometry;
}

/** Convert a pixel offset into the row position expected by the game UI. */
export function scrollPosition(rect: UiRectangle, offset: number): ScrollPosition {
  return {
    contentOffset: offset,
    position: Math.trunc(Math.fround(offset / rect.height)),
  };
}

/** Inclusive hit test, matching the original button and track boundaries. */
export function pointInRectangle(point: UiPoint, rect: UiRectangle): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width &&
    point.y >= rect.y && point.y <= rect.y + rect.height;
}

/** Size and locate the thumb. Intermediate values deliberately use float32. */
export function scrollbarGeometry(
  skin: ScrollbarSkin,
  rect: UiRectangle,
  count: number,
  position: number,
  contentOffset = Math.fround(position * rect.height),
  contentLength = Math.fround(count * rect.height),
): ScrollbarGeometry {
  const trackHeight = Math.fround(rect.height);
  const proportionalHeight = Math.fround(Math.fround(trackHeight * trackHeight) / contentLength);
  const thumbHeight = Math.min(trackHeight, Math.max(skin.minButtonHeight, proportionalHeight));
  const thumbRange = Math.fround(trackHeight - Math.fround(thumbHeight - proportionalHeight));
  const thumbOffset = Math.trunc(Math.fround(Math.fround(thumbRange * contentOffset) / contentLength));
  return {
    area: rect,
    button: {
      x: rect.x,
      y: rect.y + thumbOffset,
      width: Math.trunc(rect.width),
      height: Math.trunc(thumbHeight),
    },
  };
}

/** Map a thumb drag to a bounded content offset. */
export function dragScrollPosition(
  rect: UiRectangle,
  count: number,
  pointerY: number,
  grabOffset: number,
  contentLength = Math.fround(count * rect.height),
): ScrollPosition {
  const distance = Math.max(0, Math.fround(Math.fround(pointerY - rect.y) - grabOffset));
  const offset = Math.min(
    Math.fround(contentLength - rect.height),
    Math.fround(Math.fround(contentLength * distance) / rect.height),
  );
  return scrollPosition(rect, offset);
}

/** Advance by a wheel or track click, with the original backward clamp. */
export function stepScrollPosition(
  rect: UiRectangle,
  count: number,
  offset: number,
  direction: number,
  clampBackward = false,
  contentLength = Math.fround(count * rect.height),
  stepPixels = rect.height,
): ScrollPosition {
  const candidate = Math.fround(offset + direction * stepPixels);
  const minimum = clampBackward && direction < 0 && candidate < stepPixels ? stepPixels : 0;
  const next = candidate < minimum
    ? 0
    : Math.min(Math.fround(contentLength - rect.height), candidate);
  return scrollPosition(rect, next);
}

/** Input state for the scrollbar shared by garage, track select and settings. */
export class ScrollbarController {
  buttonState = 3;
  current?: ScrollbarLayout;
  grabOffset?: number;
  trackPoint?: UiPoint;
  direction = 1;
  repeatStart = 0;
  lastRepeat = 0;
  repeatFrame?: number;

  constructor(readonly onChange: (position: number) => void) {}

  get contentOffset(): number {
    return this.current?.value.contentOffset ?? 0;
  }

  layout(
    skin: ScrollbarSkin,
    rect: UiRectangle,
    count: number,
    position: number,
    contentLength = Math.fround(count * rect.height),
  ): ScrollbarGeometry {
    const previous = this.current;
    const changed = !previous || previous.count !== count ||
      previous.value.position !== position || previous.rect.height !== rect.height;
    if (changed) this.stopPointer();
    const value = changed ? scrollPosition(rect, Math.fround(position * rect.height)) : previous.value;
    const geometry = scrollbarGeometry(skin, rect, count, position, value.contentOffset, contentLength);
    this.current = { scrollbar: skin, rect, count, contentLength, value, geometry };
    return geometry;
  }

  down(point: UiPoint): boolean {
    const state = this.current;
    if (!state || state.count <= 1 || !pointInRectangle(point, state.geometry.area)) return false;
    this.stopPointer();
    if (pointInRectangle(point, state.geometry.button)) {
      this.grabOffset = Math.fround(point.y - state.geometry.button.y);
      this.setButtonState(2);
    } else {
      this.startTrack(point);
    }
    return true;
  }

  move(point: UiPoint, isPressed: boolean): void {
    const state = this.current;
    if (!state) return;
    if (this.grabOffset !== undefined && !isPressed) {
      this.up();
      return;
    }
    this.updateButtonState(point, isPressed);
    if (this.grabOffset !== undefined) {
      this.apply(dragScrollPosition(state.rect, state.count, point.y,
        this.grabOffset, state.contentLength));
    }
  }

  wheel(direction: number, stepPixels: number, clampBackward = false): boolean {
    const state = this.current;
    if (!state || state.count <= 1) return false;
    this.apply(stepScrollPosition(state.rect, state.count, state.value.contentOffset,
      direction, clampBackward, state.contentLength, stepPixels));
    return true;
  }

  up(): void {
    this.stopPointer();
    this.notify();
  }

  leave(): void {
    this.stopRepeat();
    this.setButtonState(3);
  }

  reset(): void {
    this.stopPointer();
    this.current = undefined;
  }

  dispose(): void {
    this.reset();
  }

  startTrack(point: UiPoint): void {
    const state = this.current!;
    this.trackPoint = point;
    this.direction = point.y < state.geometry.button.y ? -1 : 1;
    this.repeatStart = performance.now();
    this.lastRepeat = this.repeatStart;
    this.apply(stepScrollPosition(state.rect, state.count, state.value.contentOffset,
      this.direction, false, state.contentLength));
    this.repeatFrame = requestAnimationFrame(this.repeatTrack);
  }

  repeatTrack = (time: number): void => {
    this.repeatFrame = undefined;
    if (!this.current || !this.trackPoint) return;
    if (time > this.repeatStart + 300) this.repeatStep(time);
    if (this.trackPoint) this.repeatFrame = requestAnimationFrame(this.repeatTrack);
  };

  repeatStep(time: number): void {
    const state = this.current!;
    if (time > this.lastRepeat + 77) {
      this.lastRepeat = time;
      this.apply(stepScrollPosition(state.rect, state.count, state.value.contentOffset,
        this.direction, true, state.contentLength));
    }
    if (pointInRectangle(this.trackPoint!, this.current!.geometry.button)) this.stopRepeat();
  }

  apply(value: ScrollPosition): void {
    const state = this.current!;
    state.value = value;
    state.geometry = scrollbarGeometry(state.scrollbar, state.rect, state.count,
      value.position, value.contentOffset, state.contentLength);
    this.notify();
  }

  setButtonState(state: number): void {
    if (this.buttonState !== state) {
      this.buttonState = state;
      this.notify();
    }
  }

  updateButtonState(point: UiPoint, isPressed: boolean): void {
    this.setButtonState(isPressed && pointInRectangle(point, this.current!.geometry.button) ? 2 : 3);
  }

  notify(): void {
    if (this.current) this.onChange(this.current.value.position);
  }

  stopPointer(): void {
    this.grabOffset = undefined;
    this.buttonState = 3;
    this.stopRepeat();
  }

  stopRepeat(): void {
    this.trackPoint = undefined;
    if (this.repeatFrame !== undefined) cancelAnimationFrame(this.repeatFrame);
    this.repeatFrame = undefined;
  }
}
