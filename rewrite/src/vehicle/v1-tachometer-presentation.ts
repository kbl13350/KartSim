const float32 = Math.fround;
const roadLayers = ["blinkRoad1", "blinkRoad2", "blinkRoad3"];
const teamGaugeLayers = ["teamBoost", "boostGauegeBg_Team", "teamBoostGauge", "teamBoostFullFrame"] as const;

const teamGaugeVisibility = {
  hidden: { teamBoost: false, boostGauegeBg_Team: false, teamBoostGauge: false, teamBoostFullFrame: false },
  present: { teamBoost: true, boostGauegeBg_Team: true, teamBoostGauge: true, teamBoostFullFrame: false },
  full: { teamBoost: true, boostGauegeBg_Team: true, teamBoostGauge: true, teamBoostFullFrame: false },
};

interface NamedNode { children: NamedNode[]; [key: string]: unknown }
interface NamedBinding { name: string; node: NamedNode }
interface TachometerDefinition {
  type: "V1GenTacho" | "XunGenTacho" | string;
  root: NamedNode;
  play1SPanels: NamedBinding[];
  blinkButtons: NamedBinding[];
  featureBindings: {
    boostFeatures?: boolean;
    collisionFeatures?: boolean;
    exceedFeatures?: boolean;
  };
}

export interface TachometerPresentationOps {
  attribute(node: NamedNode, name: string): string | undefined;
  makeCharger(seed: unknown): any;
  makeGaugePulse(): any;
  updateCharger(state: any, frameTickMs: number, wallClockMs: number,
    source: any, bindings: { chargerBg: boolean; charger: boolean; charger2: boolean }):
    { state: any; commands: any[] };
  chargerVisibility(previous: Record<string, boolean>, commands: any[]): Record<string, boolean>;
  updateGaugePulse(state: any, frameTickMs: number, mainRatio: number, instantRatio: number,
    type: string): { state: any; alpha: number };
  updateResettingBlink(binding: NamedBinding, state: any, frameTickMs: number, visible: boolean): any;
  frameAlpha(elapsedMs: number): number;
}

interface CollisionSource {
  crash: boolean;
  charging: boolean;
  timerEnabled: boolean;
  collisionAnchorMs: number;
  refillAnchorMs: number;
  cooldownMs: number;
  playWarnBgVisible?: boolean;
  playCrashBgVisible?: boolean;
  playCrashBgInsideVisible?: boolean;
}

export interface TachometerPresentationFrame {
  frameTickMs: number;
  wallClockMs: number;
  sourceTickMs: number;
  stateCode: number;
  speed: { displaySpeed: number; layerThreshold: number };
  gauges: {
    mainRatio: number;
    instantRatio: number;
    teamBooster: boolean;
    teamRatio: number;
    wallCompensationRatio?: number;
    wallCompensationEventId?: number;
    instantInterpolationMs?: number;
  };
  collision: Pick<CollisionSource, "crash" | "charging" | "timerEnabled" |
    "collisionAnchorMs" | "refillAnchorMs" | "cooldownMs">;
  exceed: {
    active: boolean; usable: boolean; full: boolean;
    usableThresholdRatio?: number;
  };
  charger: { capacity: number; count: number; [key: string]: unknown };
  draftOn?: boolean;
  boosterUnlimited?: boolean;
  teamSettledAtMs?: number;
}

interface CollisionState {
  refillDeadlineMs: number;
  collisionDeadlineMs: number;
  cooldownDeadlineMs: number;
}
interface ExceedState {
  active: boolean;
  usable: boolean;
  mode: number;
  fullSessionActive: boolean;
}

function checkedU32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 4294967295)
    throw new Error(`P3528 ${label}=${value} 无效。`);
}

export function tachometerSpeedLayer(type: string, speed: number, threshold: number) {
  if (!Number.isFinite(speed) || speed < 0)
    throw new Error(`P3528 displaySpeed=${speed} 无效。`);
  if (!Number.isFinite(threshold) || threshold < 0)
    throw new Error(`P3528 autoChargeLowSpeed=${threshold} 无效。`);
  const visibleLayer = type === "XunGenTacho" && speed >= 300 ? "kmh3"
    : speed >= threshold ? "kmh2" : "kmh";
  return { text: Math.trunc(speed).toString(), visibleLayer };
}

export function advanceRoadBlink(state: { anchorMs: number; visibleLayer?: string },
  nowMs: number, speed: number): { anchorMs: number; visibleLayer?: string } {
  checkedU32(state.anchorMs, "road blink anchor");
  checkedU32(nowMs, "road blink now");
  if (!Number.isFinite(speed) || speed < 0)
    throw new Error(`P3528 displaySpeed=${speed} 无效。`);
  const kmh = float32(speed);
  if (kmh < 1) return { ...state, visibleLayer: "blinkRoad1" };
  const interval = kmh > 1 && kmh < 100 ? 1000
    : kmh >= 100 && kmh < 150 ? 700
      : kmh >= 150 && kmh < 200 ? 500
        : kmh >= 200 && kmh < 250 ? 300
          : kmh > 250 ? 200 : 0;
  if (interval === 0 || ((state.anchorMs + interval) >>> 0) >= nowMs) return state;
  return {
    anchorMs: nowMs,
    visibleLayer: state.visibleLayer === "blinkRoad1" ? "blinkRoad2"
      : state.visibleLayer === "blinkRoad2" ? "blinkRoad3"
        : state.visibleLayer === "blinkRoad3" ? "blinkRoad1" : undefined,
  };
}

export function collisionPresentation(state: CollisionState, nowMs: number, source: CollisionSource) {
  checkedU32(nowMs, "collision presentation now");
  checkedU32(source.collisionAnchorMs, "collision anchor");
  checkedU32(source.refillAnchorMs, "refill anchor");
  checkedU32(source.cooldownMs, "collision cooldown");
  const now = nowMs >>> 0;
  let refill = state.refillDeadlineMs;
  let collision = state.collisionDeadlineMs;
  let cooldown = state.cooldownDeadlineMs;
  if (source.charging && now >= collision)
    collision = (source.collisionAnchorMs + 500) >>> 0;
  if (source.timerEnabled) {
    if (now >= refill) refill = (source.refillAnchorMs + 500) >>> 0;
    if (now >= cooldown) cooldown = (source.refillAnchorMs + source.cooldownMs) >>> 0;
  }
  const refilling = now < refill;
  const colliding = now < collision;
  const cooling = now < cooldown;
  const canCharge = !refilling && !cooling;
  const play: string[] = [];
  if (colliding && source.playWarnBgVisible === false) play.push("playWarnBg");
  if (cooling && source.playCrashBgVisible === false) play.push("playCrashBg");
  if (cooling && source.playCrashBgInsideVisible === false) play.push("playCrashBg_Inside");
  return {
    state: { refillDeadlineMs: refill, collisionDeadlineMs: collision, cooldownDeadlineMs: cooldown },
    visibility: {
      temp_bg1: canCharge && !source.crash,
      chargeable: canCharge && source.crash,
      charging: refilling,
      playWarnBg: colliding,
      playCrashBg: cooling,
      playCrashBg_Inside: cooling,
      resetting: !refilling && cooling,
    },
    play,
  };
}

export function initialFeatureVisibility(features: TachometerDefinition["featureBindings"] &
  { hasAltBackgroundPair?: boolean }): Record<string, boolean> {
  return {
    ...(features.boostFeatures !== undefined ? { boostFeatures: features.boostFeatures } : {}),
    ...(features.collisionFeatures !== undefined ? { collisionFeatures: features.collisionFeatures } : {}),
    ...(features.exceedFeatures !== undefined ? { exceedFeatures: features.exceedFeatures } : {}),
    ...(features.boostFeatures !== true ? {
      n2o: false, n2o_always: true, itemIcon: true,
      ...(features.hasAltBackgroundPair ? { v1gen_bg1_alt: true } : {}),
    } : {}),
  };
}

export function exceedPresentation(type: string, previous: ExceedState,
  source: { active: boolean; usable: boolean; displayFull: boolean; full: boolean; physicalUsable: boolean }) {
  const mode = source.active ? 2 : source.usable ? 1 : 0;
  const wasFull = previous.fullSessionActive;
  const stopFull = wasFull && ((source.active && !source.full) || !source.physicalUsable);
  const full = wasFull ? !stopFull : source.displayFull;
  const play: string[] = [];
  if (full && !wasFull) play.push("playFull");
  if (type === "V1GenTacho" && source.active && !previous.active) play.push("playUsing");
  return {
    state: { active: source.active, usable: source.usable, mode, fullSessionActive: full },
    visibility: {
      idling: !source.usable,
      usable: source.usable,
      instAccelGauge: mode === 0,
      instAccelGaugeUsable: mode === 1,
      instAccelGaugeOn: mode === 2,
      playFull: full,
      ...(type === "V1GenTacho" ? { playUsing: source.active } : {}),
    },
    play,
  };
}

export function checkedGaugeRatio(value: number): number {
  if (!Number.isFinite(value))
    throw new Error(`P3528 instant gauge ratio=${value} 无效。`);
  return Math.max(0, Math.min(1, value));
}

export function collectPanelNames(node: NamedNode, names: Set<string>, visible: Map<string, boolean>,
  attribute: TachometerPresentationOps["attribute"]): void {
  const name = attribute(node, "name");
  if (name) {
    names.add(name);
    visible.set(name, attribute(node, "visible") !== "false");
  }
  for (const child of node.children) collectPanelNames(child, names, visible, attribute);
}

/** V1/Xun tachometer state owner, separate from texture layout and rendering. */
export class V1TachometerPresentation {
  road: { anchorMs: number; visibleLayer?: string } = { anchorMs: 0 };
  collision: CollisionState = { refillDeadlineMs: 0, collisionDeadlineMs: 0, cooldownDeadlineMs: 0 };
  exceed: ExceedState = { active: false, usable: false, mode: 0, fullSessionActive: false };
  charger: any;
  gaugePulse: any;
  chargerVisibility: Record<string, boolean> = {};
  mainFullActive = false;
  mainFullAnchorMs = 0;
  instantGaugeInitialized = false;
  instantGaugeDisplayed = 0;
  instantGaugeAnchor = 0;
  instantGaugeTarget = 0;
  instantGaugeElapsedMs = 0;
  instantGaugeAnimating = false;
  instantGaugeLastMs = 0;
  instantGaugeWallObserved = 0;
  instantGaugeWallEventObserved = 0;
  resetting: any;
  names = new Set<string>();
  visible = new Map<string, boolean>();
  play1SPanelNames: Set<string>;
  featureVisibility: Record<string, boolean>;
  resettingBinding: NamedBinding | undefined;
  hasBlinkRoadLayers: boolean;
  chargerBindings: { chargerBg: boolean; charger: boolean; charger2: boolean };
  collisionSource: CollisionSource = {
    crash: false, charging: false, timerEnabled: false,
    collisionAnchorMs: 0, refillAnchorMs: 0, cooldownMs: 0,
    playWarnBgVisible: undefined, playCrashBgVisible: undefined,
    playCrashBgInsideVisible: undefined,
  };
  exceedSource = { active: false, usable: false, displayFull: false, full: false, physicalUsable: false };
  emptyBlinkButtons = new Map<NamedNode, any>();
  resettingBlinkButtons = new Map<NamedNode, any>();

  constructor(public definition: TachometerDefinition, seed: unknown, private readonly ops: TachometerPresentationOps) {
    this.gaugePulse = ops.makeGaugePulse();
    if (definition.type !== "V1GenTacho" && definition.type !== "XunGenTacho")
      throw new Error(`${definition.type} 不能使用 P3528 V1/Xun presentation owner。`);
    collectPanelNames(definition.root, this.names, this.visible, ops.attribute);
    this.play1SPanelNames = new Set(definition.play1SPanels.map(panel => panel.name));
    this.resettingBinding = definition.blinkButtons.find(button => button.name === "resetting");
    const features = initialFeatureVisibility({ ...definition.featureBindings,
      hasAltBackgroundPair: this.names.has("v1gen_bg1_alt") && this.names.has("v1gen_bg2_alt") });
    this.featureVisibility = this.names.has("n2o_always")
      ? { ...features, n2o_always: false } : features;
    this.hasBlinkRoadLayers = roadLayers.every(name => this.names.has(name));
    this.chargerBindings = {
      chargerBg: this.names.has("charger_bg"),
      charger: this.names.has("charger"),
      charger2: this.names.has("charger2"),
    };
    this.charger = ops.makeCharger(seed);
  }

  startMainGaugeDrain(): void {
    this.mainFullActive = true;
    this.mainFullAnchorMs = 0;
  }

  update(frame: TachometerPresentationFrame) {
    const type = this.definition.type;
    const speed = tachometerSpeedLayer(type, frame.speed.displaySpeed, frame.speed.layerThreshold);
    const visibility: Record<string, boolean> = { ...this.featureVisibility };
    visibility.kmh = speed.visibleLayer === "kmh";
    visibility.kmh2 = speed.visibleLayer === "kmh2";
    if (type === "XunGenTacho") visibility.kmh3 = speed.visibleLayer === "kmh3";
    if (this.names.has("bg_engineIcon1")) visibility.bg_engineIcon1 = speed.visibleLayer === "kmh";
    if (this.names.has("bg_engineIcon2")) visibility.bg_engineIcon2 = speed.visibleLayer !== "kmh";
    if (this.names.has("xungen_bg1")) visibility.xungen_bg1 = speed.visibleLayer === "kmh";
    if (this.names.has("xungen_bg2")) visibility.xungen_bg2 = speed.visibleLayer !== "kmh";
    if (this.names.has("v1gen_bg1")) visibility.v1gen_bg1 = speed.visibleLayer === "kmh";
    if (this.names.has("v1gen_bg2")) visibility.v1gen_bg2 = speed.visibleLayer !== "kmh";
    visibility.n2o = this.featureVisibility.n2o ?? true;
    if (this.names.has("draft")) visibility["draft/on"] = frame.draftOn === true;
    visibility["n2o/on"] = [3, 4, 5, 10].includes(frame.stateCode);
    if (this.names.has("incGauge"))
      visibility["incGauge/on"] = speed.visibleLayer !== "kmh" &&
        !(frame.stateCode === 3 && !frame.collision.crash) && frame.speed.displaySpeed <= 200;
    if (this.hasBlinkRoadLayers) {
      this.road = advanceRoadBlink(this.road, frame.frameTickMs, frame.speed.displaySpeed);
      if (this.road.visibleLayer !== undefined)
        for (const layer of roadLayers) visibility[layer] = layer === this.road.visibleLayer;
    }

    const play: { name: string; durationMs: number; sourceTickMs: number }[] = [];
    if (this.definition.featureBindings.collisionFeatures) {
      Object.assign(this.collisionSource, frame.collision, {
        playWarnBgVisible: this.visibility("playWarnBg"),
        playCrashBgVisible: this.visibility("playCrashBg"),
        playCrashBgInsideVisible: this.visibility("playCrashBg_Inside"),
      });
      const collision = collisionPresentation(this.collision, frame.frameTickMs, this.collisionSource);
      this.collision = collision.state;
      Object.assign(visibility, collision.visibility);
      if (collision.visibility.chargeable || collision.visibility.charging || collision.visibility.resetting) {
        visibility.incGauge = false;
        visibility["incGauge/on"] = false;
        if (collision.visibility.charging || collision.visibility.resetting) visibility.chargeable = false;
      }
      for (const name of collision.play)
        play.push({ name, durationMs: 0, sourceTickMs: frame.sourceTickMs });
      if (this.resettingBinding)
        this.resetting = this.ops.updateResettingBlink(this.resettingBinding, this.resetting,
          frame.frameTickMs, collision.visibility.resetting);
    }
    if (frame.boosterUnlimited) {
      if (this.names.has("infinite")) visibility.infinite = true;
      visibility.incGauge = false;
      visibility["incGauge/on"] = false;
      visibility.chargeable = false;
    }

    const instantRatio = this.updateInstantGaugePresentation(
      frame.gauges.instantRatio,
      frame.gauges.wallCompensationRatio ?? 0,
      frame.gauges.wallCompensationEventId ?? 0,
      frame.gauges.instantInterpolationMs ?? 0,
      frame.frameTickMs,
    );
    if (this.definition.featureBindings.exceedFeatures) {
      Object.assign(this.exceedSource, {
        active: frame.exceed.active,
        usable: frame.exceed.usableThresholdRatio === undefined ? frame.exceed.usable
          : instantRatio >= checkedGaugeRatio(frame.exceed.usableThresholdRatio),
        displayFull: instantRatio >= 1,
        full: frame.exceed.full,
        physicalUsable: frame.exceed.usable,
      });
      const exceed = exceedPresentation(type, this.exceed, this.exceedSource);
      this.exceed = exceed.state;
      Object.assign(visibility, exceed.visibility);
      for (const name of exceed.play)
        if (this.play1SPanelNames.has(name))
          play.push({ name, durationMs: 0, sourceTickMs: frame.sourceTickMs });
    }

    let chargerRatio: number | undefined;
    let chargerIconArmed = false;
    if (type === "XunGenTacho") {
      const result = this.ops.updateCharger(this.charger, frame.frameTickMs,
        frame.wallClockMs, frame.charger, this.chargerBindings);
      this.charger = result.state;
      this.chargerVisibility = this.ops.chargerVisibility(this.chargerVisibility, result.commands);
      Object.assign(visibility, this.chargerVisibility);
      chargerRatio = result.state.ratio;
      chargerIconArmed = frame.charger.capacity > 0 &&
        frame.charger.count === frame.charger.capacity - 1 && !result.state.active;
      if (this.names.has("incCharger_none")) visibility.incCharger_none = result.state.count === 0;
      for (const command of result.commands)
        if (command.kind === "play")
          play.push({ name: command.name, durationMs: command.durationMs,
            sourceTickMs: command.sourceTickMs });
    }

    const pulse = this.ops.updateGaugePulse(this.gaugePulse, frame.frameTickMs,
      frame.gauges.mainRatio, frame.gauges.instantRatio, type);
    this.gaugePulse = pulse.state;
    const teamMode = frame.gauges.teamBooster
      ? frame.gauges.teamRatio >= 1 ? "full" : "present" : "hidden";
    const teamVisibility = teamGaugeVisibility[teamMode];
    for (const name of teamGaugeLayers)
      if (this.names.has(name)) visibility[name] = teamVisibility[name];
    if (type === "XunGenTacho" && this.names.has("boostGauegeBg_Indi"))
      visibility.boostGauegeBg_Indi = this.definition.featureBindings.boostFeatures === true &&
        !frame.gauges.teamBooster;

    const settledAt = frame.teamSettledAtMs ?? 0;
    const teamElapsed = settledAt === 0 ? 1000 : (frame.frameTickMs - settledAt) >>> 0;
    const teamFull = teamElapsed < 1000;
    if (this.names.has("teamBoostFullFrame"))
      visibility.teamBoostFullFrame = frame.gauges.teamBooster && teamFull;
    if (this.names.has("indiBoostFullFrame")) {
      if (this.mainFullActive && this.mainFullAnchorMs === 0)
        this.mainFullAnchorMs = frame.frameTickMs;
      if (this.mainFullActive && ((frame.frameTickMs - this.mainFullAnchorMs) >>> 0) >= 1000) {
        this.mainFullActive = false;
        this.mainFullAnchorMs = 0;
      }
      visibility.indiBoostFullFrame = this.mainFullActive;
    }
    const mainElapsed = this.mainFullActive
      ? (frame.frameTickMs - this.mainFullAnchorMs) >>> 0 : 1000;
    let blinkButtons = this.emptyBlinkButtons;
    if (this.resetting !== undefined && this.resettingBinding !== undefined) {
      this.resettingBlinkButtons.clear();
      this.resettingBlinkButtons.set(this.resettingBinding.node, this.resetting);
      blinkButtons = this.resettingBlinkButtons;
    }
    const presentation = {
      infiniteMode: frame.boosterUnlimited ?? false,
      visibility,
      text: { [speed.visibleLayer]: speed.text },
      barAlpha: pulse.alpha,
      teamFullAlpha: teamFull ? this.ops.frameAlpha(Math.min(999, teamElapsed)) : 0,
      mainFullAlpha: mainElapsed < 1000 ? this.ops.frameAlpha(Math.min(999, mainElapsed)) : 0,
      mainRatio: this.mainFullActive
        ? Math.max(0, float32(float32(1) - float32(float32(mainElapsed) / float32(1000))))
        : frame.gauges.mainRatio,
      instantRatio,
      teamRatio: teamFull
        ? Math.max(0, float32(float32(1) - float32(float32(teamElapsed) / float32(1000))))
        : frame.gauges.teamRatio,
      chargerRatio,
      chargerIconArmed,
      blinkButtons,
      play,
    };
    for (const name in visibility) this.visible.set(name, visibility[name]!);
    return presentation;
  }

  visibility(name: string): boolean | undefined {
    return this.play1SPanelNames.has(name) ? this.visible.get(name) : undefined;
  }

  updateInstantGaugePresentation(ratio: number, compensationRatio: number, eventId: number,
    interpolationMs: number, nowMs: number): number {
    const target = checkedGaugeRatio(ratio);
    const compensation = checkedGaugeRatio(compensationRatio);
    const now = nowMs >>> 0;
    if (!this.instantGaugeInitialized) {
      this.instantGaugeInitialized = true;
      this.instantGaugeDisplayed = target;
      this.instantGaugeAnchor = target;
      this.instantGaugeTarget = target;
      this.instantGaugeLastMs = now;
      this.instantGaugeWallObserved = compensation;
      this.instantGaugeWallEventObserved = eventId >>> 0;
      return target;
    }
    const elapsed = Math.min(1000, (now - this.instantGaugeLastMs) >>> 0);
    this.instantGaugeLastMs = now;
    const compensationIncreased = compensation > this.instantGaugeWallObserved;
    this.instantGaugeWallObserved = compensation;
    const event = eventId >>> 0;
    const newEvent = event !== 0 && event !== this.instantGaugeWallEventObserved;
    this.instantGaugeWallEventObserved = event;
    const duration = Math.max(0, Math.trunc(interpolationMs));
    const wasAnimating = this.instantGaugeAnimating;
    if (wasAnimating && duration > 0) {
      this.instantGaugeElapsedMs = Math.min(duration, this.instantGaugeElapsedMs + elapsed);
      const progress = float32(float32(this.instantGaugeElapsedMs) / float32(duration));
      this.instantGaugeDisplayed = float32(
        this.instantGaugeAnchor + float32(float32(this.instantGaugeTarget - this.instantGaugeAnchor) * progress));
      if (this.instantGaugeElapsedMs >= duration) {
        this.instantGaugeDisplayed = this.instantGaugeTarget;
        this.instantGaugeAnimating = false;
      }
    }
    if (duration === 0) {
      this.instantGaugeDisplayed = target;
      this.instantGaugeAnimating = false;
    } else if (target < this.instantGaugeDisplayed) {
      this.instantGaugeDisplayed = target;
      this.instantGaugeAnchor = target;
      this.instantGaugeTarget = target;
      this.instantGaugeElapsedMs = 0;
      this.instantGaugeAnimating = false;
    } else if (newEvent || compensationIncreased || (wasAnimating && target !== this.instantGaugeTarget)) {
      this.instantGaugeAnchor = this.instantGaugeDisplayed;
      this.instantGaugeTarget = target;
      this.instantGaugeElapsedMs = 0;
      this.instantGaugeAnimating = true;
    } else if (!this.instantGaugeAnimating) {
      this.instantGaugeDisplayed = target;
      this.instantGaugeAnchor = target;
      this.instantGaugeTarget = target;
      this.instantGaugeElapsedMs = 0;
    }
    return checkedGaugeRatio(this.instantGaugeDisplayed);
  }
}
