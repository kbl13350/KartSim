/**
 * A real AL vehicle on a flat test road for item-race tests. The kart spec
 * comes from the bundled CN physics tables and the tuning record from the
 * same `jt0` builder the race loader uses.
 */
import { AL } from "../generated/driving.js";
import { vI } from "../generated/library.js";
import { bundledVehicleSpecCatalog } from "../physics/bundled";
import type { Vector3 } from "./continuous-motion";
import { installVehicleItemMode } from "./item-mode";
import { vehiclePhysicsParameters, type PhysicsParameterSpec } from "./physics-parameters";

export interface TestDrivingInput {
  forward: number;
  reverse: number;
  steer: number;
  rawSteer: number;
  steeringInverted: boolean;
  rawDriftHeld: boolean;
  derivedDriftHeld: boolean;
  actionMarkerWord: number;
}

export const neutralInput: Readonly<TestDrivingInput> = Object.freeze({
  forward: 0, reverse: 0, steer: 0, rawSteer: 0, steeringInverted: false,
  rawDriftHeld: false, derivedDriftHeld: false, actionMarkerWord: 0,
});
export const throttleInput: Readonly<TestDrivingInput> = Object.freeze({ ...neutralInput, forward: 1 });

const flatRoad = { road: { attributes: [] as Array<{ name: string; value: string }> } };

/** An endless y = 0 plane; wheel rays are segments from `origin` to `origin + direction`. */
export const flatTrack = {
  rayQuery(origin: Vector3, direction: Vector3) {
    if (direction.y === 0) return undefined;
    const t = -origin.y / direction.y;
    if (!(t >= 0 && t <= 1)) return undefined;
    return {
      point: { x: origin.x + direction.x * t, y: 0, z: origin.z + direction.z * t },
      normal: { x: 0, y: 1, z: 0 },
      roadDescriptor: flatRoad,
      auxiliaryDirection: { x: 0, y: 1, z: 0 },
      surfaceVelocity: { x: 0, y: 0, z: 0 },
      obstacleSource: false,
      distance: t,
    };
  },
  queryObb() { return []; },
};

const dimensions = { rawHalfWidth: 0.9, rawHalfLength: 1.5, scaleX: 1, scaleY: 1, rawHeight: 1 };
const visual = { autoChargeLowSpeed: 100, driftGaugeReset: true, wheelPosition: 0.85 };

export function testTuning(kartId: number, overrides: Record<string, unknown> = {}) {
  const spec = bundledVehicleSpecCatalog().lookup(kartId, 7).spec as unknown as PhysicsParameterSpec;
  return { ...vehiclePhysicsParameters(spec, visual, 5), ...overrides };
}

/** The frozen item mode once the lobby area admits game types 2/4 in `vI`. */
export function admittedItemMode(team = false): { kind: string; team: boolean } | undefined {
  try {
    const mode = vI(team ? 4 : 2) as { kind: string; team: boolean };
    return mode.kind === "item" ? mode : undefined;
  } catch {
    return undefined;
  }
}

// The generated class is untyped JavaScript; tests reach into its runtime.
export type TestVehicle = any;

/** Drives one AL with its own frame clock. */
export class TestDriver {
  nowMs = 10_000;

  constructor(readonly vehicle: TestVehicle) {
    vehicle.reset(0, 0.3, 0, 0);
    vehicle.update(this.nowMs, neutralInput, flatTrack);
  }

  /** Advance `milliseconds` in frames of `frameMs`. */
  run(milliseconds: number, input: Readonly<TestDrivingInput> = throttleInput,
    frameMs = 16, onFrame?: (vehicle: TestVehicle) => void): void {
    let remaining = milliseconds;
    while (remaining > 0) {
      const step = Math.min(frameMs, remaining);
      remaining -= step;
      this.nowMs += step;
      this.vehicle.update(this.nowMs, input, flatTrack);
      onFrame?.(this.vehicle);
    }
  }

  get speedKmh(): number { return this.vehicle.displaySpeedKmh(); }
  get horizontalSpeed(): number {
    const velocity = this.vehicle.body.linearVelocity;
    return Math.hypot(velocity.x, velocity.z);
  }
}

/**
 * An item-race kart. Until `vI` admits game type 2 the test installs item
 * mode on an ordinary construction, exactly as the constructor does for it.
 */
export function createItemDriver(kartId = 373,
  tuningOverrides: Record<string, unknown> = {}): TestDriver {
  const mode = admittedItemMode();
  const vehicle = mode
    ? new AL(testTuning(kartId, tuningOverrides), dimensions, false, false, false, mode)
    : new AL(testTuning(kartId, tuningOverrides), dimensions);
  if (!mode) installVehicleItemMode(vehicle);
  return new TestDriver(vehicle);
}

export function createSpeedDriver(kartId = 373,
  tuningOverrides: Record<string, unknown> = {}): TestDriver {
  return new TestDriver(new AL(testTuning(kartId, tuningOverrides), dimensions));
}
