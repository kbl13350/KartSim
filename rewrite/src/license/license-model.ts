/**
 * What the 驾照考试 pages show, from the data service's table and standing
 * (the same rules server-go/internal/data/store/license.go enforces): a
 * license opens once the one before it is taken and the level's glove may
 * try it; its steps open one after another; PRO needs L1 and the
 * qualification emblem and runs the current period's two missions.
 */
import { LICENSE_NAMES, PRO_LEVEL, type LicenseState, type LicenseStep,
  type LicenseTable } from "./license-api";

/** The glove a level needs before it may try a license (leveltable tryLevel). */
const TRY_GLOVES: Record<number, string> = { 2: "绿色手套", 3: "蓝色手套", 4: "红色手套", 5: "黑色手套" };

export interface LicenseStepView {
  step: LicenseStep;
  index: number;
  cleared: boolean;
  open: boolean;
  bestMs?: number;
}

export function licenseName(level: number): string {
  return LICENSE_NAMES[level - 1] ?? "";
}

/** Why a license page cannot be played yet; undefined when it can. */
export function licenseLock(state: LicenseState, level: number): string | undefined {
  if (level === PRO_LEVEL) {
    if (state.baseLevel < PRO_LEVEL - 1) return "获得L1驾照后才能挑战PRO驾照。";
    return undefined;
  }
  if (level > state.baseLevel + 1) return `请先获得${licenseName(level - 1)}驾照。`;
  if (level > state.tryLevel) return `等级达到${TRY_GLOVES[level] ?? "更高等级"}后才能挑战${licenseName(level)}驾照。`;
  return undefined;
}

/** The steps a license page lists: its six, or the current PRO period's two. */
export function licenseSteps(table: LicenseTable, state: LicenseState, level: number): LicenseStepView[] {
  const license = table.licenses.find(entry => entry.level === level);
  if (!license) return [];
  const steps = level === PRO_LEVEL
    ? license.steps.filter(step => state.proSteps.includes(step.step)) : license.steps;
  const locked = licenseLock(state, level) !== undefined ||
    (level === PRO_LEVEL && !state.qualified);
  return steps.map((step, index) => {
    const clear = state.cleared.get(step.step);
    const previous = index > 0 ? steps[index - 1] : undefined;
    const open = !locked && (level === PRO_LEVEL || !previous || state.cleared.has(previous.step));
    return { step, index, cleared: !!clear, open, ...(clear ? { bestMs: clear.bestMs } : {}) };
  });
}

/** Every listed step is cleared. */
export function licenseComplete(table: LicenseTable, state: LicenseState, level: number): boolean {
  const steps = licenseSteps(table, state, level);
  return steps.length > 0 && steps.every(step => step.cleared);
}

/** The 获得驾照 button: all steps cleared and the license not taken (this period, for PRO). */
export function canTakeLicense(table: LicenseTable, state: LicenseState, level: number): boolean {
  if (licenseLock(state, level) !== undefined || !licenseComplete(table, state, level)) return false;
  if (level === PRO_LEVEL) return state.qualified && state.proPeriod !== state.period;
  return level === state.baseLevel + 1;
}

/** The license shown first: the one being worked on. */
export function currentLicenseLevel(state: LicenseState): number {
  if (state.baseLevel >= PRO_LEVEL - 1) return PRO_LEVEL;
  return Math.max(1, Math.min(state.baseLevel + 1, state.tryLevel));
}

/** clearLevelN badges: the licenses taken (PRO while it lasts). */
export function licenseTaken(state: LicenseState, level: number): boolean {
  return level === PRO_LEVEL ? state.level === PRO_LEVEL : state.baseLevel >= level;
}

/** A step a race may start: listed and open. */
export function findOpenStep(table: LicenseTable, state: LicenseState, step: number):
  { level: number; view: LicenseStepView } | undefined {
  for (const license of table.licenses) {
    const view = licenseSteps(table, state, license.level).find(entry => entry.step.step === step);
    if (view) return view.open ? { level: license.level, view } : undefined;
  }
  return undefined;
}

/** Clear rule of a finished run, as the server judges it. */
export function judgeLicenseRun(step: LicenseStep, elapsedMs: number): boolean {
  if (step.rule === "time") return step.timeMs === 0 || elapsedMs <= step.timeMs;
  if (step.rule === "rival") return elapsedMs < (step.rivalMs ?? 0);
  return true;
}

/** The race time limit: the step's own, or the rival's time for a duel (none for item missions). */
export function licenseTimeLimit(step: LicenseStep): number {
  if (step.rule === "time") return step.timeMs;
  return 0;
}

/**
 * channel.xml licenseLevel of the channels this server runs: the infinite
 * boost channels advise 初级 (joinChannelWarning3 "建议%s驾照以上玩家进入该频道。").
 */
const CHANNEL_LICENSE: Record<string, number> = { speedIndiInfinit: 2, speedTeamInfinit: 2 };

/** The advice shown entering a channel below its license, if any. */
export function channelLicenseWarning(channel: string | undefined, license: number): string | undefined {
  const wanted = channel ? CHANNEL_LICENSE[channel] : undefined;
  return wanted && license < wanted ? `建议${licenseName(wanted)}驾照以上玩家进入该频道。` : undefined;
}
