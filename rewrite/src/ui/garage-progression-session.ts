import type { XunGarageProgression } from "./garage-progression-panel";

export interface GarageSkillSelectionDependencies {
  validate(progression: XunGarageProgression): void;
  select(progression: XunGarageProgression, slot: number, skillId: number): XunGarageProgression;
  availablePoints(progression: XunGarageProgression): number;
}

/** An uncommitted choice for one of the three XUN performance skill slots. */
export class GarageSkillSelectionState {
  readonly initial: XunGarageProgression;
  id: number;
  settled = false;

  constructor(progression: XunGarageProgression, readonly slot: number,
    readonly dependencies: GarageSkillSelectionDependencies) {
    dependencies.validate(progression);
    if (!Number.isInteger(slot) || slot < 0 || slot > 2)
      throw new Error("无效的性能槽。");
    this.initial = { ...progression,
      skills: progression.skills.map(skill => ({ ...skill })) };
    this.id = progression.skills[slot]!.id;
  }

  choose(skillId: number): void {
    if (this.settled) return;
    if (!Number.isInteger(skillId) || skillId < 1 || skillId > 9)
      throw new Error("无效的竞速技能。");
    if (this.isOccupied(skillId)) throw new Error("该技能已被其他性能槽占用。");
    this.id = skillId;
  }

  equippedSlot(skillId: number): number | undefined {
    const index = this.initial.skills.findIndex(skill => skill.id === skillId);
    return index < 0 ? undefined : index + 1;
  }

  isOccupied(skillId: number): boolean {
    const slot = this.equippedSlot(skillId);
    return slot !== undefined && slot !== this.slot + 1;
  }

  get value(): XunGarageProgression {
    return this.dependencies.select(this.initial, this.slot, this.id);
  }

  get changed(): boolean {
    return this.id !== this.initial.skills[this.slot]!.id;
  }

  get refunded(): number {
    return this.dependencies.availablePoints(this.value) -
      this.dependencies.availablePoints(this.initial);
  }

  settle(accept: boolean): XunGarageProgression | undefined {
    if (this.settled) return undefined;
    this.settled = true;
    return accept && this.changed ? this.value : undefined;
  }
}

export interface GarageProgressionCandidate {
  item: { itemId: number; engineGrade: number };
  value: XunGarageProgression;
}

export interface GaragePreparationDependencies {
  blockedKart(itemId: number): boolean;
  validate(progression: XunGarageProgression): void;
  nextLevel(progression: XunGarageProgression, method: string): XunGarageProgression;
}

export interface GaragePreparationResult {
  candidate: GarageProgressionCandidate;
  target: XunGarageProgression;
  method: string;
}

/** A paged, uncommitted XUN upgrade choice with a single settlement point. */
export class GarageUpgradePreparationState {
  readonly candidates: GarageProgressionCandidate[];
  index: number;
  pageIndex: number;
  settled = false;
  method = "step";

  constructor(candidates: GarageProgressionCandidate[], selectedItemId: number,
    readonly dependencies: GaragePreparationDependencies) {
    this.candidates = candidates
      .filter(candidate => !dependencies.blockedKart(candidate.item.itemId) &&
        candidate.item.engineGrade === 9)
      .map(candidate => {
        dependencies.validate(candidate.value);
        if (candidate.value.kind !== "xun")
          throw new Error("强化目标必须为迅车型。");
        return { item: candidate.item,
          value: { ...candidate.value,
            skills: candidate.value.skills.map(skill => ({ ...skill })) } };
      });
    if (new Set(this.candidates.map(candidate => candidate.item.itemId)).size !==
        this.candidates.length) throw new Error("强化目录车辆重复。");
    this.index = this.candidates.findIndex(candidate =>
      candidate.item.itemId === selectedItemId);
    if (this.index < 0) throw new Error("强化目标不在迅车型目录中。");
    this.pageIndex = Math.floor(this.index / 16);
  }

  get selected(): GarageProgressionCandidate { return this.candidates[this.index]!; }
  get page(): number { return this.pageIndex; }
  get pages(): number { return Math.max(1, Math.ceil(this.candidates.length / 16)); }
  get visible(): GarageProgressionCandidate[] {
    return this.candidates.slice(this.pageIndex * 16, this.pageIndex * 16 + 16);
  }
  get canStart(): boolean { return !this.settled && this.selected.value.level < 5; }
  get upgradeMethod(): string { return this.method; }
  get target(): XunGarageProgression {
    return this.selected.value.level === 5
      ? this.selected.value
      : this.dependencies.nextLevel(this.selected.value, this.method);
  }

  setUpgradeMethod(method: string): void {
    if (!this.settled) this.method = method;
  }

  turnPage(direction: number): void {
    if (this.settled) return;
    this.pageIndex = Math.min(this.pages - 1, Math.max(0, this.pageIndex + direction));
  }

  choose(itemId: number): void {
    if (this.settled) return;
    const index = this.candidates.findIndex(candidate => candidate.item.itemId === itemId);
    if (index < 0) throw new Error("强化目标不在目录内。");
    this.index = index;
    this.pageIndex = Math.floor(index / 16);
  }

  settle(accept: boolean): GaragePreparationResult | undefined {
    if (this.settled) return undefined;
    const result = accept && this.canStart
      ? { candidate: this.selected, target: this.target, method: this.method }
      : undefined;
    this.settled = true;
    return result;
  }
}
