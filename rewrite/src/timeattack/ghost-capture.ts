interface Vector3 { x: number; y: number; z: number }
interface Quaternion { w: number; x: number; y: number; z: number }

interface GhostCapturePhysics {
  body: {
    position: Vector3;
    right: Vector3;
    forward: Vector3;
    up: Vector3;
  };
  driveCameraRuntime(): { stateCode: number; action8: number };
  driftVisualRuntime(): { active: boolean };
}

export interface GhostCaptureStage {
  host: { getPhysics(): GhostCapturePhysics };
}

export interface GhostCaptureDependencies {
  bodyQuaternion(axes: {
    position: Vector3;
    right: Vector3;
    forward: Vector3;
    up: Vector3;
  }): Quaternion;
  statusFlags(cameraState: number, drifting: boolean, action8: number): number;
}

/** Capture one Ghost frame in the released coordinate and status format. */
export function captureGhostRuntime(
  stage: GhostCaptureStage,
  timeMs: number,
  dependencies: GhostCaptureDependencies,
): {
  timeMs: number;
  x: number;
  y: number;
  z: number;
  w: number;
  qx: number;
  qy: number;
  qz: number;
  status: number;
} {
  const { host } = stage;
  const body = host.getPhysics().body;
  const rotation = dependencies.bodyQuaternion({
    position: body.position,
    right: body.right,
    forward: body.forward,
    up: body.up,
  });
  const camera = host.getPhysics().driveCameraRuntime();
  return {
    timeMs,
    x: body.position.x,
    y: Math.fround(-body.position.z),
    z: body.position.y,
    w: rotation.w,
    qx: rotation.x,
    qy: rotation.y,
    qz: rotation.z,
    status: dependencies.statusFlags(
      camera.stateCode,
      host.getPhysics().driftVisualRuntime().active,
      camera.action8,
    ),
  };
}
