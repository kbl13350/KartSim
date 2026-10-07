export interface RouteSurfaceListenerDependencies {
  routeEffect(tag: string): string;
}

/** Applies track route tags to weather, camera effects, and warp transitions. */
export function handleRouteSurfaceTag(listener: any, tag: string,
  eventFrame: unknown, dependencies: RouteSurfaceListenerDependencies): void {
  const host = listener.host;
  if (!host.getPhysics().handleRouteSurfaceTag(tag))
    throw new Error(`${tag} 的 TimeAttack listener 尚未闭合。`);
  listener.applyWarpNextActions(host.warpNext.enter(tag,
    listener.warpNextEventFrame(tag, eventFrame),
    host.presentationClockMs, host.getTrack().data.warp));

  const effect = dependencies.routeEffect(tag);
  if (effect === "flash") host.lightFactor.trigger();
  if (effect.startsWith("shake")) {
    if (tag.includes(":in:")) host.cameraShake.enter();
    else if (tag.includes(":out:")) host.cameraShake.leave(true);
  }
  if (effect.startsWith("wave")) {
    if (tag.includes(":in:")) host.cameraWave.enter();
    else if (tag.includes(":out:")) host.cameraWave.leave();
  }
  if (effect === "norain" || effect === "rail, norain") {
    if (!host.session.rain || !host.session.rainAudio) return;
    const enabled = tag.includes(":out:");
    host.session.rain.setEnabled(enabled);
    host.session.rainAudio.setRainEnabled(enabled);
  }
  if (effect === "nosnow")
    host.session.snow?.setEnabled(tag.includes(":out:"));
  if (effect === "lensflare")
    host.getTrack().setLensFlareEnabled(tag.includes(":in:"));
}

export function warpNextEventFrame(listener: any, tag: string,
  eventFrame: unknown): unknown {
  return tag === "warpnext:in:next"
    ? listener.host.getTrack().warpNextDestination(listener.host.getPhysics())
    : eventFrame;
}

export function applyWarpNextActions(listener: any,
  actions: Array<{ kind: string }>): void {
  for (const action of actions) listener.applyWarpNextAction(action);
}

export function applyWarpNextAction(listener: any, action: any): void {
  const host = listener.host;
  if (action.kind === "start-warp-presentation") {
    host.getPhysics().setWarpPresentationActive(true);
    host.getPhysics().setWarpPressProtected(true);
    const hud = host.session.warpHud;
    if (hud) hud.hidden = true;
  } else if (action.kind === "reset-drive-camera") {
    host.driveCameraman.reset(0);
    host.session.driveCameraState = undefined;
  } else if (action.kind === "freeze-camera") {
    listener.freezeWarpCamera();
  } else if (action.kind === "teleport") {
    host.getPhysics().completeCheckpointPose(action.frame, action.clearMotion);
    host.getPhysics().setWarpPressProtected(false);
    if (action.clearMotion)
      host.session.coordinator?.completeWarpNextRailLanding();
    else host.session.coordinator?.deferWarpNextRailLanding();
    host.session.coordinator?.synchronizePositionAnchor();
    host.session.warpCameraFrozen = false;
  } else if (action.kind === "finish-warp-presentation") {
    host.getPhysics().setWarpPresentationActive(false);
    host.getPhysics().setFullPhysicsBypass(false);
    host.getPhysics().restoreResetInteraction();
  } else if (action.kind === "finish-warp-letterbox") {
    const hud = host.session.warpHud;
    if (hud) hud.hidden = false;
  }
}

export function freezeWarpCamera(listener: any): void {
  if (!listener.host.session.warpNextCamera)
    throw new Error(
      "warpnextcamera_cam 缺失；P3528 同帧会进入空 ReCameraman，Web 禁止以旧镜头代替。");
  listener.host.session.warpCameraFrozen = true;
}
