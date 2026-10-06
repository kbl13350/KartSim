export interface NitroVehicle {
  tryConsumeNormalBooster(input: unknown): boolean;
  cancelNitroSeamless(): void;
  queueNitroSeamless(): void;
}

export type NitroSeamlessMode = "off" | "auto" | "manual";

/** Queues a missed manual nitro press for the release's 200 ms grace window. */
export class NitroSeamlessQueue {
  mode: NitroSeamlessMode = "off";
  buffered = false;
  bufferedAtMs = 0;

  getMode(): NitroSeamlessMode { return this.mode; }

  setMode(mode: NitroSeamlessMode): void {
    this.mode = mode;
    if (mode !== "manual") this.cancel();
  }

  cancel(): void { this.buffered = false; }

  press(vehicle: NitroVehicle, input: unknown, timeMs: number): boolean {
    if (this.mode === "off") return false;
    if (!vehicle.tryConsumeNormalBooster(input) && this.mode === "manual") {
      this.buffered = true;
      this.bufferedAtMs = Math.trunc(timeMs) >>> 0;
    }
    return true;
  }

  update(vehicle: NitroVehicle, timeMs: number): void {
    if (this.mode === "off") {
      vehicle.cancelNitroSeamless();
      return;
    }
    if (this.mode === "auto") {
      vehicle.queueNitroSeamless();
      return;
    }
    if (!this.buffered) {
      vehicle.cancelNitroSeamless();
      return;
    }
    if (((Math.trunc(timeMs) >>> 0) - this.bufferedAtMs) >>> 0 > 200) {
      this.buffered = false;
      vehicle.cancelNitroSeamless();
      return;
    }
    vehicle.queueNitroSeamless();
  }
}
