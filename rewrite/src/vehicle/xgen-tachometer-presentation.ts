import { advanceRoadBlink, collectPanelNames, tachometerSpeedLayer } from "./v1-tachometer-presentation";

const releaseBackgroundMs = 434;

export interface XGenPresentationOps {
  attribute(node: any, name: string): string | undefined;
  initialGauge(binding: any): any;
  setGaugeTarget(binding: any, state: any, ratio: number): any;
  beginGaugeDrain(binding: any, state: any): any;
  advanceGauge(binding: any, state: any, nowMs: number): any;
  pulseAlpha(nowMs: number): number;
}

export interface XGenFrame {
  frameTickMs: number;
  sourceTickMs: number;
  stateCode: number;
  speed: { displaySpeed: number; layerThreshold: number };
  gauges: { mainRatio: number; teamBooster: boolean; teamRatio: number };
  dualBoosterState: number;
  dualBoosterMode: number;
  draftOn?: boolean;
  teamSettledAtMs?: number;
}

/** XGen tachometer presentation and animation state. */
export class XGenTachometerPresentation {
  bindings: any;
  names = new Set<string>();
  visible = new Map<string, boolean>();
  individual: any;
  team: any;
  teamSettledAtPrev = 0;
  road: { anchorMs: number; visibleLayer?: string } = { anchorMs: 0, visibleLayer: "blinkRoad1" };
  backgroundActiveAtMs = 0;
  backgroundReleaseAtMs = 0;
  barPulseDeadlineMs = 0;
  barPulsePending = false;
  manualBoostAlarm = false;
  alarmBlinkAtMs = 0;

  constructor(definition: { type: string; xGenGauges?: any; root: any },
    private readonly ops: XGenPresentationOps) {
    if (definition.type !== "XGenTacho" || !definition.xGenGauges)
      throw new Error(`${definition.type} 不能使用 P3528 XGen presentation owner。`);
    this.bindings = definition.xGenGauges;
    this.individual = ops.initialGauge(this.bindings.individual);
    this.team = ops.initialGauge(this.bindings.team);
    collectPanelNames(definition.root, this.names, this.visible, ops.attribute);
  }

  startMainGaugeDrain(): void {
    const wasInactive = !this.individual.active;
    this.individual = this.ops.setGaugeTarget(this.bindings.individual, this.individual, 1);
    this.individual = this.ops.beginGaugeDrain(this.bindings.individual, this.individual);
    this.barPulsePending ||= wasInactive;
  }

  setManualBoostAlarm(enabled: boolean): void {
    this.manualBoostAlarm = enabled;
  }

  update(frame: XGenFrame) {
    const visibility: Record<string, boolean> = {};
    const play: { name: string; durationMs: number; sourceTickMs: number }[] = [];
    if (this.alarmBlinkAtMs === 0) this.alarmBlinkAtMs = frame.frameTickMs;
    this.updateBackground(frame, visibility, play);
    this.updateManualAlarm(frame.dualBoosterState, visibility);
    this.updateDualBooster(frame, visibility, play);
    this.updateSpeedAndRoad(frame, visibility);
    const barAlpha = this.updateGauges(frame);
    Object.assign(visibility, {
      indiBoostGauge: this.individual.gaugeVisible,
      teamBoostGauge: this.team.gaugeVisible,
      indiBoostFullFrame: this.individual.fullFrameVisible,
      teamBoostFullFrame: this.team.fullFrameVisible,
    });
    for (const [name, visible] of Object.entries(visibility)) this.visible.set(name, visible);
    const speed = tachometerSpeedLayer("XGenTacho", frame.speed.displaySpeed, frame.speed.layerThreshold);
    return {
      visibility,
      text: { [speed.visibleLayer]: speed.text },
      individual: this.individual,
      team: this.team,
      barAlpha,
      n2oOn: [3, 4, 5, 10].includes(frame.stateCode),
      draftOn: frame.draftOn === true,
      teamBooster: frame.gauges.teamBooster,
      play,
    };
  }

  updateBackground(frame: XGenFrame, visibility: Record<string, boolean>, play: any[]): void {
    const highSpeed = frame.speed.displaySpeed >= frame.speed.layerThreshold;
    if (highSpeed && this.backgroundActiveAtMs === 0)
      this.backgroundActiveAtMs = frame.frameTickMs;
    if (this.backgroundActiveAtMs !== 0) {
      if (highSpeed) this.showHighSpeedBackground(frame.sourceTickMs, visibility, play);
      else this.showReleaseBackground(frame, visibility, play);
      this.updateManualAlarmBlink(frame.frameTickMs, visibility);
    }
    for (const name of ["xgen_bg1", "xgen_bg2", "xgen_bg3"])
      this.setVisible(name, this.isVisible(name), visibility);
  }

  updateManualAlarm(state: number, visibility: Record<string, boolean>): void {
    if (this.manualBoostAlarm)
      this.setVisible("dualBoostManualAlarm", state === 7 || state === 8, visibility);
    for (const name of ["dualBoostManualAlarm", "BoostAlarmPanel1", "BoostAlarmPanel2"])
      this.setVisible(name, this.isVisible(name), visibility);
  }

  updateManualAlarmBlink(nowMs: number, visibility: Record<string, boolean>): void {
    if (!this.manualBoostAlarm || !this.isVisible("dualBoostManualAlarm") ||
      ((nowMs - this.alarmBlinkAtMs) >>> 0) <= this.bindings.alarmBlinkTimeMs) return;
    const firstVisible = this.isVisible("BoostAlarmPanel1");
    this.setVisible("BoostAlarmPanel1", !firstVisible, visibility);
    this.setVisible("BoostAlarmPanel2", firstVisible, visibility);
    this.alarmBlinkAtMs = nowMs;
  }

  showHighSpeedBackground(sourceTickMs: number, visibility: Record<string, boolean>, play: any[]): void {
    this.setVisible("xgen_bg1", false, visibility);
    this.setVisible("xgen_bg3", false, visibility);
    this.showAndPlay("xgen_bg2", sourceTickMs, visibility, play);
  }

  showReleaseBackground(frame: XGenFrame, visibility: Record<string, boolean>, play: any[]): void {
    this.setVisible("xgen_bg2", false, visibility);
    if (!this.isVisible("xgen_bg3") && !this.isVisible("xgen_bg1")) {
      this.showAndPlay("xgen_bg3", frame.sourceTickMs, visibility, play);
      this.backgroundReleaseAtMs = frame.frameTickMs;
    }
    if (((frame.frameTickMs - this.backgroundReleaseAtMs) >>> 0) > releaseBackgroundMs) {
      this.setVisible("xgen_bg3", false, visibility);
      this.setVisible("xgen_bg1", true, visibility);
      this.backgroundReleaseAtMs = 0;
      this.backgroundActiveAtMs = 0;
    }
  }

  updateDualBooster(frame: XGenFrame, visibility: Record<string, boolean>, play: any[]): void {
    const usingDual = frame.stateCode === 10;
    this.setPlayVisibility("dualBoostReady", frame.dualBoosterMode === 1,
      frame.sourceTickMs, visibility, play);
    this.setPlayVisibility("dualboostUse", usingDual, frame.sourceTickMs, visibility, play);
    if (usingDual)
      this.setPlayVisibility("dualBoostReady", false, frame.sourceTickMs, visibility, play);
  }

  updateSpeedAndRoad(frame: XGenFrame, visibility: Record<string, boolean>): void {
    const speed = tachometerSpeedLayer("XGenTacho", frame.speed.displaySpeed, frame.speed.layerThreshold);
    visibility.kmh = speed.visibleLayer === "kmh";
    visibility.kmh2 = speed.visibleLayer === "kmh2";
    if (this.road.anchorMs === 0) this.road = { anchorMs: frame.frameTickMs };
    this.road = advanceRoadBlink(this.road, frame.frameTickMs, frame.speed.displaySpeed);
    if (this.road.visibleLayer !== undefined)
      for (const name of ["blinkRoad1", "blinkRoad2", "blinkRoad3"])
        visibility[name] = name === this.road.visibleLayer;
  }

  updateGauges(frame: XGenFrame): number {
    if (!this.individual.active) {
      this.individual = this.ops.setGaugeTarget(this.bindings.individual, this.individual,
        frame.gauges.mainRatio);
      this.barPulsePending = true;
    }
    this.individual = this.ops.advanceGauge(this.bindings.individual, this.individual,
      frame.frameTickMs);
    const settledAt = (frame.teamSettledAtMs ?? 0) >>> 0;
    if (settledAt === 0 && this.teamSettledAtPrev !== 0) {
      this.teamSettledAtPrev = 0;
      this.team = this.ops.initialGauge(this.bindings.team);
    }
    if (settledAt !== 0 && settledAt !== this.teamSettledAtPrev) {
      this.teamSettledAtPrev = settledAt;
      this.team = this.ops.setGaugeTarget(this.bindings.team, { ...this.team, active: false }, 1);
      this.team = this.ops.beginGaugeDrain(this.bindings.team, this.team);
    }
    const teamBooster = frame.gauges.teamBooster;
    const teamRatio = frame.gauges.teamRatio;
    if (this.team.active) {
      this.team = this.ops.advanceGauge(this.bindings.team, this.team, frame.frameTickMs);
    } else if (teamBooster) {
      this.team = {
        ...this.ops.setGaugeTarget(this.bindings.team, this.team, teamRatio),
        gaugeVisible: true,
        fullFrameVisible: teamRatio >= 1,
      };
    } else if (this.team.gaugeVisible || this.team.fullFrameVisible) {
      this.team = {
        ...this.ops.setGaugeTarget(this.bindings.team, { ...this.team, active: false }, 0),
        gaugeVisible: this.bindings.team.gaugeInitiallyVisible,
        fullFrameVisible: this.bindings.team.fullFrame.initiallyVisible,
      };
    }
    if (this.barPulsePending) {
      this.barPulseDeadlineMs = (frame.frameTickMs + 1000) >>> 0;
      this.barPulsePending = false;
    }
    if (this.barPulseDeadlineMs === 0 || frame.frameTickMs >= this.barPulseDeadlineMs) {
      this.barPulseDeadlineMs = 0;
      return 255;
    }
    return this.ops.pulseAlpha(frame.frameTickMs);
  }

  setPlayVisibility(name: string, visible: boolean, sourceTickMs: number,
    visibility: Record<string, boolean>, play: any[]): void {
    if (visible) this.showAndPlay(name, sourceTickMs, visibility, play);
    else this.setVisible(name, false, visibility);
  }

  showAndPlay(name: string, sourceTickMs: number, visibility: Record<string, boolean>, play: any[]): void {
    const wasVisible = this.isVisible(name);
    this.setVisible(name, true, visibility);
    if (!wasVisible && this.names.has(name))
      play.push({ name, durationMs: 0, sourceTickMs });
  }

  setVisible(name: string, visible: boolean, visibility: Record<string, boolean>): void {
    if (this.names.has(name)) {
      this.visible.set(name, visible);
      visibility[name] = visible;
    }
  }

  isVisible(name: string): boolean {
    return this.visible.get(name) ?? false;
  }
}
