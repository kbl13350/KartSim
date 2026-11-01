import { decodeBinaryXml, type BinaryXmlNode } from "../codecs/binary-xml";
import { parseResourceXml } from "../resources/xml-utf16-parser";
import { decodePngRgba } from "../resources/png-decoder";
import { gameLocale, resourceText, tr } from "../i18n/locale";
import { Ft } from "../generated/formats.js";
import { U1 } from "../generated/library.js";
import { stateImageName } from "../ui/rider-school-art";

/** Release training-center lessons, read from the mounted P3553 resources. */
export interface TrainingNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: TrainingNode[];
}
interface ResourceFile { bytes(): Promise<Uint8Array> }
export interface TrainingLibrary { canonicalCandidates(path: string): ResourceFile[] }
export interface TrainingTexture { image: CanvasImageSource; width: number; height: number }
export type TrainingTextureLoader = (roots: string[], name: string) => Promise<TrainingTexture | undefined>;
export type TrainingLevel = 1 | 2 | 3;
export interface TrainingSubject { title: string; description: string; imagePath: string }
export interface TrainingLesson {
  /** Original category and step, e.g. 11 (basic/start boost), 34 (special/charger). */
  id: string;
  level: TrainingLevel;
  step: number;
  title: string;
  icon: string;
  track: string;
  kartId: number;
  type: number;
  rewardStockId: number;
  /** Every original mission option, including time, detectSkill and detectCheckNum. */
  parameters: Record<string, string>;
  subjects: TrainingSubject[];
  missions: Array<{ phase: number; items: Array<{ id: number; key: string }> }>;
}
export interface TrainingLevelEntry { level: TrainingLevel; title: string; lessons: TrainingLesson[] }
export interface TrainingCatalog {
  levels: TrainingLevelEntry[];
  lessons: TrainingLesson[];
  page: TrainingNode;
  card: TrainingNode;
  ready: TrainingNode;
  strings: Map<string, string>;
}
export interface TrainingPageArt {
  page: TrainingNode;
  card: TrainingNode;
  frames: Array<{ texture: string }>;
  frameImages: Map<string, TrainingTexture>;
  textures: Map<TrainingNode, TrainingTexture[]>;
  icons: Map<string, TrainingTexture[]>;
}
export interface TrainingLessonArt {
  subjects: Array<TrainingSubject & { image: TrainingTexture }>;
  backdrop?: TrainingTexture;
  titleBar?: TrainingTexture;
}

export const TRAINING_PAGE_ROOT = "stage_/mainMenu/trainingCenter";
export const TRAINING_READY_ROOT = "stage_/trainingCenterReady";
export const TRAINING_ROOTS = [TRAINING_PAGE_ROOT, "stage_/mainMenu/riderSchool", "stage_/mainMenu",
  "stage_/common", "zeta_/cn/stage/mainMenu"];
const attr = (node: TrainingNode, name: string): string | undefined =>
  node.attributes.find(item => item.name === name)?.value;
const mutableNode = (source: BinaryXmlNode): TrainingNode => ({ ...source,
  attributes: source.attributes.map(item => ({ ...item })), children: source.children.map(mutableNode) });
const node = (bytes: Uint8Array): TrainingNode => mutableNode(decodeBinaryXml(bytes));
const find = (library: TrainingLibrary, roots: string[], name: string, extension = ".png"): ResourceFile =>
  U1(library, roots, name, extension) as ResourceFile;
const readLayout = async (library: TrainingLibrary, root: string, name: string): Promise<TrainingNode> =>
  node(await find(library, [root], name, ".bml").bytes());
const names: Record<string, readonly [string, string, string]> = {
  "11": ["起步加速", "Start boost", "출발 부스터"],
  "12": ["漂移及加速器", "Drift and boost", "드리프트 & 부스터"],
  "13": ["点漂", "Short drift", "숏 드리프트"],
  "14": ["最佳化漂移", "Optimized drift", "최적화 드리프트"],
  "21": ["点漂接长漂", "Short-to-full drift", "숏풀 드리프트"],
  "22": ["断位漂移", "Cutting drift", "커팅 드리프트"],
  "23": ["快拉", "Short cutting drift", "숏커팅 드리프트"],
  "24": ["拖漂", "Drag drift", "끌기 드리프트"],
  "31": ["尾流", "Drafting", "드래프트"],
  "32": ["双涡轮增压加速", "Dual booster", "듀얼 부스터"],
  "33": ["超负荷系统", "Exceed system", "익시드 시스템"],
  "34": ["赋能系统", "Charger system", "차저 시스템"],
};
const english: Record<string, readonly [string, string]> = {
  "11_1": ["Using start boost", "3, 2, 1, go! Hold the forward key just as the countdown ends to trigger a start boost."],
  "12_1": ["Drifting and mini boost", "Press SHIFT while steering left or right to drift. Countersteer to end the drift, then press the forward key again to trigger a mini boost."],
  "12_2": ["Charging and using boost", "Fill the boost gauge by drifting, then press CTRL to use the booster item."],
  "13_1": ["Using short drift", "Briefly tap SHIFT while steering left or right to get a feel for short drifts."],
  "14_1": ["Drifting with minimal speed loss", "Start steering before pressing drift, then countersteer during the drift to lose as little speed as possible."],
  "14_2": ["", "Try to keep the tire marks parallel without overlapping them."],
  "21_1": ["Linking a short and full drift", "Follow a short drift immediately with a full drift to charge a large amount of boost."],
  "21_2": ["", "Use this technique on most corners when you need a little more boost charge. It can give you two boosters in one corner."],
  "22_1": ["Using cutting drift", "During a drift, quickly make a short drift in the opposite direction to straighten the kart. Use it to end a drift quickly or charge boost on a straight."],
  "23_1": ["Using short cutting drift", "Keep holding the drift key and press the opposite direction to straighten the kart."],
  "23_2": ["", "This variation on cutting drift makes it easier to charge boost on straights and straighten the kart quickly. Practice in both directions!"],
  "24_1": ["Using drag drift", "Before an optimized drift ends, tap the steering key in the direction of the drift to extend it."],
  "24_2": ["", "Holding a precise drag drift reduces speed loss and can add acceleration depending on the kart's drift performance."],
  "31_1": ["Using drafting", "Drive closely behind an opponent to activate drafting."],
  "31_2": ["", "A full draft gauge triggers a burst of acceleration. Use it to overtake the opponent."],
  "32_1": ["Using the dual booster", "A second acceleration stage can activate while a booster is running."],
  "32_2": ["", "Select automatic or manual dual boost in Settings. Manual activation lets you choose the moment to use it."],
  "33_1": ["Using the Exceed system", "The Exceed gauge charges above a certain speed. Press SPACE or X to spend the gauge for an instant burst of acceleration."],
  "33_2": ["", "Use Exceed to recover speed after a collision or driving off-road. Activating it during boost provides acceleration beyond the usual top speed."],
  "34_1": ["Using the charger system", "The charger system helps manage the booster and Exceed gauges."],
  "34_2": ["", "While the charger is active, it can restore boost charge lost in wall collisions and increase Exceed charge during boost or collisions."],
};

export function readTrainingStrings(tree: TrainingNode): Map<string, string> {
  const strings = new Map<string, string>();
  for (const entry of tree.children) {
    const key = attr(entry, "n");
    const value = resourceText(entry.children, attr);
    if (key && value !== undefined) strings.set(key, value.replace(/\|/g, "\n"));
  }
  return strings;
}

export async function loadTrainingCatalog(library: TrainingLibrary): Promise<TrainingCatalog> {
  const xml = async (name: string): Promise<TrainingNode> =>
    parseResourceXml(await find(library, ["etc_/trainingCenter"], `${name}@cn`, ".xml").bytes()).root;
  const [source, locale, mission, page, card, ready, bag] = await Promise.all([
    xml("trainingCenter"), xml("trainingCenterLocale"), xml("trainingCenterMission"),
    readLayout(library, TRAINING_PAGE_ROOT, "trainingCenterPage@zz"),
    readLayout(library, TRAINING_PAGE_ROOT, "trainingCenterStepCard"),
    readLayout(library, TRAINING_READY_ROOT, "mq_window@zz"),
    readLayout(library, TRAINING_READY_ROOT, "stage_stringBag"),
  ]);
  const strings = readTrainingStrings(bag);
  const nameIndex = gameLocale() === "en" ? 1 : gameLocale() === "ko" ? 2 : 0;
  const levels: TrainingLevelEntry[] = [];
  for (const category of source.children.filter(child => child.name === "itemCat")) {
    const level = Number(attr(category, "id")) as TrainingLevel;
    if (![1, 2, 3].includes(level)) throw new Error(`Unknown training category ${level}`);
    const rewards = locale.children.find(child => attr(child, "id") === String(level));
    const lessons = category.children.filter(child => child.name === "item").map(item => {
      const parameters = Object.fromEntries(item.attributes.map(value => [value.name, value.value]));
      const step = Number(parameters.step);
      const id = `${level}${step}`;
      const titles = names[id];
      if (!titles || !parameters.track || !parameters.icon) throw new Error(`Incomplete training lesson ${id}`);
      const subjects: TrainingSubject[] = [];
      for (let part = 1; part <= 2; part++) {
        const key = `${id}_${part}`;
        const description = gameLocale() === "en" ? english[key]?.[1] : strings.get(`desc${key}`);
        if (!description) continue;
        subjects.push({ title: gameLocale() === "en" ? english[key]?.[0] ?? "" : strings.get(`step${key}`) ?? "",
          description, imagePath: `${TRAINING_READY_ROOT}/${id}/${String(part).padStart(2, "0")}@cn.png` });
      }
      if (subjects.length === 0) throw new Error(`Training lesson ${id} has no explanation`);
      const reward = rewards?.children.find(child => attr(child, "step") === String(step));
      const missionCategory = mission.children.find(child => attr(child, "catId") === String(level) &&
        attr(child, "step") === String(step));
      return { id, level, step, title: titles[nameIndex], icon: parameters.icon,
        track: parameters.track, kartId: Number(parameters.kartId), type: Number(parameters.type),
        rewardStockId: Number(reward && attr(reward, "rewardStockId")), parameters, subjects,
        missions: (missionCategory?.children ?? []).map(phase => ({
          phase: Number(attr(phase, "missionPhase")), items: phase.children.map(item => ({
            id: Number(attr(item, "missionId")), key: attr(item, "missionText") ?? "" })),
        })) } satisfies TrainingLesson;
    });
    levels.push({ level, title: tr(["基础驾驶技巧", "高级驾驶技巧", "特殊驾驶技巧"][level - 1]!), lessons });
  }
  const lessons = levels.flatMap(level => level.lessons);
  if (levels.length !== 3 || lessons.length !== 12) throw new Error("Training center requires three categories of four lessons");
  return { levels, lessons, page, card, ready, strings };
}

export async function loadTrainingPageArt(library: TrainingLibrary, texture: TrainingTextureLoader,
  frameTree: () => Promise<TrainingNode>, catalog?: TrainingCatalog): Promise<TrainingPageArt> {
  const data = catalog ?? await loadTrainingCatalog(library);
  const textures = new Map<TrainingNode, TrainingTexture[]>();
  const visit = async (node: TrainingNode): Promise<void> => {
    const single = attr(node, "texture") ?? attr(node, "image");
    if (single) {
      const image = await texture(TRAINING_ROOTS, single);
      if (image) textures.set(node, [image]);
    }
    await Promise.all(node.children.map(visit));
  };
  const frames = (await frameTree()).children.find(child => child.name === "RiderSchoolButton")?.children
    .map(child => Ft(child) as { texture: string }) ?? [];
  const frameImages = new Map<string, TrainingTexture>();
  await Promise.all([...new Set(frames.map(frame => frame.texture))].map(async name => {
    const image = await texture(["gui_/monocoque"], name);
    if (image) frameImages.set(name, image);
  }));
  const icons = new Map<string, TrainingTexture[]>();
  await Promise.all([visit(data.page), visit(data.card), ...data.lessons.map(async lesson => {
    const states = await Promise.all([1, 2, 3, 4].map(index =>
      texture(TRAINING_ROOTS, stateImageName(`${lesson.icon}_`, index))));
    if (states.every(Boolean)) icons.set(lesson.id, states as TrainingTexture[]);
  })]);
  return { page: data.page, card: data.card, frames, frameImages, textures, icons };
}

async function decodeTexture(file: ResourceFile): Promise<TrainingTexture> {
  const decoded = await decodePngRgba(await file.bytes());
  const canvas = document.createElement("canvas");
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(decoded.pixels),
    decoded.width, decoded.height), 0, 0);
  return { image: canvas, width: decoded.width, height: decoded.height };
}

export async function loadTrainingLessonArt(library: TrainingLibrary, lesson: TrainingLesson,
  texture?: TrainingTextureLoader): Promise<TrainingLessonArt> {
  const load: TrainingTextureLoader = texture ?? (async (roots, name) => decodeTexture(find(library, roots, name)));
  const subjects = await Promise.all(lesson.subjects.map(async subject => {
    const slash = subject.imagePath.lastIndexOf("/");
    const image = await load([subject.imagePath.slice(0, slash)], subject.imagePath.slice(slash + 1, -4));
    if (!image) throw new Error(`Missing training illustration ${subject.imagePath}`);
    return { ...subject, image };
  }));
  const [backdrop, titleBar] = await Promise.all([load([TRAINING_READY_ROOT], "img_playerBG"),
    load([TRAINING_READY_ROOT], "timeAttack_main_practiceTitleBg")]);
  return { subjects, backdrop, titleBar };
}
