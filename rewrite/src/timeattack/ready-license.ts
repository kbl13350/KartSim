import { ensureFeatureResources } from "../ui/resource-panel";
import { activeBrowserSession } from "../account/account-runtime";
import { p2, T } from "../generated/formats.js";
import { F9, U1, te } from "../generated/library.js";
import { claimLicenseEmblem, fetchLicense, formatLicenseTime, licenseErrorMessage, PRO_LEVEL,
  qualifyLicense, runLicenseStep, takeLicense, type LicenseState, type LicenseStep,
  type LicenseTable } from "../license/license-api";
import type { LicenseMissionSpec } from "../license/license-mission";
import { canTakeLicense, currentLicenseLevel, findOpenStep, judgeLicenseRun, licenseComplete,
  licenseLock, licenseName, licenseSteps, licenseTaken, licenseTimeLimit,
  type LicenseStepView } from "../license/license-model";
import { loadEmblemTable } from "../myroom/myroom-data";
import { registerTrackMetadata } from "../resources/track-overrides";
import type { StoryMission, StoryNode } from "../story/story-data";
import type { StoryGhostSource, StoryRaceOutcome } from "../story/story-race";
import type { LicenseMenu, LicenseMenuStep } from "../ui/main-menu-view";
import { readMainMenuStrings, type MainMenuNode } from "../ui/main-menu-view";
import { loadMissionIcon } from "../ui/rider-school-art";
import { openMessengerMessage } from "../ui/messenger-dialogs";
import { decodeStoryTexture, pruneMissingTextures } from "../ui/story-windows";
import type { ReadySelection } from "./ready-flow";
import { openReadyHome, type ReadyHomeController } from "./ready-home";
import { storyGhostSources } from "./ready-story";
import type { ReadyOptions } from "../ui/ready-options";

/**
 * 驾照考试 over the 单人游戏 page: the license tabs, a step's
 * RiderSchoolReadyStage window, the race on the step's course with the
 * practice kart, the data service's verdict and reward, taking a license
 * (dialog2_licenseCard) and the PRO qualification. The standing lives on the
 * data service (server-go/RIDER_SCHOOL.md); this module only asks and shows.
 */

interface Texture { image: CanvasImageSource; width: number; height: number }
interface ResourceFile { bytes(): Promise<Uint8Array> }
interface CatalogEntry { itemId: number; path: string; systemKey?: string }
interface LicenseLibrary {
  canonicalCandidates(path: string): ResourceFile[];
  mapAssets(): Array<{ virtualPath: string }>;
  timeAttackGarageCatalog(): Promise<{ karts: CatalogEntry[]; characters: CatalogEntry[] }>;
  timeAttackTrackCatalog(): Promise<Array<{ id: string; path: string; title?: string }>>;
  timeAttackRandomTrackNames?(): Promise<Map<string, string>>;
}
interface WindowView { readonly element: HTMLElement; show(): void; dispose(): void; render(): void }

export interface ReadyLicenseController extends ReadyHomeController {
  licenseData?: { table: LicenseTable; state: LicenseState };
  licenseWindow?: WindowView;
  /** Closes the message box shown over the page. */
  licenseMessage?: AbortController;
  licenseBusy?: boolean;
  /** Bumped when the license windows are left; a load still running drops its window. */
  licenseGeneration?: number;
  /** The license tab to show when the 单人游戏 page returns from a race. */
  licenseReturnLevel?: number;
}

const READY_ROOT = "stage_/riderSchoolReady";
const READY_ROOTS = [READY_ROOT, "stage_/common", "stage_/mainMenu/riderSchool"];
const CARD_ROOT = "dialog2_/licenseCard";
const OUTRUN_ROOT = "etc_/riderSchool/outRun";
/** The practice kart (config.xml practiceKart, 练习用卡丁车 V1) every step is driven with. */
const PRACTICE_KART = "practiceKart";
/** Mission icons of the PRO steps, which name their Pro2 board instead. */
const PRO_ICONS = { time: "missionIcon_L3_6_timeattack", rival: "missionIcon_L2_3_shadow" } as const;
const TITLE = "驾照考试";

const generation = (controller: ReadyLicenseController): number => controller.licenseGeneration ?? 0;

function library(controller: ReadyLicenseController): LicenseLibrary | undefined {
  const value = controller.host.getLibrary() as Partial<LicenseLibrary> | undefined;
  return typeof value?.canonicalCandidates === "function" && typeof value.mapAssets === "function"
    ? value as LicenseLibrary : undefined;
}

function closeWindow(controller: ReadyLicenseController): void {
  controller.licenseWindow?.dispose();
  controller.licenseWindow = undefined;
  controller.licenseMessage?.abort();
  controller.licenseMessage = undefined;
}

/** Leave the license windows (home closed, another tab). */
export function leaveLicense(controller: ReadyLicenseController): void {
  controller.licenseGeneration = generation(controller) + 1;
  closeWindow(controller);
}

function stale(controller: ReadyLicenseController, started: number): boolean {
  return controller.disposed || generation(controller) !== started || !controller.activeHome;
}

/** The release message box over the page ("|" or a newline breaks lines). */
function message(controller: ReadyLicenseController, text: string): void {
  const lib = library(controller);
  if (!lib || controller.disposed) return;
  closeWindow(controller);
  const abort = new AbortController();
  controller.licenseMessage = abort;
  void openMessengerMessage(lib as never, controller.host.root, TITLE, text.replaceAll("\n", "|"), {},
    abort.signal).catch(() => controller.activeHome?.showNotice(text)).finally(() => {
    if (controller.licenseMessage === abort) controller.licenseMessage = undefined;
  });
}

const iconCache = new WeakMap<object, Map<string, Promise<Texture[] | undefined>>>();
const textureCache = new WeakMap<object, Map<string, Promise<Texture | undefined>>>();

async function decode(file: ResourceFile): Promise<Texture> {
  const image = await p2(await file.bytes()) as { width: number; height: number; pixels: ArrayLike<number> };
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(image.pixels),
    image.width, image.height), 0, 0);
  return { image: canvas, width: image.width, height: image.height };
}

function texture(lib: LicenseLibrary, roots: string[], name: string): Promise<Texture | undefined> {
  let cache = textureCache.get(lib);
  if (!cache) textureCache.set(lib, cache = new Map());
  const key = `${roots.join(";")}:${name}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = Promise.resolve().then(() => decode(U1(lib, roots, name) as ResourceFile)).catch(() => undefined);
    cache.set(key, pending);
  }
  return pending;
}

function missionIcon(lib: LicenseLibrary, icon: string): Promise<Texture[] | undefined> {
  let cache = iconCache.get(lib);
  if (!cache) iconCache.set(lib, cache = new Map());
  let pending = cache.get(icon);
  if (!pending) {
    pending = loadMissionIcon((roots, name) => texture(lib, roots, name), icon);
    cache.set(icon, pending);
  }
  return pending;
}

function stepIcon(step: LicenseStep, level: number): string {
  if (level === PRO_LEVEL) return step.rule === "rival" ? PRO_ICONS.rival : PRO_ICONS.time;
  return step.icon;
}

/** "13秒", "18.7秒", or "2:11.00" from a minute up. */
const seconds = (ms: number): string => ms >= 60_000 ? formatLicenseTime(ms)
  : `${Number((ms / 1000).toFixed(2))}秒`;

/** The right side of a step card: the clear condition, and the best time once cleared. */
export function licenseStepDetail(view: LicenseStepView): string {
  const { step } = view;
  const rule = step.rule === "rival" ? `战胜对手（${formatLicenseTime(step.rivalMs ?? 0)}）`
    : (step.rule === "time" || step.rule === "item") && step.timeMs > 0 ? `限时 ${seconds(step.timeMs)}`
      : step.rule === "drill" ? "按提示完成驾驶练习"
        : step.rule === "finish" ? "完成比赛（无 AI 车手）" : "完成比赛";
  return view.bestMs !== undefined ? `${rule}  最佳 ${formatLicenseTime(view.bestMs)}` : rule;
}

async function trackTitles(lib: LicenseLibrary): Promise<Map<string, string>> {
  try {
    return await lib.timeAttackRandomTrackNames?.() ?? new Map();
  } catch {
    return new Map();
  }
}

/** The tabs of the 驾照考试 page from the data service's standing. */
export async function loadLicenseMenu(controller: ReadyLicenseController): Promise<LicenseMenu | undefined> {
  const session = activeBrowserSession();
  const lib = library(controller);
  if (!session || !lib) return undefined;
  const data = await fetchLicense(session);
  controller.licenseData = data;
  return licenseMenu(lib, data.table, data.state);
}

async function licenseMenu(lib: LicenseLibrary, table: LicenseTable, state: LicenseState): Promise<LicenseMenu> {
  const titles = await trackTitles(lib);
  const title = (track: string): string => titles.get(track) ?? titles.get(track.toLowerCase()) ?? track;
  const steps = async (level: number): Promise<LicenseMenuStep[]> =>
    Promise.all(licenseSteps(table, state, level).map(async view => {
      const icon = await missionIcon(lib, stepIcon(view.step, level));
      // The PRO boards are the same every period; they name the period's course.
      const detail = level === PRO_LEVEL ? `${title(view.step.track)}  ${licenseStepDetail(view)}`
        : licenseStepDetail(view);
      return { step: view.step.step, name: view.step.name, cleared: view.cleared, open: view.open,
        detail, ...(icon ? { icon } : {}) };
    }));
  const levels = await Promise.all(table.licenses.map(async license => {
    const lock = licenseLock(state, license.level);
    return { level: license.level, taken: licenseTaken(state, license.level),
      ...(lock ? { lock } : {}), steps: license.level === PRO_LEVEL ? [] : await steps(license.level),
      canTake: canTakeLicense(table, state, license.level) };
  }));
  const [emblems, emblem] = await Promise.all([
    loadEmblemTable(lib as never).catch(() => new Map()),
    texture(lib, ["etc_/emblem"], `${table.pro.emblemId}_73`)]);
  const template = "排位计时赛以标准为基准，在%s内完成%s赛道";
  const rows = table.pro.qualify.map(q => {
    const best = state.records.get(q.track);
    return { track: q.track,
      title: template.replace("%s", formatLicenseTime(q.timeMs)).replace("%s", title(q.track)),
      record: best === undefined ? "-" : `${formatLicenseTime(best)}${best <= q.timeMs ? " ✓" : ""}` };
  });
  const met = table.pro.qualify.every(q => (state.records.get(q.track) ?? Infinity) <= q.timeMs);
  const info = (emblems as Map<number, { name?: string }>).get(table.pro.emblemId);
  return {
    selected: currentLicenseLevel(state),
    levels,
    pro: {
      qualified: state.qualified,
      ...(emblem ? { emblem } : {}),
      emblemName: info?.name ?? "PRO挑战资格",
      rows,
      canClaim: !state.qualified && state.baseLevel >= PRO_LEVEL - 1 && met,
      missions: await steps(PRO_LEVEL),
      canTake: canTakeLicense(table, state, PRO_LEVEL),
      ...(state.level === PRO_LEVEL ? { status: `PRO驾照有效期至 ${formatDate(state.proUntil)}` } : {}),
    },
  };
}

function formatDate(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Re-read the standing and redraw the page; the tab stays where it is. */
export async function refreshLicenseMenu(controller: ReadyLicenseController): Promise<void> {
  const view = controller.activeHome;
  if (!view) return;
  try {
    const menu = await loadLicenseMenu(controller);
    if (controller.activeHome === view) view.setLicenseMenu(menu);
  } catch (error) {
    if (controller.activeHome === view) view.showNotice(`驾照考试读取失败：${licenseErrorMessage(error)}`);
  }
}

// ---------------------------------------------------------------------------
// The ready window (stage_riderSchoolReady)

function withAttributes(node: StoryNode, changes: Record<string, string | undefined>): StoryNode {
  const attributes = node.attributes.filter(entry => !(entry.name in changes));
  for (const [key, value] of Object.entries(changes))
    if (value !== undefined) attributes.push({ name: key, value });
  return { ...node, attributes };
}

function mapTree(node: StoryNode, change: (node: StoryNode) => StoryNode | undefined): StoryNode {
  const changed = change(node) ?? node;
  return { ...changed, children: changed.children.map(child => mapTree(child, change)) };
}

const nodeName = (node: StoryNode): string => (T(node, "name") as string | undefined) ?? "";

/** stage_scenarioReady's goBackButton (stage_common kick_1…4). */
const CLOSE_BUTTON: StoryNode = { name: "ImageButton", children: [], attributes: [
  { name: "name", value: "goBackButton" }, { name: "windowRect", value: "0 0 20 20" },
  { name: "align", value: "right,top" }, { name: "adjust", value: "-4 -28" },
  { name: "autoLoadImage", value: "kick_" }, { name: "alphaBlend", value: "true" },
  { name: "altText", value: "关闭" }] };

const readyStrings = new WeakMap<object, Promise<Map<string, string>>>();

function stageStrings(lib: LicenseLibrary): Promise<Map<string, string>> {
  let pending = readyStrings.get(lib);
  if (!pending) {
    pending = F9(lib, READY_ROOT, "stage_stringBag").then(bag => readMainMenuStrings(bag as MainMenuNode));
    pending.catch(() => readyStrings.delete(lib));
    readyStrings.set(lib, pending);
  }
  return pending;
}

type Rect = { x: number; y: number; width: number; height: number };
const FONT = "'KartSim Main Menu', 'PingFang SC', 'Microsoft YaHei', sans-serif";

/** Lines of a release text ("|" breaks) wrapped to a width. */
export function wrapLicenseText(measure: (text: string) => number, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\||\n/)) {
    let current = "";
    for (const character of paragraph) {
      if (current && measure(current + character) > width) {
        lines.push(current);
        current = "";
      }
      current += character;
    }
    lines.push(current);
  }
  return lines;
}

/** A multiLine release label: wrapped, outlined like outline14 or plain like bold14. */
function paintText(text: string, options: { size: number; color: string; outline?: boolean;
  align?: "left" | "center"; lineGap?: number; middle?: boolean }) {
  return { text: "", paint: (context: CanvasRenderingContext2D, rect: Rect) => {
    context.save();
    context.font = `${options.size}px ${FONT}`;
    context.textBaseline = "top";
    context.textAlign = options.align ?? "left";
    const lines = wrapLicenseText(value => context.measureText(value).width, text, rect.width);
    const step = options.size + (options.lineGap ?? 4);
    const x = options.align === "center" ? rect.x + rect.width / 2 : rect.x;
    const top = options.middle ? rect.y + (rect.height - lines.length * step) / 2 : rect.y;
    lines.forEach((line, index) => {
      const y = top + index * step;
      if (options.outline) {
        context.lineWidth = 3;
        context.strokeStyle = "rgba(0,0,0,.85)";
        context.strokeText(line, x, y);
      }
      context.fillStyle = options.color;
      context.fillText(line, x, y);
    });
    context.restore();
  } };
}

function paintImage(image: Texture | undefined) {
  return image ? { paint: (context: CanvasRenderingContext2D, rect: { x: number; y: number; width: number; height: number }) =>
    context.drawImage(image.image, rect.x, rect.y, rect.width, rect.height) } : { visible: false };
}

/** The step window: what to do, the reward and 开始. */
export async function openLicenseStep(controller: ReadyLicenseController, stepId: number): Promise<void> {
  const lib = library(controller);
  const data = controller.licenseData;
  if (!lib || !data || controller.licenseBusy) return;
  const found = findOpenStep(data.table, data.state, stepId);
  if (!found) return;
  controller.licenseBusy = true;
  await ensureFeatureResources(controller.host.root, "license").catch(() => undefined);
  const started = generation(controller);
  try {
    const { view: stepView, level } = found;
    const step = stepView.step;
    const folder = String(step.step).padStart(2, "0");
    const [strings, raw, picture1, picture2] = await Promise.all([stageStrings(lib),
      F9(lib, READY_ROOT, "mq_window@zz") as Promise<StoryNode>,
      decodeStoryTexture(U1(lib, [`${READY_ROOT}/${folder}`], "01", ".jpg") as never, true).catch(() => undefined),
      decodeStoryTexture(U1(lib, [`${READY_ROOT}/${folder}`], "02", ".jpg") as never, true).catch(() => undefined)]);
    if (stale(controller, started)) return;
    const icon = `${stepIcon(step, level)}_1`;
    const definition = pruneMissingTextures(lib, mapTree(raw, node => {
      if (nodeName(node) === "missionIcon") return withAttributes(node, { texture: icon });
      // setCloseButton="goBackButton": the caption's close button, as stage_scenarioReady has it.
      if (nodeName(node) === "챌린지준비") return { ...node, children: [...node.children, CLOSE_BUTTON] };
      return undefined;
    }), READY_ROOTS);
    const reward = data.table.rewards.get(step.stockId) ?? "";
    const simplified = step.rule === "finish" ? "|（网页版暂无 AI 车手，到达终点即可通过）" : "";
    const limit = licenseTimeLimit(step);
    const description = (index: 1 | 2): string =>
      (strings.get(`step${step.step}_${index}`) ?? "") + (index === 2 ? simplified : "");
    const start = (): void => {
      controller.host.getInterfaceAudio()?.playClick();
      closeWindow(controller);
      void startLicenseRace(controller, step, level, started);
    };
    closeWindow(controller);
    const window = await te.load({
      library: lib, root: controller.host.root, definition, roots: READY_ROOTS, smoothImages: true,
      modal: true, label: `${TITLE}：${step.name}`,
      onCancel: () => closeWindow(controller), onConfirm: start,
      state: (node: StoryNode) => {
        switch (nodeName(node)) {
          case "subjectName":
            return { text: `${licenseName(level)}驾照  ${stepView.index + 1}. ${step.name}${
              limit > 0 ? `（限时 ${seconds(limit)}）` : ""}` };
          case "subjectTime":
            return limit > 0 ? { visible: true, text: `限时 ${seconds(limit)}` }
              : step.rule === "rival" ? { visible: true, text: `对手 ${formatLicenseTime(step.rivalMs ?? 0)}` }
                : { visible: false };
          case "subjectTexture1": return paintImage(picture1);
          case "subjectTexture2": return paintImage(picture2);
          case "subjectDesc1": return paintText(description(1), { size: 14, color: "white", outline: true });
          case "subjectDesc2": return paintText(description(2), { size: 14, color: "white", outline: true });
          case "rewardStockName": return { text: reward };
          case "clearMark": return { visible: stepView.cleared };
          case "missionTitle": return { text: step.name };
          case "시작": return { label: "开始", action: start };
          case "goBackButton": return { label: "关闭", action: () => closeWindow(controller) };
        }
        return {};
      },
    }) as WindowView;
    if (stale(controller, started)) {
      window.dispose();
      return;
    }
    window.show();
    controller.licenseWindow = window;
  } catch (error) {
    message(controller, `驾照考试：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    controller.licenseBusy = false;
  }
}

// ---------------------------------------------------------------------------
// The race

interface LicenseCourse { id: string; path: string }

/** A step's course: a time attack track, or a rider school course registered for the race. */
async function licenseCourse(lib: LicenseLibrary, step: { track: string; laps: number; name: string }):
  Promise<LicenseCourse> {
  const tracks = await lib.timeAttackTrackCatalog();
  const track = tracks.find(entry => entry.id.toLowerCase() === step.track.toLowerCase());
  if (track) return track;
  const folder = `track_/${step.track}/`.toLowerCase();
  const model = lib.mapAssets().find(file => file.virtualPath.toLowerCase() === `${folder}track.1s`);
  if (!model) throw new Error(`赛道 ${step.track} 不在本地资源中`);
  // track@zz.bml has no row for the rider school courses; the step names them.
  registerTrackMetadata({ id: step.track, gameType: "speed", laps: step.laps || 1, difficulty: 1,
    cnTitle: step.name, speedPool: false, theme: step.track.split("_")[0] });
  return { id: step.track, path: model.virtualPath };
}

async function rivalGhosts(lib: LicenseLibrary, step: LicenseStep, track: string,
  catalog: { karts: CatalogEntry[]; characters: CatalogEntry[] }): Promise<StoryGhostSource[]> {
  if (!step.rival) return [];
  const bytes = await (U1(lib, [OUTRUN_ROOT], step.rival.ksv, ".ksv") as ResourceFile).bytes();
  const name = /与(.+?)(?:的)?对决/.exec(step.name)?.[1];
  const mission = { kind: "Shadow", track, laps: step.laps, timeLimitMs: 0, speed: step.speed,
    rival: { kartId: step.rival.kartId, characterId: step.rival.characterId, ksv: step.rival.ksv,
      ...(name ? { name } : {}) } } as StoryMission;
  return storyGhostSources(bytes, track, mission, catalog as never).sources;
}

interface LicenseRaceSpec {
  track: { track: string; laps: number; name: string };
  speed: number;
  /** The practice kart instead of the rider's own. */
  practiceKart: boolean;
  ghosts: StoryGhostSource[];
  timeLimitMs: number;
  /** A 驾照考试 step's own mission (license-mission.ts); none for the PRO qualification. */
  license?: LicenseMissionSpec;
  judge(elapsedMs: number): boolean;
  onReturn(outcome: StoryRaceOutcome): void;
}

async function startRace(controller: ReadyLicenseController, spec: LicenseRaceSpec,
  returnLevel: number): Promise<void> {
  const lib = library(controller);
  if (!lib) return;
  const host = controller.host;
  const previous = host.getSelection();
  if (!previous) throw new Error("请先在计时赛选好车辆和人物。");
  const previousOptions = host.getReadyOptions();
  const [catalog, course] = await Promise.all([lib.timeAttackGarageCatalog(), licenseCourse(lib, spec.track)]);
  const kart = spec.practiceKart
    ? catalog.karts.find(entry => entry.systemKey === PRACTICE_KART) : undefined;
  if (spec.practiceKart && !kart) throw new Error("缺少练习用卡丁车。");
  const restore = (): void => {
    host.setSelection(previous);
    host.setReadyOptions(previousOptions);
    // Ready is rebuilt next; the 单人游戏 page covers it straight away.
    controller.homeRequested = true;
    controller.homePage = "single";
    controller.licenseReturnLevel = returnLevel;
  };
  const selection: ReadySelection = {
    ...previous,
    mapPath: course.path, trackId: course.id,
    ...(kart ? { vehiclePath: kart.path, vehicleItemId: kart.itemId, vehicleSystemKey: kart.systemKey } : {}),
    story: {
      ghosts: spec.ghosts,
      ...(spec.track.laps ? { laps: spec.track.laps } : {}),
      ...(spec.timeLimitMs > 0 ? { timeLimitMs: spec.timeLimitMs } : {}),
      ...(spec.license ? { license: spec.license } : {}),
      restore, judge: spec.judge, onReturn: spec.onReturn,
    },
  };
  const options: ReadyOptions = { ...previousOptions, speed: spec.speed, settingSpeed: spec.speed,
    version: "国服", booster: 0, showGhost: true };
  closeWindow(controller);
  await controller.startRaceFromReady(selection, options);
  if (!controller.disposed && host.shell.current === "Ready") {
    host.setSelection(previous);
    host.setReadyOptions(previousOptions);
    message(controller, "比赛未能开始，请重试。");
  }
}

async function startLicenseRace(controller: ReadyLicenseController, step: LicenseStep, level: number,
  started: number): Promise<void> {
  const lib = library(controller);
  if (!lib || stale(controller, started)) return;
  try {
    const [catalog, course] = await Promise.all([lib.timeAttackGarageCatalog(), licenseCourse(lib, step)]);
    const ghosts = await rivalGhosts(lib, step, course.id, catalog);
    if (stale(controller, started)) return;
    const license: LicenseMissionSpec = { step: step.step, mission: step.mission, rule: step.rule,
      setup: step.setup, progress: { objective: false } };
    await startRace(controller, {
      track: step, speed: step.speed || 7, practiceKart: true, ghosts,
      timeLimitMs: licenseTimeLimit(step), license,
      judge: elapsedMs => judgeLicenseRun(step, elapsedMs, license.progress.objective),
      onReturn: outcome => { void finishLicenseRun(controller, step, outcome, license); },
    }, level);
  } catch (error) {
    message(controller, `驾照考试：${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Back on the 单人游戏 page after a race, on the 驾照考试 tab. */
async function returnToLicense(controller: ReadyLicenseController): Promise<void> {
  await openReadyHome(controller, "single");
  for (let frame = 0; !controller.activeHome && controller.homeOpening && frame < 120; frame++)
    await new Promise(resolve => requestAnimationFrame(resolve));
  const view = controller.activeHome;
  if (!view) return;
  view.setPage("single");
  const level = controller.licenseReturnLevel;
  view.selectCategory("cat_riderSchool");
  if (level !== undefined) view.selectLicense(level);
}

const stripColor = (text: string): string => text.replace(/\[color:[^\]]*\]|\[\/color\]/g, "");

function failure(step: LicenseStep, outcome: StoryRaceOutcome, license: LicenseMissionSpec): string {
  if (step.rule === "drill") return "任务失败：没有按照提示完成全部驾驶练习（向前、向后、右转、左转）。";
  // An item mission's own objective (its targets) was not met.
  if (step.rule === "item" && !license.progress.objective && license.progress.failure &&
      !(licenseTimeLimit(step) > 0 && outcome.elapsedMs >= licenseTimeLimit(step)))
    return license.progress.failure;
  if (!outcome.finished || outcome.cleared === false) {
    return licenseTimeLimit(step) > 0 && outcome.elapsedMs >= licenseTimeLimit(step)
      ? "任务失败：没有在规定时间内完成。" : "任务失败：没有完成比赛。";
  }
  if (step.rule === "rival") return "任务失败：没有赢过对手。";
  return "任务失败：没有在规定时间内完成。";
}

async function finishLicenseRun(controller: ReadyLicenseController, step: LicenseStep,
  outcome: StoryRaceOutcome, license: LicenseMissionSpec): Promise<void> {
  await returnToLicense(controller);
  const cleared = outcome.cleared ??
    (outcome.finished && judgeLicenseRun(step, outcome.elapsedMs, license.progress.objective));
  if (!cleared) {
    message(controller, failure(step, outcome, license));
    return;
  }
  const session = activeBrowserSession();
  if (!session) return;
  try {
    const result = await runLicenseStep(session, { requestId: crypto.randomUUID(), step: step.step,
      elapsedMs: outcome.elapsedMs });
    if (controller.licenseData) controller.licenseData.state = result.state;
    await refreshLicenseMenu(controller);
    const lines = [`任务成功！记录 ${formatLicenseTime(outcome.elapsedMs)}`];
    if (result.run.reward) {
      const template = await baseString(controller, "riderSchoolGetRewardMsg") ??
        "恭喜获得驾照任务奖励%s。";
      lines.push(stripColor(template).replace("%s", result.run.reward.name));
    } else if (result.run.newBest) {
      lines.push("刷新了这一关的最佳记录。");
    }
    const data = controller.licenseData;
    const level = data?.table.licenses.find(entry => entry.steps.some(row => row.step === step.step))?.level;
    if (data && level !== undefined && licenseComplete(data.table, data.state, level) &&
        canTakeLicense(data.table, data.state, level))
      lines.push("所有任务都已完成，点击“获得驾照”按钮领取驾照吧！");
    message(controller, lines.join("\n"));
  } catch (error) {
    message(controller, licenseErrorMessage(error));
  }
}

const baseStrings = new WeakMap<object, Promise<Map<string, string>>>();

async function baseString(controller: ReadyLicenseController, key: string): Promise<string | undefined> {
  const lib = library(controller);
  if (!lib) return undefined;
  let pending = baseStrings.get(lib);
  if (!pending) {
    pending = Promise.resolve().then(async () => {
      const file = lib.canonicalCandidates("etc_/baseStringBag.xml")[0] as ResourceFile & { text?(): Promise<string> };
      const text = file?.text ? await file.text() : new TextDecoder().decode(await file!.bytes());
      const strings = new Map<string, string>();
      new DOMParser().parseFromString(text, "application/xml").querySelectorAll("k").forEach(entry => {
        const value = entry.querySelector('m[c="cn"]')?.getAttribute("v");
        const name = entry.getAttribute("n");
        if (name && value) strings.set(name, value);
      });
      return strings;
    });
    pending.catch(() => baseStrings.delete(lib));
    baseStrings.set(lib, pending);
  }
  return (await pending.catch(() => new Map<string, string>())).get(key);
}

// ---------------------------------------------------------------------------
// Taking a license (dialog2_licenseCard) and the PRO qualification

export async function takeLicenseLevel(controller: ReadyLicenseController, level: number): Promise<void> {
  const session = activeBrowserSession();
  if (!session || controller.licenseBusy) return;
  controller.licenseBusy = true;
  try {
    const taken = await takeLicense(session, level);
    if (controller.licenseData) controller.licenseData.state = taken.state;
    await refreshLicenseMenu(controller);
    await openLicenseCard(controller, level, taken.proUntil);
  } catch (error) {
    message(controller, licenseErrorMessage(error));
  } finally {
    controller.licenseBusy = false;
  }
}

async function openLicenseCard(controller: ReadyLicenseController, level: number, proUntil: number): Promise<void> {
  const lib = library(controller);
  if (!lib) return;
  const started = generation(controller);
  const [raw, card] = await Promise.all([F9(lib, CARD_ROOT, "licenseCard@zz") as Promise<StoryNode>,
    F9(lib, CARD_ROOT, "licenseCard_stringBag").then(bag => readMainMenuStrings(bag as MainMenuNode))
      .catch(() => new Map<string, string>())]);
  if (stale(controller, started)) return;
  const roots = [CARD_ROOT, "stage_/common"];
  const definition = pruneMissingTextures(lib, mapTree(raw, node =>
    nodeName(node) === "bg" ? withAttributes(node, { texture: `bg_Level${level}@zz` }) : undefined), roots);
  const summary = activeBrowserSession()?.summary();
  const created = summary?.account.createdAt ? formatDate(summary.account.createdAt).slice(0, 10) : "";
  const text = (level === PRO_LEVEL ? card.get("updateLevelText6") : card.get("updateLevelText"))
    ?.replace("%s", licenseName(level)) ?? `获得了${licenseName(level)}驾照`;
  closeWindow(controller);
  const window = await te.load({
    library: lib, root: controller.host.root, definition, roots, smoothImages: true, modal: true,
    label: card.get("updateLevelCaption") ?? TITLE,
    onCancel: () => closeWindow(controller), onConfirm: () => closeWindow(controller),
    state: (node: StoryNode) => {
      switch (nodeName(node)) {
        case "name": return { text: summary?.account.nickname ?? "" };
        case "createTime": return { text: created };
        case "level": return { text: `${licenseName(level)}驾照` };
        case "pro": return { visible: level === PRO_LEVEL };
        case "proLevelExpire": return { text: proUntil ? formatDate(proUntil) : "" };
        case "updateLevelText": return { visible: true,
          ...paintText(text, { size: 14, color: "black", align: "center", lineGap: 2, middle: true }) };
        case "OK": return { label: "确定", action: () => closeWindow(controller) };
      }
      return {};
    },
  }) as WindowView;
  if (stale(controller, started)) {
    window.dispose();
    return;
  }
  window.show();
  controller.licenseWindow = window;
}

/** A PRO qualification time trial on the rider's own kart at 标准. */
export async function startLicenseQualify(controller: ReadyLicenseController, track: string): Promise<void> {
  const data = controller.licenseData;
  const lib = library(controller);
  const q = data?.table.pro.qualify.find(entry => entry.track === track);
  if (!data || !lib || !q || controller.licenseBusy) return;
  if (data.state.baseLevel < PRO_LEVEL - 1) {
    message(controller, "获得L1驾照后才能进行PRO等级挑战资格审核。");
    return;
  }
  if (data.state.qualified) return;
  const started = generation(controller);
  try {
    await startRace(controller, {
      track: { track: q.track, laps: 0, name: q.track }, speed: q.speed || 7, practiceKart: false, ghosts: [],
      timeLimitMs: 0,
      judge: elapsedMs => elapsedMs <= q.timeMs,
      onReturn: outcome => { void finishQualify(controller, q.track, q.timeMs, outcome); },
    }, PRO_LEVEL);
  } catch (error) {
    if (!stale(controller, started))
      message(controller, `资格审核：${error instanceof Error ? error.message : String(error)}`);
  }
}

async function finishQualify(controller: ReadyLicenseController, track: string, limitMs: number,
  outcome: StoryRaceOutcome): Promise<void> {
  await returnToLicense(controller);
  if (!outcome.finished) {
    message(controller, "没有完成比赛，记录未更新。");
    return;
  }
  const session = activeBrowserSession();
  if (!session) return;
  try {
    const result = await qualifyLicense(session, { requestId: crypto.randomUUID(), track,
      elapsedMs: outcome.elapsedMs });
    if (controller.licenseData) controller.licenseData.state = result.state;
    await refreshLicenseMenu(controller);
    const lines = [`记录 ${formatLicenseTime(outcome.elapsedMs)}（要求 ${formatLicenseTime(limitMs)} 以内）`];
    lines.push(outcome.elapsedMs <= limitMs ? "达成了这项条件！" : "还没有达成这项条件，再试一次吧。");
    const data = controller.licenseData;
    if (data && !data.state.qualified &&
        data.table.pro.qualify.every(q => (data.state.records.get(q.track) ?? Infinity) <= q.timeMs))
      lines.push("三项条件都已达成，点击“获得徽章”领取PRO等级挑战资格。");
    message(controller, lines.join("\n"));
  } catch (error) {
    message(controller, licenseErrorMessage(error));
  }
}

export async function claimProEmblem(controller: ReadyLicenseController): Promise<void> {
  const session = activeBrowserSession();
  if (!session || controller.licenseBusy) return;
  controller.licenseBusy = true;
  try {
    const result = await claimLicenseEmblem(session);
    if (controller.licenseData) controller.licenseData.state = result.state;
    await refreshLicenseMenu(controller);
    message(controller, "获得了PRO等级挑战资格徽章！\nPRO等级挑战任务已开放。");
  } catch (error) {
    message(controller, licenseErrorMessage(error));
  } finally {
    controller.licenseBusy = false;
  }
}
