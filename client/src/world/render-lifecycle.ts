export interface SceneController {
  update(timeMs: number, frame: unknown, camera: unknown, viewport: unknown): void;
  reset(timeMs: number): void;
}

export interface LensFlareController {
  update(frame: unknown, camera: unknown, viewport: unknown): void;
  reset(): void;
  setEnabled(enabled: boolean): void;
}

export interface TrackRenderHost {
  renderScene?: SceneController;
  skydomeScene?: SceneController;
  lensFlare?: LensFlareController;
  movingSurface?: { update(timeMs: number): void; rebase(): void };
  data: { eventRuntimes?: readonly { reset(): void }[] };
  pendingEventRuntimes?: unknown;
  activeEventRuntimes: unknown[];
  expiredEventEffects: unknown[];
  updateRender(timeMs: number, frame: unknown, camera: unknown, viewport: unknown): void;
}

export function updateTrackRender(host: TrackRenderHost, timeMs: number,
  frame: unknown, camera: unknown, viewport: unknown): void {
  host.renderScene?.update(timeMs, frame, camera, viewport);
  host.skydomeScene?.update(timeMs, frame, camera, viewport);
  host.lensFlare?.update(frame, camera, viewport);
}

export function setTrackLensFlareEnabled(host: TrackRenderHost, enabled: boolean): void {
  host.lensFlare?.setEnabled(enabled);
}

/** Restores the rendered world and its collision/event snapshots to one clock. */
export function resetTrackRender(host: TrackRenderHost, timeMs: number,
  frame: unknown, camera: unknown, viewport: unknown): void {
  host.renderScene?.reset(timeMs);
  host.skydomeScene?.reset(timeMs);
  host.lensFlare?.reset();
  host.updateRender(timeMs, frame, camera, viewport);
  host.movingSurface?.rebase();
  host.data.eventRuntimes?.forEach(event => event.reset());
  host.pendingEventRuntimes = undefined;
  host.activeEventRuntimes = [];
  host.expiredEventEffects = [];
}

export function updateMovingRoads(host: TrackRenderHost, timeMs: number): void {
  host.movingSurface?.update(timeMs);
}
