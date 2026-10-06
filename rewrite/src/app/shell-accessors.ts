/** Remaining application clock, notice, resize, and optional diagnostics hooks. */

export type PresenterClock =
  | "previousRenderTime" | "lastUpdateMs" | "presentationClockMs"
  | "fps" | "maxRafDelayMs";

export interface ShellAccessorHost {
  presenter: Record<PresenterClock, unknown>;
  ready: {
    getWindowNotice(): unknown;
    setWindowNotice(value: unknown): void;
  };
  configureBackbuffer(): void;
}

/** The presenter owns all frame clocks exposed by the shell. */
export function readPresenterClock(host: ShellAccessorHost, clock: PresenterClock): unknown {
  return host.presenter[clock];
}

export function writePresenterClock(host: ShellAccessorHost,
  clock: PresenterClock, value: unknown): void {
  host.presenter[clock] = value;
}

export function getActiveWindowNotice(host: ShellAccessorHost): unknown {
  return host.ready.getWindowNotice();
}

export function setActiveWindowNotice(host: ShellAccessorHost, value: unknown): void {
  host.ready.setWindowNotice(value);
}

export function onApplicationViewportResize(host: ShellAccessorHost): void {
  host.configureBackbuffer();
}

// These extension points are intentionally empty in the verified release.
export function mountDevTools(): void {}
export function setDevToolsTrackObjectKind(_kind: unknown, _visible: unknown): void {}
export function mountDevToolsTrackOverlay(): void {}
export function mountDevToolsTrackObjectsOverlay(): void {}
