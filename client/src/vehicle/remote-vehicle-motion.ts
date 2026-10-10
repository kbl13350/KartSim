export interface VehicleMotionSource {
  forwardSpeed: number;
  rawSteer: number;
  tireTransient: number;
  boosterState: number;
  instantAccelerationActive: boolean;
  motorcycle: number;
  visualScaleMode: number;
  collisionStrength: number;
  landingTrigger: boolean;
  collisionHit: boolean;
}

export interface RemoteVehicleMotionFrame extends Omit<VehicleMotionSource, "landingTrigger" | "collisionHit"> {
  frontLamp: boolean;
  rearLamp: boolean;
  landingSequence: number;
  collisionSequence: number;
  animation?: unknown;
}

/** Unsigned sequence comparison used for one-shot effects over a wrapped counter. */
export function isNewMotionSequence(incoming: number, current: number): boolean {
  const difference = (incoming - current) >>> 0;
  return difference > 0 && difference < 2147483648;
}

/** Captures local lamp and collision edge events for remote playback. */
export class VehicleMotionSender {
  landing = 0;
  collision = 0;
  strength = 0;

  capture(source: VehicleMotionSource,
    lamps: { forward: number; reverse: number }, animation?: unknown): RemoteVehicleMotionFrame {
    if (source.landingTrigger) this.landing = (this.landing + 1) >>> 0;
    if (source.collisionHit) {
      this.collision = (this.collision + 1) >>> 0;
      this.strength = source.collisionStrength;
    }
    return {
      forwardSpeed: source.forwardSpeed,
      rawSteer: source.rawSteer,
      tireTransient: source.tireTransient,
      boosterState: source.boosterState,
      instantAccelerationActive: source.instantAccelerationActive,
      motorcycle: source.motorcycle,
      visualScaleMode: source.visualScaleMode,
      collisionStrength: this.strength,
      frontLamp: lamps.forward !== 0,
      rearLamp: lamps.reverse !== 0,
      landingSequence: this.landing,
      collisionSequence: this.collision,
      ...(animation ? { animation } : {}),
    };
  }
}

/** Replays the latest remote motion while consuming one-shot triggers once. */
export class VehicleMotionReceiver {
  state: RemoteVehicleMotionFrame | undefined;
  landing = 0;
  collision = 0;
  landingPending = false;
  collisionPending = false;

  receive(frame: RemoteVehicleMotionFrame): void {
    if (isNewMotionSequence(frame.landingSequence, this.landing)) {
      this.landingPending = true;
      this.landing = frame.landingSequence;
    }
    if (isNewMotionSequence(frame.collisionSequence, this.collision)) {
      this.collisionPending = true;
      this.collision = frame.collisionSequence;
    }
    this.state = { ...frame };
  }

  consume() {
    const frame = this.state;
    if (!frame) return;
    const result = {
      frontLamp: frame.frontLamp,
      rearLamp: frame.rearLamp,
      animation: frame.animation,
      motion: {
        forwardSpeed: frame.forwardSpeed,
        rawSteer: frame.rawSteer,
        tireTransient: frame.tireTransient,
        boosterState: frame.boosterState,
        instantAccelerationActive: frame.instantAccelerationActive,
        motorcycle: frame.motorcycle,
        visualScaleMode: frame.visualScaleMode,
        collisionStrength: frame.collisionStrength,
        landingTrigger: this.landingPending,
        collisionHit: this.collisionPending,
      },
    };
    this.landingPending = false;
    this.collisionPending = false;
    return result;
  }
}
