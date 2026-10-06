/** The release camera's smoothing, special road effects and projection output. */

export interface CameraVector { x: number; y: number; z: number }
export interface CameraQuaternion { w: number; x: number; y: number; z: number }
export type CameraBasis = [CameraVector, CameraVector, CameraVector];
export interface CameraBody {
  right: CameraVector;
  forward: CameraVector;
  up: CameraVector;
  position: CameraVector;
  linearVelocity: CameraVector;
}
export interface CameraMotion {
  timestampMs: number;
  motionMode: number;
  body: CameraBody;
  wheelContact: boolean;
  motorcycleType: boolean;
  mrContact: boolean;
  hwContact: boolean;
  averageWheelHitNormal: CameraVector;
  effectiveReverseScalar: number;
  stateCode: number;
  action8: boolean;
  eventScaleSecondary: CameraVector;
  routeSurface?: string;
}
export interface CameraFrame {
  position: CameraVector;
  basis: CameraBasis;
  horizontalFovDegrees: number;
  near: number;
  far: number;
}
export interface HeightFollowing {
  followHeight(previous: number, target: number, elapsedMs: number,
    specialContact: boolean): number;
}
/** Keeps road height changes smooth until a special surface locks the camera to it. */
export class CameraHeightFollower implements HeightFollowing {
  heightFollowing = false;
  constructor(private readonly math: Pick<DriveCameraMath,
    "f32" | "floatWord" | "clampRatio" | "smoothScalar">) {}

  followHeight(previous: number, target: number, elapsedMs: number,
    specialContact: boolean): number {
    if (specialContact && this.heightFollowing) return target;
    const f32 = this.math.f32;
    const ratio = this.math.clampRatio(f32(f32(elapsedMs) / f32(100)));
    const height = this.math.smoothScalar(previous, target, ratio);
    if (specialContact && height >= f32(target * this.math.floatWord(1058642330)))
      this.heightFollowing = true;
    return height;
  }
}
export interface CameraTarget {
  position: { set(x: number, y: number, z: number): void };
  up: { set(x: number, y: number, z: number): void };
  matrixAutoUpdate: boolean;
  matrixWorldInverse: { set(...values: number[]): void };
  matrix: { copy(other: CameraTarget["matrixWorldInverse"]): { invert(): void } };
  matrixWorldNeedsUpdate: boolean;
  aspect: number;
  fov: number;
  near: number;
  far: number;
  updateProjectionMatrix(): void;
}

/** Numeric producers are the unchanged float32 operations in the format layer. */
export interface DriveCameraMath {
  f32(value: number): number;
  floatWord(word: number): number;
  bodyBasis(body: CameraBody): CameraBasis;
  clientVector(vector: CameraVector): CameraVector;
  column(basis: CameraBasis, index: number): CameraVector;
  setColumn(basis: CameraBasis, index: number, value: CameraVector): void;
  normalize(vector: CameraVector): CameraVector;
  cross(a: CameraVector, b: CameraVector): CameraVector;
  scale(vector: CameraVector, factor: number): CameraVector;
  add(a: CameraVector, b: CameraVector): CameraVector;
  alignMotorcycle(basis: CameraBasis, normal: CameraVector): CameraBasis;
  orientation(basis: CameraBasis): CameraQuaternion;
  orientationDot(a: CameraQuaternion, b: CameraQuaternion): number;
  scaleOrientation(value: CameraQuaternion, factor: number): CameraQuaternion;
  smoothOrientation(previous: CameraQuaternion, target: CameraQuaternion,
    ratio: number): CameraQuaternion;
  speed(vector: CameraVector): number;
  smoothScalar(previous: number, target: number, ratio: number): number;
  clampRatio(ratio: number): number;
  basisFromOrientation(value: CameraQuaternion): CameraBasis;
  tiltBasis(basis: CameraBasis, pitch: number): CameraBasis;
  outputVector(vector: CameraVector): CameraVector;
  clientDot(a: CameraVector, b: CameraVector): number;
  horizontalFov(verticalFov: number, aspect: number): number;
  resolutionFov(mode: number): { base: number; active: number; altActive: number; boost: number };
  parseRoadNumber(text: string): number;
  emptyVector(): CameraVector;
  baseFov: number;
  activeFov: number;
  altActiveFov: number;
  boostFov: number;
  specialFovLimit: number;
  p3528SpecialFovLimit: number;
  near: number;
  far: number;
}

export class DriveCameraController {
  readonly p3553ProcessState?: HeightFollowing;
  readonly math: DriveCameraMath;
  initialized = false;
  variant = 0;
  previousTimestamp = 0;
  smoothedOrientation: CameraQuaternion = { w: 0, x: 0, y: 0, z: 0 };
  smoothedSpeed = 0;
  smoothedPosition: CameraVector;
  smoothedFov = 0;
  specialBack = 0;
  specialFov = 0;
  specialPitch = 0;
  motorcycleAirAnchor = 0;
  motorcycleContactAnchor = 0;
  baseFov: number;
  activeFov: number;
  altActiveFov: number;
  boostFov: number;
  specialFovLimit: number;

  constructor(processState: HeightFollowing | undefined, math: DriveCameraMath) {
    this.p3553ProcessState = processState;
    this.math = math;
    this.smoothedPosition = math.emptyVector();
    this.baseFov = math.baseFov;
    this.activeFov = math.activeFov;
    this.altActiveFov = math.altActiveFov;
    this.boostFov = math.boostFov;
    this.specialFovLimit = math.specialFovLimit;
  }

  configureP3528ResolutionMode(mode = 0): void {
    const fields = this.math.resolutionFov(mode);
    this.baseFov = fields.base;
    this.activeFov = fields.active;
    this.altActiveFov = fields.altActive;
    this.boostFov = fields.boost;
    this.specialFovLimit = this.math.p3528SpecialFovLimit;
  }

  reset(variant = 0): void {
    this.initialized = false;
    this.variant = Math.trunc(variant) >>> 0;
  }

  update(input: CameraMotion): CameraFrame {
    const m = this.math;
    const f32 = m.f32;
    const word = m.floatWord;
    const now = Math.trunc(input.timestampMs) >>> 0;
    const elapsed = this.initialized ? (now - this.previousTimestamp) >>> 0 : 0;
    this.previousTimestamp = now;
    let orientationDelay = input.motionMode === 2 || input.motionMode === 3
      ? f32(200) : f32(400);
    let basis = m.bodyBasis(input.body);
    if (!input.wheelContact && input.motorcycleType) {
      const airDuration = (now - this.motorcycleContactAnchor) >>> 0;
      if (airDuration < 700)
        orientationDelay = f32(f32(f32(700 - airDuration) * f32(0.5)) + f32(400));
      this.motorcycleAirAnchor = now;
    }
    if (input.motorcycleType && !input.mrContact && !input.hwContact && input.wheelContact) {
      const contactDuration = (now - this.motorcycleAirAnchor) >>> 0;
      if (contactDuration < 700)
        orientationDelay = f32(f32(f32(700 - contactDuration) * f32(0.5)) + f32(400));
      this.motorcycleContactAnchor = now;
      basis = m.alignMotorcycle(basis, m.clientVector(input.averageWheelHitNormal));
    }
    if (!input.mrContact && !input.hwContact &&
        word(1045220557) > basis[2].z) {
      const up = m.column(basis, 2);
      up.z = word(1045220557);
      m.normalize(up);
      m.setColumn(basis, 0, m.cross(up, m.scale(m.column(basis, 1), f32(-1))));
      m.setColumn(basis, 2, up);
    }
    const specialContact = input.mrContact || input.hwContact;
    if (specialContact) {
      if (input.effectiveReverseScalar > 0) {
        this.specialPitch = f32(this.specialPitch + f32(0.1));
        if (this.specialPitch > f32(10)) this.specialPitch = f32(10);
      } else {
        if (f32(25) > this.specialBack)
          this.specialBack = f32(this.specialBack + f32(0.25));
        if (this.specialPitch > f32(-3))
          this.specialPitch = f32(this.specialPitch + word(3170222735));
        if (this.specialFovLimit > this.specialFov)
          this.specialFov = f32(this.specialFov +
            f32(this.specialFovLimit / f32(this.specialFovLimit * f32(4))));
      }
    }
    this.consumeRouteSurface(input.routeSurface, specialContact);

    const targetOrientation = m.orientation(basis);
    const speed = m.speed(m.clientVector(input.body.linearVelocity));
    if (!this.initialized) {
      this.smoothedOrientation = targetOrientation;
      this.smoothedSpeed = speed;
      this.smoothedFov = this.baseFov;
    } else {
      if (m.orientationDot(this.smoothedOrientation, targetOrientation) < 0)
        this.smoothedOrientation = m.scaleOrientation(this.smoothedOrientation, f32(-1));
      const ratio = m.clampRatio(f32(f32(elapsed) / orientationDelay));
      this.smoothedOrientation = m.smoothOrientation(this.smoothedOrientation,
        targetOrientation, ratio);
      const speedDelay = this.smoothedSpeed > speed ? f32(100) : f32(10000);
      this.smoothedSpeed = m.smoothScalar(this.smoothedSpeed, speed,
        m.clampRatio(f32(f32(elapsed) / speedDelay)));
      const actionMotion = input.stateCode >= 1 && input.stateCode <= 11;
      const boostMotion = input.stateCode >= 13 && input.stateCode <= 16;
      let targetFov: number, fovDelay: number;
      if (input.motionMode === 2 || input.motionMode === 3) {
        targetFov = actionMotion || input.action8 ? this.altActiveFov : this.activeFov;
        fovDelay = actionMotion || input.action8 ? 900 : 500;
      } else if (actionMotion || input.action8) {
        targetFov = this.activeFov;
        fovDelay = 1000;
      } else if (boostMotion) {
        targetFov = this.boostFov;
        fovDelay = 300;
      } else {
        targetFov = this.baseFov;
        fovDelay = 1500;
      }
      this.smoothedFov = m.smoothScalar(this.smoothedFov, targetFov,
        m.clampRatio(f32(f32(elapsed) / f32(fovDelay))));
    }

    const eventScale = input.eventScaleSecondary;
    let pitch = f32(f32(0.25) - f32(word(1008981770) * this.specialBack));
    pitch = f32(pitch + f32(f32(Math.max(this.smoothedSpeed, 0)) / f32(400)));
    pitch = f32(pitch + f32(f32(f32(1) - f32(eventScale.z)) * f32(0.08)));
    const cameraBasis = m.basisFromOrientation(this.smoothedOrientation);
    const tiltedBasis = m.tiltBasis(cameraBasis, pitch);
    let distance = this.variant === 0 ? f32(5.5) : f32(4);
    let height = this.variant === 0 ? f32(3) : word(1074580685);
    distance = f32(distance + f32(f32(f32(eventScale.z) - f32(1)) * word(1078774989)));
    height = f32(height + f32(f32(f32(eventScale.z) - f32(1)) * word(1070386381)));
    let backward = f32(distance + f32(this.smoothedSpeed * word(1014350479)));
    backward = f32(backward + f32(this.smoothedSpeed * word(1022739087)));
    if (distance > backward) backward = distance;
    let upward = f32(f32(height * f32(f32(this.specialPitch) * f32(0.05))) + height);
    upward = f32(upward + f32(this.smoothedSpeed / f32(60)));
    const backAxis = { x: cameraBasis[0].y, y: cameraBasis[1].y, z: cameraBasis[2].y };
    const upAxis = { x: cameraBasis[0].z, y: cameraBasis[1].z, z: cameraBasis[2].z };
    const targetPosition = m.add(m.add(m.clientVector(input.body.position),
      m.scale(backAxis, backward)), m.scale(upAxis, upward));
    if (!this.initialized) this.smoothedPosition = targetPosition;
    else {
      const ratio = m.clampRatio(f32(f32(elapsed) / f32(100)));
      this.smoothedPosition = {
        x: targetPosition.x, y: targetPosition.y,
        z: this.p3553ProcessState
          ? this.p3553ProcessState.followHeight(this.smoothedPosition.z,
            targetPosition.z, elapsed, specialContact)
          : m.smoothScalar(this.smoothedPosition.z, targetPosition.z, ratio),
      };
    }
    this.initialized = true;
    const fov = f32(f32(this.smoothedFov + this.specialFov) -
      f32(f32(f32(1) - Math.min(f32(eventScale.y), f32(1))) * f32(8)));
    return {
      position: m.outputVector(this.smoothedPosition),
      basis: [m.outputVector(m.column(tiltedBasis, 0)),
        m.outputVector(m.column(tiltedBasis, 1)),
        m.outputVector(m.column(tiltedBasis, 2))],
      horizontalFovDegrees: fov,
      near: m.near, far: m.far,
    };
  }

  consumeRouteSurface(surface: string | undefined, specialContact: boolean): void {
    if (surface === undefined) return;
    const f32 = this.math.f32;
    const word = this.math.floatWord;
    if (surface.slice(0, 7) === "zoomOut") {
      const target = f32(this.math.parseRoadNumber(surface.slice(7, 9)));
      if (target > this.specialFov)
        this.specialFov = f32(this.specialFov +
          f32(target / f32(this.math.parseRoadNumber(surface.slice(10, 13)))));
    } else if (surface.slice(0, 6) === "zoomIn") {
      const target = f32(this.math.parseRoadNumber(surface.slice(6, 8)));
      if (this.specialFov > f32(-target))
        this.specialFov = f32(this.specialFov -
          f32(target / f32(this.math.parseRoadNumber(surface.slice(9, 12)))));
    }
    if (surface.slice(0, 4) === "zoom" || this.p3553ProcessState && specialContact)
      return;
    if (this.specialBack > 0) this.specialBack = f32(this.specialBack - f32(0.125));
    if (this.specialFov > 0) {
      this.specialFov = f32(this.specialFov - f32(0.125));
      if (this.specialFov < 0) this.specialFov = 0;
    } else if (this.specialFov < 0) {
      this.specialFov = f32(this.specialFov + f32(0.125));
      if (this.specialFov > 0) this.specialFov = 0;
    }
    if (this.specialPitch < 0)
      this.specialPitch = f32(this.specialPitch + word(1014350479));
    else if (this.specialPitch > 0)
      this.specialPitch = f32(this.specialPitch - word(1014350479));
  }

  apply(camera: CameraTarget, frame: CameraFrame): void {
    const m = this.math;
    camera.position.set(frame.position.x, frame.position.y, frame.position.z);
    camera.up.set(frame.basis[2].x, frame.basis[2].y, frame.basis[2].z);
    const [right, forward, up] = frame.basis;
    camera.matrixAutoUpdate = false;
    camera.matrixWorldInverse.set(
      -right.x, -right.y, -right.z, m.clientDot(right, frame.position),
      up.x, up.y, up.z, -m.clientDot(up, frame.position),
      forward.x, forward.y, forward.z, -m.clientDot(forward, frame.position),
      0, 0, 0, 1,
    );
    camera.matrix.copy(camera.matrixWorldInverse).invert();
    camera.matrixWorldNeedsUpdate = true;
    camera.fov = m.horizontalFov(frame.horizontalFovDegrees, camera.aspect);
    camera.near = frame.near;
    camera.far = frame.far;
    camera.updateProjectionMatrix();
  }
}
