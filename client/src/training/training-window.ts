import { C8, te } from "../generated/library.js";
import { tr } from "../i18n/locale";
import { mapTree, node, nodeName, paintText, prepare, resolveStrings, withAttributes,
  type BmlLibrary, type Node, type NodeState, type Rect, type WindowView } from "../ui/bml-kit";
import { button } from "../ui/resource-window";
import { loadTrainingLessonArt, type TrainingCatalog, type TrainingLesson } from "./training-catalog";

export interface TrainingWindowHandle { readonly element: HTMLElement; dispose(): void }

export interface TrainingWindowOptions {
  library: BmlLibrary;
  root: HTMLElement;
  catalog: TrainingCatalog;
  lesson: TrainingLesson;
  onStart(): void;
  onClose(): void;
  onActivate?(): void;
}

const ROOTS = ["stage_/trainingCenterReady", "stage_/mainMenu/trainingCenter", "stage_/mainMenu/riderSchool", "stage_/common"];

/** The original training ready window, with illustrated lessons in its demonstration area. */
export async function openTrainingLesson(options: TrainingWindowOptions): Promise<TrainingWindowHandle> {
  const { library, lesson, catalog } = options;
  const art = await loadTrainingLessonArt(library, lesson);
  let page = 0;
  let disposed = false;
  let view: WindowView | undefined;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    view?.element.removeEventListener("keydown", onKeyDown, true);
    view?.dispose();
  };
  const close = (): void => { if (disposed) return; options.onActivate?.(); dispose(); options.onClose(); };
  const start = (): void => { if (disposed) return; options.onActivate?.(); dispose(); options.onStart(); };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "F5") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    start();
  };
  const label = (name: string, rect: string): Node => node("Label", { name, leftTopWH: rect });
  const definition = mapTree(resolveStrings(catalog.ready, catalog.strings), entry => {
    const key = nodeName(entry);
    // Training rewards belong to the original mission evaluator. This page opens free practice.
    if (entry.children.some(child => nodeName(child) === "rewardBg"))
      return withAttributes(entry, { visible: "false" });
    if (/^subjectTexture[12]$/.test(key)) return withAttributes(entry, { texture: undefined });
    if (key === "missionIcon") return withAttributes(entry, { texture: `${lesson.icon}_1` });
    if (key === "subjectName1" || key === "subjectName2") return withAttributes(entry, { text: "" });
    if (key !== "trainingCenter") return undefined;
    return { ...withAttributes(entry, { caption: lesson.title, setCloseButton: "closeButton" }), children: [
      ...entry.children,
      node("Container", { name: "learning", leftTopWH: "24 24 864 622" }, [
        label("learningTitle", "18 10 828 48"),
        label("learningImage", "28 94 808 324"),
        label("learningDescription", "36 448 792 112"),
        node("TextButton", { name: "lessonPrevious", leftTopWH: "258 578 120 32", textRender: "bold16" }),
        label("lessonPage", "384 578 96 32"),
        node("TextButton", { name: "lessonNext", leftTopWH: "486 578 120 32", textRender: "bold16" }),
      ]),
      label("learningPracticeInfo", "430 674 570 54"),
    ] };
  });
  const decorate = async (entry: Node): Promise<Node> => entry.name === "CaptionWindow"
    ? await C8(library, entry, ROOTS[0]) as Node
    : { ...entry, children: await Promise.all(entry.children.map(decorate)) };
  const decorated = await decorate(definition);
  const tree = prepare(library, decorated, ROOTS);
  const subjectState = (index: number, kind: "name" | "image" | "description"): NodeState => {
    const subject = art.subjects[index];
    if (!subject) return { visible: false };
    if (kind === "image") return { paint: (context: CanvasRenderingContext2D, rect: Rect) =>
      context.drawImage(subject.image.image, rect.x, rect.y, rect.width, rect.height) };
    return paintText(kind === "name" ? subject.title : subject.description,
      { size: kind === "name" ? 17 : 14, color: "white", bold: true, lineGap: 5 });
  };
  const state = (entry: Node): NodeState => {
    const key = nodeName(entry);
    const subject = art.subjects[page]!;
    const original = /^subject(Name|Texture|Desc)([12])$/.exec(key);
    if (original) return subjectState(Number(original[2]) - 1,
      original[1] === "Name" ? "name" : original[1] === "Texture" ? "image" : "description");
    if (/^subject[12]$/.test(key)) return { visible: Number(key.at(-1)) <= art.subjects.length };
    switch (key) {
      case "learningTitle": return paintText(subject.title || lesson.title,
        { size: 26, color: "white", bold: true, align: "center", middle: true });
      case "learningImage": return { paint: (context: CanvasRenderingContext2D, rect: Rect) => {
        context.drawImage(subject.image.image, rect.x, rect.y, rect.width, rect.height);
      } };
      case "learningDescription": return paintText(subject.description,
        { size: 22, color: "white", bold: true, lineGap: 10 });
      case "lessonPage": return paintText(`${page + 1} / ${art.subjects.length}`,
        { size: 17, color: "white", middle: true, align: "center" });
      case "lessonPrevious": return button("上一页", () => { page--; view?.render(); }, page === 0);
      case "lessonNext": return button("下一页", () => { page++; view?.render(); }, page >= art.subjects.length - 1);
      case "missionTitle": return paintText(lesson.title, { size: 16, color: "rgb(42,55,80)", middle: true });
      case "learningPracticeInfo": return paintText(tr("自由练习 · 不计闯关奖励"),
        { size: 17, color: "rgb(42,55,80)", middle: true, align: "center" });
      case "시작": return { label: tr("自由练习"), action: start };
      case "goBackButton":
      case "closeButton": return { label: tr("关闭"), action: close };
      default: return {};
    }
  };
  view = await te.load({ library, root: options.root, definition: tree, roots: ROOTS,
    smoothImages: true, modal: true, label: lesson.title, onCancel: close, state }) as WindowView;
  view.element.dataset.uiPage = "training-lesson";
  view.element.addEventListener("keydown", onKeyDown, true);
  view.show();
  view.focus("시작");
  return { element: view.element, dispose };
}
