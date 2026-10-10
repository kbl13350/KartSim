import type { Vector3 } from "./continuous-motion";
import type { RailMatrix } from "./rail-frame";
import {
  angularVelocityInRouteBasis,
  bodyBasisMatrix,
  integrateOrientation,
  multiplyMatrices,
  setBodyBasis,
  transposeMatrix,
  type OrientedBody,
} from "./orientation-math";

export interface OrientationIntegrationContext {
  body: OrientedBody & { position: Vector3; linearVelocity: Vector3 };
  runtime: {
    motionMode: number;
    railFrame?: RailMatrix;
    railRelativeOrientation: RailMatrix;
    freeOrientationLatch: boolean;
  };
  visualScaleMode(): number;
}

const float = Math.fround;

function integratePosition(body: OrientationIntegrationContext["body"], seconds: number): void {
  body.position.x = float(body.position.x + float(body.linearVelocity.x * seconds));
  body.position.y = float(body.position.y + float(body.linearVelocity.y * seconds));
  body.position.z = float(body.position.z + float(body.linearVelocity.z * seconds));
}

/** Integrate a captured rail vehicle in route coordinates. */
export function integrateVehicleRailOrientation(vehicle: OrientationIntegrationContext, seconds: number): void {
  integratePosition(vehicle.body, seconds);
  const { runtime, body } = vehicle;
  const railFrame = runtime.railFrame;
  if (!railFrame) throw new Error("full3D integration 缺少有效 BF8 rail frame。");
  const angularVelocity = angularVelocityInRouteBasis(body.angularVelocity);
  if (runtime.motionMode === 3) {
    runtime.railRelativeOrientation = integrateOrientation(runtime.railRelativeOrientation, angularVelocity, seconds);
    setBodyBasis(body, multiplyMatrices(railFrame, runtime.railRelativeOrientation));
    return;
  }
  const worldOrientation = integrateOrientation(bodyBasisMatrix(body), angularVelocity, seconds);
  setBodyBasis(body, worldOrientation);
  runtime.railRelativeOrientation = multiplyMatrices(transposeMatrix(railFrame), worldOrientation);
}

/** Integrate regular steering orientation, damping rollover when free rotation is disabled. */
export function integrateVehicleRoadOrientation(vehicle: OrientationIntegrationContext, seconds: number): void {
  const { runtime, body } = vehicle;
  integratePosition(body, seconds);
  if (vehicle.visualScaleMode() === 1) {
    body.angularVelocity.x = 0;
    body.angularVelocity.z = -0;
  }
  const freeOrientation = runtime.freeOrientationLatch || runtime.motionMode === 6;
  const originalBasis = bodyBasisMatrix(body);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = integrateOrientation(originalBasis, angularVelocityInRouteBasis(body.angularVelocity), seconds);
    if (freeOrientation || candidate[2].z >= float(0.5) || attempt === 4) {
      setBodyBasis(body, candidate);
      return;
    }
    if (attempt < 3) {
      body.angularVelocity.x = float(body.angularVelocity.x * float(0.1));
      body.angularVelocity.z = float(body.angularVelocity.z * float(0.1));
    } else {
      body.angularVelocity.x = 0;
      body.angularVelocity.z = -0;
    }
  }
}
