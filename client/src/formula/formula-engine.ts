import { FORMULA_GROUPS, FORMULA_BOOSTER_DURATIONS, getFormulaNpcTuning, isFormulaPitPosition, type FormulaDifficulty,
  type FormulaGroupId, type FormulaRound } from "./formula-data";
import { projectSectionDistance, type RouteFrame, type RouteSection, type Vec3 } from "../world/route";

/** Charge rates, grid, contact, timeout and scoring are reconstructed.
 * crushBooster/item.bml preserves Use life=2400 and Affect life=2000; use those
 * original durations for the aggressive accelerator and NPC stun. */
export const FORMULA_RULES = Object.freeze({
  rounds: 3, competitors: 20, gridRowSpacing: 5, gridLaneOffset: 1.7,
  draftRange: 28, draftHalfWidth: 3.2, draftChargePerSecond: 1 / 8,
  pitChargePerSecond: 1 / 2, ...FORMULA_BOOSTER_DURATIONS,
  hitCooldownMs: 2_500, collisionRadius: 2.1, finishGraceMs: 30_000,
  raceTimeLimitMs: 8 * 60_000, npcBoostDurationMs: 2_400,
});

export type FormulaPitZone = {
  center: Vec3; halfSize: Vec3; right?: Vec3; up?: Vec3; forward?: Vec3;
} | { min: Vec3; max: Vec3 };

export interface FormulaPlayer {
  position: Vec3;
  forward: Vec3;
  /** The existing track route state's distance, in world metres. */
  progress: number;
  speedKmh?: number;
  finished?: boolean;
  finishedMs?: number;
  name?: string;
  /** Optional live road-descriptor override, including an explicit false. */
  inPit?: boolean;
}

export interface FormulaNpcSample {
  id: number; name: string;
  position: Vec3; right: Vec3; up: Vec3; forward: Vec3;
  speedKmh: number; boosting: boolean; distance: number;
  finishedMs?: number; stunned: boolean;
}

export interface FormulaStanding {
  /** 0 is the local player; 1..19 are the original NPC ids. */
  id: number; name: string; rank: number; distance: number;
  finishedMs?: number; dnf: boolean; points: number;
}

export interface FormulaRoundResult {
  round: number;
  standings: readonly FormulaStanding[];
  playerRank: number; hits: number; elapsedMs: number;
}

export interface FormulaRaceSnapshot {
  timeMs: number; npcs: FormulaNpcSample[];
  charge: number; boosting: boolean; boostRemainingMs: number;
  draftingNpcId?: number; inPit: boolean; hits: number;
  playerRank: number; finishedCount: number; raceOver: boolean;
  finishDeadlineMs?: number; settled: boolean;
}

export interface FormulaRaceOptions {
  sections: readonly RouteSection[];
  firstSection: number; lastSection: number;
  start: RouteFrame; laps: number; difficulty: FormulaDifficulty;
  groupId: FormulaGroupId; round: FormulaRound;
  trackId?: string;
  isPit?: (position: Vec3) => boolean;
  pitZones?: readonly FormulaPitZone[];
  groundAt?: (position: Vec3) => Vec3 | undefined;
}

interface CircuitSection { section: RouteSection; start: number; span: number; frames: readonly RouteFrame[]; lengths: number[]; geometricLength: number }
interface NpcState { id: number; name: string; distance: number; spawnDistance: number; gridDelta: Vec3; speed: number; lane: number; boostUntil: number; nextBoost: number; stunUntil: number; lastHit: number; finishedMs?: number }
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
const plus = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const minus = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const times = (v: Vec3, n: number): Vec3 => ({ x: v.x * n, y: v.y * n, z: v.z * n });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit = (v: Vec3, fallback: Vec3): Vec3 => length(v) > 1e-7 ? times(v, 1 / length(v)) : { ...fallback };
const lerp = (a: Vec3, b: Vec3, t: number) => plus(a, times(minus(b, a), t));
const mod = (n: number, d: number) => ((n % d) + d) % d;

/** Follow an actual directed circuit; array order is not route order. */
function circuitIndices(sections: readonly RouteSection[], first: number, last: number): number[] {
  if (!sections[first] || !sections[last]) throw new Error("极速方程赛道缺少起终点路线段。");
  const path: number[] = [];
  const visiting = new Set<number>();
  const walk = (index: number): boolean => {
    if (visiting.has(index) || !sections[index]) return false;
    visiting.add(index); path.push(index);
    if (index === last && sections[index]!.outgoing.some(edge => edge.section === first)) return true;
    for (const edge of sections[index]!.outgoing) {
      if (edge.section !== first && walk(edge.section)) return true;
    }
    path.pop(); visiting.delete(index); return false;
  };
  if (!walk(first)) throw new Error("极速方程需要从起点经终点闭合的比赛路线。");
  return path;
}

function makeCircuit(options: FormulaRaceOptions): { sections: CircuitSection[]; length: number } {
  const indices = circuitIndices(options.sections, options.firstSection, options.lastSection);
  let start = 0;
  const sections = indices.map((index, order) => {
    const section = options.sections[index]!;
    const next = options.sections[indices[(order + 1) % indices.length]!]!;
    if (section.frames.length === 0 || !(section.length > 0)) throw new Error("极速方程路线包含空路线段。");
    const frames = [...section.frames];
    const following = next.frames[0];
    if (following && length(minus(following.position, frames[frames.length - 1]!.position)) > 0.001) frames.push(following);
    const lengths = [0];
    for (let i = 1; i < frames.length; i++) lengths.push(lengths[i - 1]! + length(minus(frames[i]!.position, frames[i - 1]!.position)));
    const result = { section, start, span: section.length, frames, lengths, geometricLength: lengths[lengths.length - 1]! };
    start += section.length;
    return result;
  });
  if (!(start > 1)) throw new Error("极速方程比赛路线长度不足。");
  return { sections, length: start };
}

export function isInsideFormulaPit(position: Vec3, zones: readonly FormulaPitZone[]): boolean {
  return zones.some(zone => {
    if ("min" in zone) return position.x >= zone.min.x && position.x <= zone.max.x &&
      position.y >= zone.min.y && position.y <= zone.max.y && position.z >= zone.min.z && position.z <= zone.max.z;
    const local = minus(position, zone.center);
    return Math.abs(dot(local, unit(zone.right ?? { x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }))) <= zone.halfSize.x &&
      Math.abs(dot(local, unit(zone.up ?? { x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }))) <= zone.halfSize.y &&
      Math.abs(dot(local, unit(zone.forward ?? { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }))) <= zone.halfSize.z;
  });
}

/** Pure deterministic race simulation. elapsedMs must exclude countdown/pause.
 * Original NPC speed/accel units are undocumented; interpreting them as m/s and
 * m/s², curve braking, lanes, and a 20-to-1 points table are restoration choices. */
export class FormulaRaceEngine {
  readonly lapLength: number;
  readonly raceDistance: number;
  private readonly circuit: CircuitSection[];
  private npcStates: NpcState[] = [];
  private time = 0;
  private energy = 0;
  private activeUntil = 0;
  private hitCount = 0;
  private player!: FormulaPlayer;
  private playerFinish?: number;
  private deadline?: number;
  private draftId?: number;
  private pit = false;
  private result?: FormulaRoundResult;

  constructor(readonly options: FormulaRaceOptions) {
    if (!Number.isInteger(options.round) || options.round < 1 || options.round > 3) throw new Error("极速方程固定进行三回合。");
    if (!Number.isInteger(options.laps) || options.laps < 1) throw new Error("极速方程圈数必须为正整数。");
    const circuit = makeCircuit(options);
    this.circuit = circuit.sections; this.lapLength = circuit.length;
    this.raceDistance = this.lapLength * options.laps;
    this.reset();
  }

  reset(): void {
    this.time = 0; this.energy = 0; this.activeUntil = 0; this.hitCount = 0;
    this.playerFinish = undefined; this.deadline = undefined; this.draftId = undefined;
    this.pit = false; this.result = undefined;
    const last = this.options.sections[this.options.lastSection]!;
    const startDistance = Math.min(0, projectSectionDistance(this.options.start.position, last) - last.length);
    this.player = { position: { ...this.options.start.position }, forward: { ...this.options.start.forward }, progress: startDistance };
    const group = FORMULA_GROUPS.find(group => group.id === this.options.groupId);
    if (!group || group.riders.length !== 19) throw new Error("极速方程必须有19名原版NPC。");
    this.npcStates = group.riders.map((rider, index) => {
      const slot = index + 1;
      const tuning = getFormulaNpcTuning(this.options.groupId, rider.id, this.options.difficulty, 1, this.options.round);
      const distance = startDistance - Math.floor(slot / 2) * FORMULA_RULES.gridRowSpacing;
      const lane = (slot % 2 ? 1 : -1) * FORMULA_RULES.gridLaneOffset;
      const startRight = unit(cross(this.options.start.up, this.options.start.forward), { x: 1, y: 0, z: 0 });
      const gridPosition = plus(plus(this.options.start.position, times(startRight, lane)),
        times(this.options.start.forward, -Math.floor(slot / 2) * FORMULA_RULES.gridRowSpacing));
      return { id: rider.id, name: rider.name,
        distance, spawnDistance: distance, gridDelta: minus(gridPosition, this.pose(distance, lane).position),
        speed: 0, lane,
        boostUntil: 0, nextBoost: this.interval(tuning.boostIntervalSeconds, rider.id, 0), stunUntil: 0, lastHit: -Infinity };
    });
  }

  private interval(range: readonly [number, number], id: number, now: number): number {
    const seed = Math.abs(Math.sin(id * 12.9898 + this.options.round * 78.233 + Math.floor(now / 1000) * 3.17)) % 1;
    return (range[0] + (range[1] - range[0]) * seed) * 1000;
  }

  private pose(distance: number, lane = 0, snap = false): Pick<FormulaNpcSample, "position" | "right" | "up" | "forward"> {
    const local = mod(distance, this.lapLength);
    let low = 0, high = this.circuit.length - 1;
    while (low < high) { const mid = Math.floor((low + high + 1) / 2); if (this.circuit[mid]!.start <= local) low = mid; else high = mid - 1; }
    const section = this.circuit[low]!;
    const target = clamp((local - section.start) / section.span, 0, 1) * section.geometricLength;
    let frame = 0;
    while (frame + 1 < section.lengths.length - 1 && section.lengths[frame + 1]! < target) frame++;
    const a = section.frames[frame]!;
    const b = section.frames[frame + 1] ?? a;
    const segment = (section.lengths[frame + 1] ?? 0) - section.lengths[frame]!;
    const t = segment > 1e-7 ? (target - section.lengths[frame]!) / segment : 0;
    const forward = unit(lerp(a.forward, b.forward, t), unit(minus(b.position, a.position), a.forward));
    // Same right-handed basis as body.resetFromRouteFrame / THREE.makeBasis.
    const right = unit(cross(lerp(a.up, b.up, t), forward), { x: 1, y: 0, z: 0 });
    const up = unit(cross(forward, right), { x: 0, y: 1, z: 0 });
    let position = plus(lerp(a.position, b.position, t), times(right, lane));
    if (snap && this.options.groundAt) position = this.options.groundAt(position) ?? position;
    return { position, right, up, forward };
  }

  private npcPose(npc: NpcState, snap = false): Pick<FormulaNpcSample, "position" | "right" | "up" | "forward"> {
    // Render just across the finish plane: stopping precisely on its zero
    // signed-distance boundary would leave the existing route gate at lap N.
    const pose = this.pose(npc.distance + (npc.finishedMs === undefined ? 0 : 0.2), npc.lane);
    // Exact two-column grid at t=0, smoothly joining the course over 25 metres.
    // This avoids snapping to the last section's centreline on the first frame.
    const t = clamp((npc.distance - npc.spawnDistance) / 25, 0, 1);
    pose.position = plus(pose.position, times(npc.gridDelta, 1 - t));
    pose.forward = unit(lerp(this.options.start.forward, pose.forward, t), pose.forward);
    pose.right = unit(cross(pose.up, pose.forward), pose.right);
    pose.up = unit(cross(pose.forward, pose.right), pose.up);
    if (snap && this.options.groundAt) pose.position = this.options.groundAt(pose.position) ?? pose.position;
    return pose;
  }

  sampleNpc(id: number): FormulaNpcSample | undefined {
    const npc = this.npcStates.find(npc => npc.id === id);
    if (!npc) return undefined;
    const pose = this.npcPose(npc, true);
    if (npc.stunUntil > this.time) {
      const recovery = clamp((this.time - npc.lastHit) / FORMULA_RULES.stunDurationMs, 0, 1);
      const angle = recovery * Math.PI * 4;
      const forward = plus(times(pose.forward, Math.cos(angle)), times(pose.right, Math.sin(angle)));
      pose.right = plus(times(pose.right, Math.cos(angle)), times(pose.forward, -Math.sin(angle)));
      pose.forward = forward;
      pose.position = plus(pose.position, times(pose.up, Math.sin(recovery * Math.PI) * 0.35));
    }
    return { id, name: npc.name, ...pose,
      speedKmh: npc.speed * 3.6, boosting: npc.boostUntil > this.time && npc.stunUntil <= this.time && npc.finishedMs === undefined,
      distance: npc.distance, finishedMs: npc.finishedMs, stunned: npc.stunUntil > this.time };
  }

  get snapshot(): FormulaRaceSnapshot {
    const standings = this.standings();
    return { timeMs: this.time, npcs: this.npcStates.map(npc => this.sampleNpc(npc.id)!),
      charge: this.energy, boosting: this.activeUntil > this.time && !this.raceOver && this.playerFinish === undefined,
      boostRemainingMs: this.raceOver || this.playerFinish !== undefined ? 0 : Math.max(0, this.activeUntil - this.time),
      draftingNpcId: this.draftId, inPit: this.pit, hits: this.hitCount,
      playerRank: standings.find(row => row.id === 0)!.rank,
      finishedCount: standings.filter(row => row.finishedMs !== undefined).length,
      finishDeadlineMs: this.deadline, raceOver: this.raceOver, settled: !!this.result };
  }

  get raceOver(): boolean {
    return !!this.result || this.time >= FORMULA_RULES.raceTimeLimitMs ||
      (this.deadline !== undefined && this.time >= this.deadline) ||
      (this.playerFinish !== undefined && this.npcStates.every(npc => npc.finishedMs !== undefined));
  }

  activate(): boolean {
    if (this.energy < 1 - 1e-8 || this.activeUntil > this.time || this.raceOver || this.playerFinish !== undefined) return false;
    this.energy = 0; this.activeUntil = this.time + FORMULA_RULES.boostDurationMs;
    return true;
  }

  /** Only NPC ids are accepted; one contact cannot score on every render frame. */
  stunNpc(id: number): boolean {
    if (this.activeUntil <= this.time || this.raceOver || this.playerFinish !== undefined) return false;
    const npc = this.npcStates.find(npc => npc.id === id);
    if (!npc || npc.finishedMs !== undefined || this.time - npc.lastHit < FORMULA_RULES.hitCooldownMs) return false;
    npc.stunUntil = this.time + FORMULA_RULES.stunDurationMs; npc.lastHit = this.time;
    npc.speed *= 0.12; npc.boostUntil = 0; this.hitCount++;
    return true;
  }

  /** Absolute elapsed time makes repeated calls during a pause exact no-ops.
   * 50ms substeps also prevent a delayed frame from skipping boost/stun expiry. */
  update(elapsedMs: number, input: FormulaPlayer): FormulaRaceSnapshot {
    if (!Number.isFinite(elapsedMs) || elapsedMs < this.time || this.result) return this.snapshot;
    const wasOver = this.raceOver;
    const target = Math.min(elapsedMs, FORMULA_RULES.raceTimeLimitMs);
    const from = this.player;
    const beginning = this.time;
    const duration = target - beginning;
    while (this.time < target && !this.raceOver) {
      const step = Math.min(50, target - this.time, this.deadline === undefined ? Infinity : this.deadline - this.time);
      const ratio = duration > 0 ? (this.time + step - beginning) / duration : 1;
      const nextPlayer = { ...input, position: lerp(from.position, input.position, ratio),
        forward: unit(lerp(from.forward, input.forward, ratio), input.forward),
        progress: from.progress + (input.progress - from.progress) * ratio };
      this.advance(step, nextPlayer);
    }
    this.player = { ...input, position: { ...input.position }, forward: { ...input.forward } };
    if (!wasOver && (input.finished || input.finishedMs !== undefined) && this.playerFinish === undefined &&
        (input.finishedMs ?? elapsedMs) <= this.time) {
      this.playerFinish = clamp(input.finishedMs ?? this.time, 0, this.time);
      this.player.progress = Math.max(this.player.progress, this.raceDistance);
      this.startDeadline(this.playerFinish);
    }
    return this.snapshot;
  }

  private startDeadline(finishedMs: number): void {
    this.deadline = Math.min(this.deadline ?? Infinity, finishedMs + FORMULA_RULES.finishGraceMs);
  }

  private advance(dtMs: number, player: FormulaPlayer): void {
    const dt = dtMs / 1000;
    const endTime = this.time + dtMs;
    const playerRank = this.standings().find(row => row.id === 0)!.rank;
    const previousNpcPoses = this.npcStates.map(npc => this.npcPose(npc));
    for (const npc of this.npcStates) {
      if (npc.finishedMs !== undefined) continue;
      const tuning = getFormulaNpcTuning(this.options.groupId, npc.id, this.options.difficulty, playerRank, this.options.round);
      const stunned = npc.stunUntil > this.time;
      if (!stunned && this.time >= npc.nextBoost) {
        npc.boostUntil = this.time + FORMULA_RULES.npcBoostDurationMs;
        npc.nextBoost = this.time + this.interval(tuning.boostIntervalSeconds, npc.id, this.time);
      }
      const here = this.pose(npc.distance);
      const ahead = this.pose(npc.distance + Math.max(14, npc.speed * 0.65));
      const bend = Math.acos(clamp(dot(here.forward, ahead.forward), -1, 1));
      const curve = clamp(1 - bend * 0.64, 0.36, 1);
      let targetSpeed = Math.max(12, tuning.speed) * curve;
      if (npc.boostUntil > this.time) targetSpeed *= 1.24;
      if (stunned) targetSpeed = 2.5;
      const inFront = this.npcStates.find(other => other !== npc && other.distance > npc.distance &&
        other.distance - npc.distance < 9 && Math.abs(other.lane - npc.lane) < 1.9);
      const baseLane = npc.id % 2 ? FORMULA_RULES.gridLaneOffset : -FORMULA_RULES.gridLaneOffset;
      const targetLane = inFront ? -Math.sign(inFront.lane || baseLane) * FORMULA_RULES.gridLaneOffset : baseLane;
      npc.lane += clamp(targetLane - npc.lane, -dt * 2, dt * 2);
      if (inFront && Math.abs(inFront.lane - npc.lane) < 1.5) targetSpeed = Math.min(targetSpeed, inFront.speed + 1);
      const acceleration = Math.max(5, tuning.accel);
      npc.speed = Math.max(0, npc.speed + clamp(targetSpeed - npc.speed, -dt * 38, dt * acceleration));
      const previous = npc.distance;
      npc.distance = Math.min(this.raceDistance, npc.distance + npc.speed * dt);
      if (npc.distance >= this.raceDistance) {
        npc.finishedMs = this.time + dtMs * clamp((this.raceDistance - previous) / Math.max(1e-6, npc.speed * dt), 0, 1);
        npc.speed = 0; npc.boostUntil = 0; this.startDeadline(npc.finishedMs);
      }
    }
    this.time = endTime;
    this.draftId = undefined;
    this.pit = player.inPit ?? this.options.isPit?.(player.position) ??
      (isInsideFormulaPit(player.position, this.options.pitZones ?? []) ||
        !!(this.options.trackId && isFormulaPitPosition(this.options.trackId, player.position)));
    const finishNow = this.playerFinish !== undefined || player.finished || player.finishedMs !== undefined;
    if (!finishNow && !this.raceOver) {
      const forward = unit(player.forward, { x: 0, y: 0, z: -1 });
      const speed = player.speedKmh ?? length(minus(player.position, this.player.position)) / Math.max(dt, 0.001) * 3.6;
      let closest = Infinity;
      this.npcStates.forEach((npc, index) => {
        if (npc.finishedMs !== undefined) return;
        const pose = this.npcPose(npc);
        const delta = minus(pose.position, player.position);
        const ahead = dot(delta, forward);
        const lateral = length(minus(delta, times(forward, ahead)));
        if (speed >= 25 && ahead > 2 && ahead <= FORMULA_RULES.draftRange && lateral < FORMULA_RULES.draftHalfWidth &&
          dot(forward, pose.forward) > 0.65 && Math.abs(delta.y) < 3 && ahead < closest) { this.draftId = npc.id; closest = ahead; }
        if (this.activeUntil > this.time) {
          // Relative swept contact catches fast overtakes. Discontinuous player
          // resets deliberately use endpoint contact instead of hitting a line
          // of opponents between the pre-reset and post-reset positions.
          const oldDelta = minus(previousNpcPoses[index]!.position, this.player.position);
          const movement = minus(delta, oldDelta);
          const continuous = length(minus(player.position, this.player.position)) <= 100 * dt + 3;
          const t = continuous && dot(movement, movement) > 1e-8 ? clamp(-dot(oldDelta, movement) / dot(movement, movement), 0, 1) : 1;
          const contact = lerp(oldDelta, delta, t);
          if (length(contact) <= FORMULA_RULES.collisionRadius && Math.abs(contact.y) < 2.2) this.stunNpc(npc.id);
        }
      });
      if (this.activeUntil <= this.time) this.energy = clamp(this.energy + dt *
        ((this.draftId === undefined ? 0 : FORMULA_RULES.draftChargePerSecond) + (this.pit ? FORMULA_RULES.pitChargePerSecond : 0)), 0, 1);
    }
    this.player = player;
  }

  standings(): FormulaStanding[] {
    if (this.result) return this.result.standings.map(row => ({ ...row }));
    const rows = [{ id: 0, name: this.player.name ?? "玩家", distance: this.player.progress, finishedMs: this.playerFinish },
      ...this.npcStates.map(npc => ({ id: npc.id, name: npc.name, distance: npc.distance, finishedMs: npc.finishedMs }))];
    rows.sort((a, b) => a.finishedMs !== undefined && b.finishedMs !== undefined ? a.finishedMs - b.finishedMs || a.id - b.id :
      a.finishedMs !== undefined ? -1 : b.finishedMs !== undefined ? 1 : b.distance - a.distance || a.id - b.id);
    return rows.map((row, index) => ({ ...row, rank: index + 1, dnf: row.finishedMs === undefined,
      points: row.finishedMs === undefined ? 0 : FORMULA_RULES.competitors - index }));
  }

  settle(): FormulaRoundResult {
    if (!this.result) {
      const standings = this.standings().map(row => Object.freeze(row));
      this.result = Object.freeze({ round: this.options.round, standings: Object.freeze(standings),
        playerRank: standings.find(row => row.id === 0)!.rank, hits: this.hitCount, elapsedMs: this.time });
      this.activeUntil = 0; this.draftId = undefined;
    }
    return this.result;
  }
}

export interface FormulaChampionshipStanding {
  id: number; name: string; rank: number; points: number; wins: number; roundRanks: number[]; roundPoints: number[];
}

/** Exactly three distinct, ordered results; recording the same result is safe. */
export class FormulaChampionship {
  private results: FormulaRoundResult[] = [];
  get completedRounds(): number { return this.results.length; }
  get complete(): boolean { return this.results.length === FORMULA_RULES.rounds; }
  reset(): void { this.results = []; }
  record(result: FormulaRoundResult): FormulaChampionshipStanding[] {
    if (this.results.some(previous => previous.round === result.round)) return this.standings;
    if (this.complete || result.round !== this.results.length + 1) throw new Error("极速方程必须依次结算三个回合。");
    if (result.standings.length !== 20 || new Set(result.standings.map(row => row.id)).size !== 20 ||
      result.standings.some(row => !Number.isInteger(row.id) || row.id < 0 || row.id > 19)) throw new Error("极速方程结算需要完整的20人名单。");
    this.results.push({ ...result, standings: result.standings.map(row => ({ ...row })) });
    return this.standings;
  }
  get standings(): FormulaChampionshipStanding[] {
    const rows = new Map<number, FormulaChampionshipStanding>();
    for (const result of this.results) for (const standing of result.standings) {
      const row = rows.get(standing.id) ?? { id: standing.id, name: standing.name, rank: 0, points: 0, wins: 0, roundRanks: [], roundPoints: [] };
      row.points += standing.points; row.wins += standing.rank === 1 && !standing.dnf ? 1 : 0;
      row.roundRanks.push(standing.rank); row.roundPoints.push(standing.points); rows.set(row.id, row);
    }
    return [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins ||
      a.roundRanks[a.roundRanks.length - 1]! - b.roundRanks[b.roundRanks.length - 1]! || a.id - b.id)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }
}
