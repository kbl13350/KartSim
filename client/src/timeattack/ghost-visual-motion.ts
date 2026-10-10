/** Derives display motion and animation state for a replay Ghost kart. */

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface GhostVisualMotionHost {
  hasLastPose: boolean;
  lastPosePosition: Vec3Like;
  lastPoseHeading: number;
  lastPoseTimeMs: number;
  burstTeam: boolean;
  animation?: {
    update(time: number, charging: boolean, transformTime: number,
      secondaryState: number, boosterState: number): void;
  };
  visual?: {
    isTransformAutoCharge: boolean;
    autoChargeLowSpeed: number;
    transformTime: number;
  };
}

export interface GhostVisualSample {
  position: Vec3Like;
}

export interface GhostVisualVelocity {
  velocity: Vec3Like;
  speedKmh: number;
}

export function deriveGhostVisualMotion(host: GhostVisualMotionHost,
  pose: GhostVisualSample, forward: Vec3Like, timeMs: number,
  telemetry?: GhostVisualVelocity): {
    forwardSpeed: number;
    rawSteer: number;
    displaySpeedKmh: number;
  } {
  const heading = Math.atan2(forward.x, forward.z);
  let forwardSpeed = 0;
  let rawSteer = 0;
  let displaySpeedKmh = 0;
  if (host.hasLastPose) {
    const seconds = (timeMs - host.lastPoseTimeMs) / 1000;
    if (seconds > 0) {
      const dx = pose.position.x - host.lastPosePosition.x;
      const dy = pose.position.y - host.lastPosePosition.y;
      const dz = pose.position.z - host.lastPosePosition.z;
      displaySpeedKmh = Math.sqrt(dx * dx + dy * dy + dz * dz) / seconds * 3.6;
      forwardSpeed = (dx * forward.x + dy * forward.y + dz * forward.z) / seconds;
      let deltaHeading = heading - host.lastPoseHeading;
      while (deltaHeading > Math.PI) deltaHeading -= Math.PI * 2;
      while (deltaHeading < -Math.PI) deltaHeading += Math.PI * 2;
      rawSteer = deltaHeading;
    }
  }
  if (telemetry) {
    // The replay's velocity uses a different axis order from rendering.
    const renderedVelocity = {
      x: telemetry.velocity.x,
      y: telemetry.velocity.z,
      z: -telemetry.velocity.y,
    };
    forwardSpeed = renderedVelocity.x * forward.x +
      renderedVelocity.y * forward.y + renderedVelocity.z * forward.z;
    displaySpeedKmh = telemetry.speedKmh;
  }
  host.hasLastPose = true;
  host.lastPosePosition.x = pose.position.x;
  host.lastPosePosition.y = pose.position.y;
  host.lastPosePosition.z = pose.position.z;
  host.lastPoseHeading = heading;
  host.lastPoseTimeMs = timeMs;
  return { forwardSpeed, rawSteer, displaySpeedKmh };
}

export function updateGhostVisualAnimation(host: GhostVisualMotionHost,
  timeMs: number, boosterState: number, secondaryState: number,
  displaySpeedKmh: number): void {
  if (!host.animation || !host.visual) return;
  const charging = host.visual.isTransformAutoCharge &&
      displaySpeedKmh > host.visual.autoChargeLowSpeed ||
    boosterState > 2 && boosterState < 12;
  host.animation.update(timeMs >>> 0, charging,
    host.visual.transformTime, secondaryState, boosterState);
}

export function isGhostDualTeam(host: GhostVisualMotionHost,
  boosterState: number): boolean {
  return boosterState === 4 ? true
    : boosterState === 10 && host.burstTeam;
}
