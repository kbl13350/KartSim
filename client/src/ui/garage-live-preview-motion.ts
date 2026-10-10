/** Preview yaw and transform animation state for the live garage panels. */

const halfTurn = 3.141592025756836;
const fullTurn = 6.283185005187988;
const single = Math.fround;

export interface GarageMotionPreview {
  origin?: number;
  transformEnabled?: boolean;
  kart: { animation: { state: number; reset(tick: number): void } };
  cosmeticEffects?: {
    restartGaragePreview(time: number): void;
    setState(state: number, mode: number, team: boolean, exceed: boolean, time: number): void;
  };
  cosmeticTrails?: {
    restartGaragePreview(): void;
    setState(state: number, time: number): void;
  };
}

export interface GaragePreviewMotionHost {
  preview?: GarageMotionPreview;
  previewMode: string;
  previewCamera: unknown;
  previewYaw: number;
  previewReverse: boolean;
  previewRearView: boolean;
  previewTargetYaw?: number;
  previewYawTime?: number;
  transformPreviewEnabled: boolean;
  transformPreviewTimelineActive: boolean;
  transformPreviewCancelled: boolean;
  transformPreviewCompleted: boolean;
  transformPreviewClosing: boolean;
  disposed: boolean;
  resetPreviewRotation(rearView?: boolean): void;
  beginTransformPreviewSession(): void;
  closeCompletedTransformPreview(): void;
  setTransformPreview(enabled: boolean): void;
}

export interface GaragePreviewMotionDependencies {
  cameraYaw(camera: unknown, yaw: number): void;
  resetLinkedPresentation(preview: GarageMotionPreview): void;
  now(): number;
}

/** Choose the equivalent yaw nearest the current signed turn. */
export function nearestPreviewYaw(current: number, target: number): number {
  return current < 0 && Math.abs(single(target - current)) >
    Math.abs(single(target + current)) ? -single(fullTurn - target) : target;
}

/** Preserve the release's float32 easing and wraparound. */
export function stepPreviewYaw(current: number, target: number, elapsedMs: number):
  { yaw: number; complete: boolean } {
  const nearest = nearestPreviewYaw(current, target);
  const delta = single(nearest - current);
  const velocity = single(single(delta * 9) + (delta > 0 ? 0.5 : -0.5));
  const next = single(current + single(single(single(elapsedMs) * velocity) * single(0.001)));
  const complete = Math.abs(delta) < single(0.01) ||
    Math.sign(delta) !== Math.sign(single(nearest - next));
  return { yaw: complete ? nearest : next, complete };
}

export function beginPreviewRotation(host: GaragePreviewMotionHost): void {
  host.previewTargetYaw = undefined;
  host.previewYawTime = undefined;
}

export function rotatePreview(host: GaragePreviewMotionHost, delta: number,
  deps: GaragePreviewMotionDependencies): void {
  beginPreviewRotation(host);
  const candidate = single(host.previewYaw - single(delta * single(0.02)));
  let magnitude = Math.abs(candidate);
  while (magnitude > fullTurn) magnitude = single(magnitude - fullTurn);
  if (magnitude > halfTurn) magnitude = -single(fullTurn - magnitude);
  host.previewYaw = candidate < 0 ? -magnitude : magnitude;
  deps.cameraYaw(host.previewCamera, host.previewYaw);
}

export function beginTransformPreviewSession(host: GaragePreviewMotionHost): void {
  if (host.transformPreviewEnabled) return;
  host.transformPreviewCompleted = false;
  host.transformPreviewClosing = false;
  host.transformPreviewCancelled = false;
  host.transformPreviewTimelineActive = false;
  host.transformPreviewEnabled = true;
  host.resetPreviewRotation(true);
}

export function restartTransformPreview(host: GaragePreviewMotionHost,
  deps: GaragePreviewMotionDependencies): void {
  if (!host.transformPreviewEnabled) host.beginTransformPreviewSession();
  host.transformPreviewCompleted = false;
  host.transformPreviewClosing = false;
  host.transformPreviewTimelineActive = true;
  host.transformPreviewCancelled = false;
  if (host.preview) {
    host.preview.origin = undefined;
    host.preview.cosmeticEffects?.restartGaragePreview(deps.now());
    host.preview.cosmeticTrails?.restartGaragePreview();
  }
}

export function toggleTransformPreview(host: GaragePreviewMotionHost): void {
  if (host.transformPreviewClosing) return;
  if (host.transformPreviewCompleted) host.closeCompletedTransformPreview();
  else host.setTransformPreview(!host.transformPreviewEnabled);
}

export function setTransformPreview(host: GaragePreviewMotionHost, enabled: boolean,
  deps: GaragePreviewMotionDependencies): void {
  if (enabled === host.transformPreviewEnabled) return;
  if (enabled) {
    host.transformPreviewCompleted = false;
    host.transformPreviewClosing = false;
    const wasCancelled = host.transformPreviewCancelled;
    host.transformPreviewTimelineActive = true;
    host.transformPreviewCancelled = false;
    if (wasCancelled && host.preview) host.preview.origin = undefined;
  }
  host.transformPreviewEnabled = enabled;
  if (enabled) {
    const now = deps.now();
    host.preview?.cosmeticEffects?.restartGaragePreview(now);
    host.preview?.cosmeticTrails?.restartGaragePreview();
  } else {
    if (host.transformPreviewTimelineActive) {
      host.transformPreviewCancelled = true;
      const animation = host.preview?.kart.animation;
      if (!host.preview || host.preview.transformEnabled !== true || animation?.state === 0)
        host.transformPreviewTimelineActive = false;
    }
    const now = deps.now();
    host.preview?.cosmeticEffects?.setState(0, 0, false, false, now);
    host.preview?.cosmeticTrails?.setState(0, now);
  }
  host.resetPreviewRotation(enabled);
}

export function resetPreviewForPageTransition(host: GaragePreviewMotionHost,
  deps: GaragePreviewMotionDependencies): void {
  if (host.disposed) return;
  const now = deps.now();
  host.transformPreviewEnabled = false;
  host.transformPreviewTimelineActive = false;
  host.transformPreviewCancelled = false;
  host.transformPreviewCompleted = false;
  host.transformPreviewClosing = false;
  host.previewTargetYaw = undefined;
  host.previewYawTime = undefined;
  host.previewYaw = 0;
  host.previewRearView = false;
  if (host.previewMode === "kart-only") host.previewReverse = false;
  deps.cameraYaw(host.previewCamera, 0);
  host.preview?.cosmeticEffects?.setState(0, 0, false, false, now);
  host.preview?.cosmeticTrails?.setState(0, now);
  if (host.preview) {
    host.preview.transformEnabled = false;
    host.preview.origin = undefined;
    host.preview.kart.animation.reset(Math.trunc(now) >>> 0);
    deps.resetLinkedPresentation(host.preview);
  }
}

export function closeCompletedTransformPreview(host: GaragePreviewMotionHost,
  deps: GaragePreviewMotionDependencies): void {
  const now = deps.now();
  host.transformPreviewCompleted = false;
  host.transformPreviewEnabled = false;
  host.transformPreviewTimelineActive = false;
  host.transformPreviewCancelled = false;
  host.transformPreviewClosing = Math.abs(host.previewYaw) >= 0.01;
  host.preview?.cosmeticEffects?.restartGaragePreview(now);
  host.preview?.cosmeticTrails?.restartGaragePreview();
  if (host.preview) {
    host.preview.transformEnabled = false;
    host.preview.origin = undefined;
  }
  host.previewTargetYaw = 0;
  host.previewYawTime = undefined;
  host.previewRearView = false;
  deps.cameraYaw(host.previewCamera, host.previewYaw);
}

export function resetPreviewRotation(host: GaragePreviewMotionHost, rearView = host.previewRearView): void {
  host.previewRearView = rearView;
  host.previewTargetYaw = host.previewMode === "kart-only"
    ? rearView ? single(Math.PI / 2) : 0
    : rearView || host.previewReverse ? halfTurn : 0;
  host.previewYawTime = undefined;
}

export function advancePreviewRotation(host: GaragePreviewMotionHost, now: number,
  deps: GaragePreviewMotionDependencies): void {
  if (host.previewTargetYaw === undefined) return;
  const tick = Math.floor(now) >>> 0;
  const elapsed = (tick - (host.previewYawTime ?? tick)) >>> 0;
  const step = stepPreviewYaw(host.previewYaw, host.previewTargetYaw, elapsed);
  host.previewYaw = step.yaw;
  host.previewYawTime = tick;
  if (step.complete) {
    host.previewTargetYaw = undefined;
    if (host.transformPreviewClosing) host.transformPreviewClosing = false;
  }
  deps.cameraYaw(host.previewCamera, host.previewYaw);
}
