import { T, m9 } from "../generated/formats.js";
import { C8, F9, te } from "../generated/library.js";

/**
 * Opening a box (开箱) from 我的物品, in the release reward window
 * dialog/gachaDialog mqHukubukuro@zz: first 确定开启吗？ with the box,
 * then 恭喜你！获得了 … with what came out (or why it did not open).
 */

interface DialogNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: DialogNode[];
}

interface DialogView {
  render(): void;
  show(): void;
  focus(name?: string): void;
  dispose(): void;
}

type Rect = { x: number; y: number; width: number; height: number };

/** dialog/gachaDialog Gacha_stringBag (cn). */
export const GACHA_STRINGS = {
  openLotteryCheck: "确定开启吗？|开启时将消耗一个相应道具。",
  congratulationStrFormat: "恭喜你！获得了 %s道具",
  lotteryNotInPeriod: "不在使用期之内",
  lotteryNotHave: "%s的数量不足，无法使用",
  unknownError: "发生了未知错误",
  useBox: "开启",
  ok: "确定",
  cancel: "取消",
};

export interface BoxReward {
  category: number;
  itemId: number;
  count: number;
  days: number;
  name: string;
}

/** The text of one reward: name, then ×count or (N天). */
export function boxRewardText(reward: BoxReward): string {
  const amount = reward.count > 1 ? ` ×${reward.count}` : "";
  const period = reward.days > 0 ? `（${reward.days}天）` : "";
  return `${reward.name || `${reward.category}-${reward.itemId}`}${amount}${period}`;
}

/** The notice for a refused opening (error codes of POST /api/inventory/open). */
export function boxErrorText(code: string | undefined, boxName: string): string {
  switch (code) {
    case "LOTTERY_NOT_IN_PERIOD": return GACHA_STRINGS.lotteryNotInPeriod;
    case "ITEM_NOT_ENOUGH":
    case "NEED_OTHER_ITEM": return GACHA_STRINGS.lotteryNotHave.replace("%s", boxName);
  }
  return GACHA_STRINGS.unknownError;
}

const nodeName = (node: DialogNode): string | undefined => T(node, "name") as string | undefined;

async function decorate(library: unknown, node: DialogNode, folder: string): Promise<DialogNode> {
  return node.name === "CaptionWindow"
    ? await C8(library, node, folder) as DialogNode
    : { ...node, children: await Promise.all(node.children.map(child => decorate(library, child, folder))) };
}

export interface BoxDialogOptions {
  library: unknown;
  root: HTMLElement;
  box: { itemId: number; name: string };
  /** The box's icon, drawn in the window before opening. */
  boxIcon(): CanvasImageSource | undefined;
  /** Opens it on the server; rejects with { code } when refused. */
  open(): Promise<{ rewards: BoxReward[] }>;
  /** A reward's picture once loaded (undefined until then or without one). */
  rewardPicture(reward: BoxReward): CanvasImageSource | undefined;
  /** Text font family already loaded on the page. */
  fontFamily: string;
  onClose(opened: boolean): void;
}

export interface BoxDialog { render(): void; close(): void }

export async function openBoxDialog(options: BoxDialogOptions): Promise<BoxDialog> {
  const folder = "dialog/gachaDialog";
  const raw = await F9(options.library, folder, "mqHukubukuro@zz") as DialogNode;
  const definition = await decorate(options.library, raw, folder);
  let phase: "confirm" | "busy" | "result" | "error" = "confirm";
  let rewards: BoxReward[] = [];
  let message = "";
  let opened = false;
  let closed = false;
  let view: DialogView | undefined;
  const dialog: BoxDialog = {
    render: () => view?.render(),
    close: () => {
      if (closed) return;
      closed = true;
      view?.dispose();
      options.onClose(opened);
    },
  };
  const confirm = () => {
    if (phase !== "confirm") {
      if (phase !== "busy") dialog.close();
      return;
    }
    phase = "busy";
    view?.render();
    void options.open().then(result => {
      opened = true;
      rewards = result.rewards;
      phase = "result";
      message = GACHA_STRINGS.congratulationStrFormat.replace("%s", rewards.map(boxRewardText).join("、"));
    }, error => {
      phase = "error";
      message = boxErrorText((error as { code?: string }).code, options.box.name);
    }).finally(() => {
      if (!closed) {
        view?.render();
        view?.focus("ok");
      }
    });
  };
  const cancel = () => { if (phase !== "busy") dialog.close(); };
  const text = (context: CanvasRenderingContext2D, value: string, rect: Rect, size = 16) =>
    m9(context, value, rect, { family: options.fontFamily, size, kind: "label", color: "rgb(42, 55, 80)",
      align: "center", verticalAlign: "center", stroke: 0, strokeColor: "black" });
  const picture = (context: CanvasRenderingContext2D, image: CanvasImageSource | undefined, rect: Rect,
    fallback: string) => {
    const source = image as { width?: number; height?: number } | undefined;
    if (source?.width && source.height) {
      const scale = Math.min(rect.width / source.width, rect.height / source.height, 2);
      const width = source.width * scale;
      const height = source.height * scale;
      context.drawImage(image!, rect.x + (rect.width - width) / 2, rect.y + (rect.height - height) / 2, width, height);
    } else text(context, fallback, rect, 18);
  };
  view = await te.load({
    library: options.library, root: options.root, definition, roots: [folder, "gui_/monocoque", "stage_/common"],
    modal: true, label: options.box.name, preserveDisplayPixels: true, smoothImages: true,
    onCancel: cancel, onConfirm: confirm,
    state: (node: DialogNode) => {
      if (node.name === "CaptionWindow") return { text: options.box.name };
      switch (nodeName(node)) {
        case "itemPreview2": return { visible: false };
        case "item1": return { visible: false };
        case "itemPreview": return { paint: (context: CanvasRenderingContext2D, rect: Rect) => {
          const area = { x: rect.x - 60, y: rect.y + 40, width: rect.width + 120, height: rect.height - 50 };
          if (phase === "result" && rewards.length) {
            const width = area.width / rewards.length;
            rewards.forEach((reward, index) => picture(context, options.rewardPicture(reward),
              { ...area, x: area.x + index * width, width }, reward.name));
          } else picture(context, options.boxIcon(), area, options.box.name);
        } };
        case "description": return { text: "", paint: (context: CanvasRenderingContext2D, rect: Rect) => {
          const lines = phase === "confirm" || phase === "busy" ? GACHA_STRINGS.openLotteryCheck.split("|")
            : [message];
          const middle = rect.x + rect.width / 2;
          lines.forEach((line, index) =>
            text(context, line, { x: middle - 250, y: rect.y + index * 24, width: 500, height: 22 }));
        } };
        case "ok": return {
          disabled: phase === "busy",
          label: phase === "confirm" || phase === "busy" ? GACHA_STRINGS.useBox : GACHA_STRINGS.ok,
          text: phase === "confirm" || phase === "busy" ? GACHA_STRINGS.useBox : GACHA_STRINGS.ok,
          action: confirm,
        };
        case "cancel": return phase === "result" || phase === "error" ? { visible: false } : {
          disabled: phase === "busy", label: GACHA_STRINGS.cancel,
          ...(node.name === "TextButton" ? { text: GACHA_STRINGS.cancel } : {}), action: cancel,
        };
        case "close": return { label: GACHA_STRINGS.cancel, action: cancel };
      }
      return {};
    },
  } as never) as unknown as DialogView;
  if (closed) {
    view.dispose();
    return dialog;
  }
  view.show();
  view.focus("ok");
  return dialog;
}
