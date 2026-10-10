import { T } from "../generated/formats.js";
import { C8, F9, h2, te } from "../generated/library.js";
import {
  ImageCache, emblemIconPath, loadEmblemTable, type EmblemInfo, type MyRoomDataLibrary,
} from "../myroom/myroom-data";
import type { EmblemSummary } from "../myroom/myroom-api";

/**
 * The release emblem windows (dialog.rho/roomEmblem): mq_dialog@zz 查看我的徽章
 * for the owner (two representative slots over a 6x2 owned-emblem grid) and
 * otherEmblemDialog@zz 查看徽章 for a visitor. The grid repeats cardTemplate
 * per cell; hovering a card shows its name and description (emblemInfoCard).
 */

export interface EmblemNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: EmblemNode[];
}

export interface MyRoomEmblemOptions {
  library: MyRoomDataLibrary;
  root: HTMLElement;
  summary: EmblemSummary;
  /** The owner's window lets the player choose representative emblems. */
  editable: boolean;
  /** Saves the representative emblems; resolves the updated summary. */
  onSave?(main: [number, number]): Promise<EmblemSummary>;
  /** A release notice (已选择的徽章, 没有多余的徽章槽。, 修改成功). */
  notice(message: string): void;
  onClose(): void;
}

export interface MyRoomEmblemDialog { dispose(): void }

const FOLDER = "dialog/roomEmblem";
const PAGE_SIZE = 12;
const COLUMNS = 6;
const CARD = 80;
const GAP = 10;

/** dialog/roomEmblem dialog_stringBag (cn); the renderer reads only stage_/dialog_ bags. */
export const EMBLEM_STRINGS: Record<string, string> = {
  dialogTitle: "查看徽章",
  dialogMyTitle: "查看我的徽章",
  comment: "可以浏览已拥有的徽章",
  emblemCount: "拥有徽章数量 ： %d个",
  alreadyEmblem: "已选择的徽章",
  notEmptySlot: "没有多余的徽章槽。",
  emptyEmblem: "前面徽章槽不能为空",
  success: "修改成功",
  mainEmblemComment: "要使用的代表徽章",
  desc: "*可以通过点击拥有徽章，选择“代表徽章”|*要想更换“代表徽章”，请点击相应徽章",
  ok: "确定",
  cancel: "取消",
};

const name = (node: EmblemNode): string | undefined => T(node, "name") as string | undefined;

function sbKey(value: string | undefined): string | undefined {
  return /^#sb\(([^)]+)\)$/.exec(value ?? "")?.[1];
}

/** Pick an owned emblem as representative: the first empty slot takes it. */
export function chooseMainEmblem(main: [number, number], id: number):
  { main: [number, number] } | { refused: "alreadyEmblem" | "notEmptySlot" } {
  if (main.includes(id)) return { refused: "alreadyEmblem" };
  if (main[0] === 0) return { main: [id, main[1]] };
  if (main[1] === 0) return { main: [main[0], id] };
  return { refused: "notEmptySlot" };
}

/** Clear a representative slot; the second moves up so the first is never empty. */
export function clearMainEmblem(main: [number, number], slot: 0 | 1): [number, number] {
  return slot === 0 ? [main[1], 0] : [main[0], 0];
}

/** The grid's cells as cardTemplate copies at their GridSelector places. */
function gridWithCards(grid: EmblemNode, card: EmblemNode): EmblemNode {
  const cards = Array.from({ length: PAGE_SIZE }, (_, index) => {
    const x = (index % COLUMNS) * (CARD + GAP);
    const y = Math.floor(index / COLUMNS) * (CARD + GAP);
    const icon = card.children[0]!;
    return h2(card, { name: `emblemCard${index}`, windowRect: `${x} ${y} ${x + CARD} ${y + CARD}` },
      [h2(icon, { name: `emblemIcon${index}` }) as EmblemNode]) as EmblemNode;
  });
  return { ...grid, children: cards };
}

function transform(node: EmblemNode, card: EmblemNode): EmblemNode {
  if (node.name === "GridSelector" && name(node) === "emblemList") return gridWithCards(node, card);
  // "1 / 2" sits between the page arrows; left-aligned its first digit hides under ◀.
  if (node.name === "Label" && name(node) === "page")
    return h2(node, { textAlign: "center" }) as EmblemNode;
  return { ...node, children: node.children.map(child => transform(child, card)) };
}

function wrapLines(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const character of text) {
    if (line && context.measureText(line + character).width > width) {
      lines.push(line);
      line = "";
    }
    line += character;
  }
  if (line) lines.push(line);
  return lines;
}

export async function openMyRoomEmblems(options: MyRoomEmblemOptions): Promise<MyRoomEmblemDialog> {
  const file = options.editable ? "mq_dialog@zz" : "otherEmblemDialog@zz";
  const [raw, cardTemplate, table] = await Promise.all([
    F9(options.library, FOLDER, file) as Promise<EmblemNode>,
    F9(options.library, FOLDER, "cardTemplate") as Promise<EmblemNode>,
    loadEmblemTable(options.library),
  ]);
  const transformed = transform(raw, cardTemplate);
  const decorate = async (node: EmblemNode): Promise<EmblemNode> => node.name === "CaptionWindow"
    ? await C8(options.library, node, FOLDER) as EmblemNode
    : { ...node, children: await Promise.all(node.children.map(decorate)) };
  const tooltip: EmblemNode = { name: "Container",
    attributes: [{ name: "name", value: "emblemTooltip" }, { name: "windowRect", value: "0 0 1 1" }],
    children: [] };
  const decorated = await decorate(transformed);
  const definition = { ...decorated, children: [...decorated.children, tooltip] };

  let summary = options.summary;
  let main: [number, number] = [...summary.main];
  let page = 0;
  let busy = false;
  let disposed = false;
  const cardRects = new Map<number, { x: number; y: number; width: number; height: number }>();
  let view!: { render(): void; show(): void; focus(name?: string): void; dispose(): void;
    hovered?: EmblemNode; disposed?: boolean };
  const icons = new ImageCache(options.library, () => { if (!disposed) view?.render(); });
  const pages = () => Math.max(1, Math.ceil(summary.emblems.length / PAGE_SIZE));
  const emblemAt = (index: number) => summary.emblems[page * PAGE_SIZE + index]?.id;
  const info = (id: number): EmblemInfo | undefined => table.get(id);
  const paintIcon = (id: number) => (context: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number }) => {
    const icon = id ? icons.get(emblemIconPath(id)) : undefined;
    if (icon) context.drawImage(icon, rect.x, rect.y, rect.width, rect.height);
  };
  const close = () => {
    if (busy) return;
    dispose();
    options.onClose();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    view?.dispose();
  };
  const save = async () => {
    if (!options.editable || busy) {
      close();
      return;
    }
    if (main[0] === summary.main[0] && main[1] === summary.main[1]) {
      close();
      return;
    }
    busy = true;
    view.render();
    try {
      summary = await options.onSave!(main);
      main = [...summary.main];
      options.notice(EMBLEM_STRINGS.success!);
      busy = false;
      close();
    } catch (error) {
      busy = false;
      if (!disposed) view.render();
      throw error;
    }
  };
  const pick = (id: number) => {
    if (!options.editable || busy) return;
    const result = chooseMainEmblem(main, id);
    if ("refused" in result) options.notice(EMBLEM_STRINGS[result.refused]!);
    else main = result.main;
    view.render();
  };

  view = await te.load({
    library: options.library, root: options.root, definition,
    roots: [FOLDER, "stage_/common", "stage_/myRoom"],
    preserveDisplayPixels: true, smoothImages: true, modal: true,
    label: options.editable ? EMBLEM_STRINGS.dialogMyTitle : EMBLEM_STRINGS.dialogTitle,
    onCancel: close,
    onConfirm: () => { void save().catch(() => undefined); },
    state: (node: EmblemNode) => {
      const nodeName = name(node) ?? "";
      if (node.name === "CaptionWindow" && nodeName === "roomEmblemFrame") {
        const title = options.editable ? EMBLEM_STRINGS.dialogMyTitle! : EMBLEM_STRINGS.dialogTitle!;
        return { text: options.editable ? title : `${summary.nickname} ${title}` };
      }
      const card = /^emblemCard(\d+)$/.exec(nodeName);
      if (card) {
        const index = Number(card[1]);
        const id = emblemAt(index);
        if (id === undefined) return { visible: false };
        const emblem = info(id);
        return { label: emblem?.name ?? String(id), disabled: busy,
          action: () => pick(id),
          paint: (_context: CanvasRenderingContext2D, rect: { x: number; y: number; width: number; height: number }) => {
            cardRects.set(index, rect);
          } };
      }
      const icon = /^emblemIcon(\d+)$/.exec(nodeName);
      if (icon) {
        const id = emblemAt(Number(icon[1]));
        return id === undefined ? { visible: false } : { paint: paintIcon(id) };
      }
      const slot = /^mainEmblem([01])$/.exec(nodeName);
      if (slot) {
        const index = Number(slot[1]) as 0 | 1;
        const id = main[index]!;
        return { paint: paintIcon(id), label: id ? info(id)?.name ?? String(id) : "空的代表徽章槽",
          ...(options.editable && id ? { action: () => {
            if (busy) return;
            main = clearMainEmblem(main, index);
            view.render();
          } } : {}) };
      }
      switch (nodeName) {
        case "emblemCount":
          return { text: EMBLEM_STRINGS.emblemCount!.replace("%d", String(summary.emblems.length)) };
        case "page": return { text: `${page + 1} / ${pages()}` };
        case "prevPage": return { label: "上一页", disabled: page <= 0,
          action: () => { page = Math.max(0, page - 1); view.render(); } };
        case "nextPage": return { label: "下一页", disabled: page >= pages() - 1,
          action: () => { page = Math.min(pages() - 1, page + 1); view.render(); } };
        case "OK": return { label: EMBLEM_STRINGS.ok, disabled: busy,
          ...(node.name === "TextButton" ? { text: EMBLEM_STRINGS.ok } : {}),
          action: () => { void save().catch(() => undefined); } };
        // setCloseButton="Cancel" also names the caption's close button.
        case "Cancel": return { label: EMBLEM_STRINGS.cancel, disabled: busy,
          ...(node.name === "TextButton" ? { text: EMBLEM_STRINGS.cancel } : {}), action: close };
        case "emblemTooltip": return { paint: (context: CanvasRenderingContext2D) => {
          const hovered = view?.hovered ? /^emblemCard(\d+)$/.exec(name(view.hovered) ?? "") : null;
          if (!hovered) return;
          const index = Number(hovered[1]);
          const id = emblemAt(index);
          const rect = cardRects.get(index);
          const emblem = id === undefined ? undefined : info(id);
          if (!emblem || !rect) return;
          drawTooltip(context, emblem, rect, id === undefined ? undefined : icons.get(emblemIconPath(id)));
        } };
      }
      const key = sbKey(T(node, node.name === "CaptionWindow" ? "caption" : "text") as string | undefined);
      // The multi-line help ("|" breaks lines) wraps inside its box.
      if (key === "desc") return { text: "", lines: EMBLEM_STRINGS.desc!.split("|").map(text =>
        ({ text, color: "rgb(42, 55, 80)" })) };
      if (key && EMBLEM_STRINGS[key] !== undefined) return { text: EMBLEM_STRINGS[key] };
      return {};
    },
  } as never) as typeof view;
  if (disposed) view.dispose();
  else {
    view.show();
    view.focus("OK");
  }
  return { dispose };
}

/** emblemInfoCard: the emblem's name, icon and description beside its card. */
function drawTooltip(context: CanvasRenderingContext2D, emblem: EmblemInfo,
  card: { x: number; y: number; width: number; height: number }, icon?: CanvasImageSource): void {
  const width = 337;
  context.save();
  context.font = "bold 14px sans-serif";
  const lines = wrapLines(context, emblem.desc, 220).slice(0, 6);
  const height = Math.max(115, 50 + lines.length * 20 + 10);
  let x = card.x + card.width + 8;
  if (x + width > 1600) x = card.x - width - 8;
  const y = Math.min(900 - height, Math.max(0, card.y));
  context.fillStyle = "rgba(38, 44, 56, 0.94)";
  context.fillRect(x, y, width, height);
  context.fillStyle = "rgb(202, 202, 202)";
  context.fillRect(x, y, width, 30);
  context.fillStyle = "rgb(42, 55, 80)";
  context.font = "bold 18px sans-serif";
  context.textBaseline = "middle";
  context.fillText(emblem.name, x + 14, y + 15, width - 28);
  if (icon) context.drawImage(icon, x + 24, y + 48, 51, 51);
  context.font = "bold 14px sans-serif";
  context.fillStyle = "rgb(202, 211, 219)";
  context.textBaseline = "top";
  lines.forEach((line, index) => context.fillText(line, x + 100, y + 44 + index * 20));
  context.restore();
}
