/**
 * The release dialogs of 好友聊天系统, drawn by the shared BML window
 * renderer: dialog/addFriend mq_dialog@zz (加为好友) and the customMessageBox
 * notices and confirmations (屏蔽好友, 删除好友, 解除屏蔽, refusing a request,
 * 整理发件箱). The messenger's key guard owns their keys (the shop and My Room
 * listen in the capture phase), and an AbortSignal closes them when the
 * window is suspended for a race.
 */
import { T } from "../generated/formats.js";
import { C8, F9, _w, h2, te } from "../generated/library.js";
import { guardMessengerDialog } from "../messenger/messenger-runtime";
import { bmlColor, type BmlNode, type MessengerLibrary } from "./messenger-art";

interface DialogView {
  readonly element: HTMLElement;
  readonly disposed?: boolean;
  render(): void;
  show(): void;
  focus(name?: string): void;
  dispose(): void;
  wrapLabel(text: string, width: number, size: number): { lines: string[]; lineHeight: number };
  paintLabelLines(context: CanvasRenderingContext2D, lines: string[],
    rectangle: { y: number; [field: string]: unknown }, size: number, color: string, lineHeight: number): void;
}

interface MessageTemplate {
  definition: BmlNode;
  nodes: { dialog: BmlNode; message: BmlNode; divider: BmlNode; buttonGroup: BmlNode;
    affirmative: BmlNode; negative: BmlNode };
}

/**
 * Keys of a dialog, which never reach its own listeners once the guard has
 * them: Escape cancels, Enter in an input confirms (Enter on a focused
 * button keeps its default click), Tab cycles the dialog's controls.
 */
function dialogKeys(view: DialogView, cancel: () => void, confirm?: () => void): () => void {
  return guardMessengerDialog({
    element: view.element,
    handle: event => {
      if (event.type !== "keydown" || event.isComposing || event.keyCode === 229) return;
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      } else if (event.key === "Enter" && confirm && event.target instanceof HTMLInputElement) {
        event.preventDefault();
        confirm();
      } else if (event.key === "Tab") {
        const controls = [...view.element.querySelectorAll<HTMLElement>("input,button")]
          .filter(control => !control.hidden && !(control as HTMLButtonElement).disabled);
        if (!controls.length) return;
        event.preventDefault();
        const index = controls.indexOf(document.activeElement as HTMLElement);
        controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]!.focus();
      }
    },
  });
}

/**
 * A release message box (dialog2_customMessageBox). With `no` it asks
 * (resolves true for the first button); without it is a notice. The text
 * wraps to the box like the release ColorLabel ("|" breaks lines). An
 * aborted `signal` closes it (resolves false).
 */
export function openMessengerMessage(library: MessengerLibrary, root: HTMLElement, title: string,
  message: string, labels: { yes?: string; no?: string } = {}, signal?: AbortSignal): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    let view: DialogView | undefined;
    let release: (() => void) | undefined;
    let done = false;
    const finish = (answer: boolean) => {
      if (done) return;
      done = true;
      release?.();
      view?.dispose();
      resolve(answer);
    };
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    signal?.addEventListener("abort", () => finish(false), { once: true });
    const notice = labels.no === undefined;
    void (async () => {
      const template = await _w(library) as unknown as MessageTemplate;
      const { dialog: shell, message: body, divider, buttonGroup, affirmative, negative } = template.nodes;
      const yes = h2(affirmative, { align: notice ? "center" : "left" }) as BmlNode;
      const no = h2(negative, { align: "right" }) as BmlNode;
      const visibleShell = h2(shell, { visible: "true" }, [
        body, divider, { ...buttonGroup, children: notice ? [yes] : [yes, no] },
      ]) as BmlNode;
      const size = Number(/\d+/.exec((T(body, "textRender") as string | undefined) ?? "")?.[0] ?? 16);
      const color = bmlColor(T(body, "textColor") as string | undefined, "rgb(42,55,80)");
      const loaded = await te.load({
        library, root, preserveDisplayPixels: true, smoothImages: true,
        definition: { ...template.definition, children: [visibleShell] },
        roots: ["dialog2_/customMessageBox", "stage_/common"],
        modal: true, label: title, onCancel: () => finish(false),
        state: (node: BmlNode) => {
          if (node === visibleShell) return { text: title };
          if (node === body) return {
            visible: true, text: "",
            paint: (context: CanvasRenderingContext2D, rect: { x: number; y: number; width: number; height: number }) => {
              if (!view) return;
              const { lines, lineHeight } = view.wrapLabel(message, rect.width, size);
              const step = lineHeight + 4;
              // Centred on the message area, which is one line high: more lines grow up and
              // down alike, so the last one stays above the divider.
              const top = rect.y + (rect.height - lines.length * step) / 2;
              view.paintLabelLines(context, lines, { ...rect, y: top, height: step }, size, color, step);
            },
          };
          if (node === yes) return { visible: true, label: labels.yes ?? "确定", text: labels.yes ?? "确定",
            action: () => finish(true) };
          if (node === no) return { visible: true, label: labels.no ?? "取消", text: labels.no ?? "取消",
            action: () => finish(false) };
          return {};
        },
      } as never) as unknown as DialogView;
      view = loaded;
      if (done) {
        loaded.dispose();
        return;
      }
      release = dialogKeys(loaded, () => finish(false));
      loaded.render();
      loaded.show();
      loaded.focus();
    })().catch(error => {
      if (!done) {
        done = true;
        release?.();
        reject(error);
      }
    });
  });
}

export interface AddFriendDialog {
  setBusy(busy: boolean): void;
  close(): void;
}

/** addFriend_stringBag (cn); the renderer only reads stage_/dialog_ string bags. */
const ADD_FRIEND_STRINGS: Record<string, string> = {
  mainCaption: "加为好友",
  registerRid: "请输入请求添加为好友的|车手名或账号。",
  guideStr: "请在此输入车手名或账号。",
  registerOk: "申请好友",
  cancel: "取消",
};

function sbKey(node: BmlNode, name: string): string | undefined {
  return /^#sb\(([^)]+)\)$/.exec((T(node, name) as string | undefined) ?? "")?.[1];
}

/**
 * dialog/addFriend mq_dialog@zz: the rider name to ask, 申请好友 submits it.
 * `submit` keeps the dialog open (busy) until it settles; it closes itself
 * on success by calling close(). An aborted `signal` closes it.
 */
export async function openAddFriendDialog(library: MessengerLibrary, root: HTMLElement,
  submit: (nickname: string, dialog: AddFriendDialog) => void, onClose: () => void,
  signal?: AbortSignal): Promise<AddFriendDialog> {
  const folder = "dialog/addFriend";
  let nickname = "";
  let busy = false;
  let view: DialogView | undefined;
  let release: (() => void) | undefined;
  let closed = false;
  const dialog: AddFriendDialog = {
    setBusy(value) {
      busy = value;
      if (!closed) view?.render();
    },
    close() {
      if (closed) return;
      closed = true;
      release?.();
      view?.dispose();
      onClose();
    },
  };
  if (signal?.aborted) {
    dialog.close();
    return dialog;
  }
  signal?.addEventListener("abort", () => dialog.close(), { once: true });
  try {
    const definition = await F9(library, folder, "mq_dialog@zz") as BmlNode;
    const decorate = async (node: BmlNode): Promise<BmlNode> => node.name === "CaptionWindow"
      ? await C8(library, node, folder) as BmlNode
      : { ...node, children: await Promise.all(node.children.map(decorate)) };
    const decorated = await decorate(definition);
    const cancel = () => { if (!busy) dialog.close(); };
    const confirm = () => {
      const value = nickname.trim();
      if (!busy && value) submit(value, dialog);
    };
    // The release registerRid label: two centred lines.
    const label = (rect: { x: number; y: number; width: number; height: number },
      context: CanvasRenderingContext2D, node: BmlNode) => {
      if (!view) return;
      const size = Number(/\d+/.exec((T(node, "textRender") as string | undefined) ?? "")?.[0] ?? 16);
      const { lines, lineHeight } = view.wrapLabel(ADD_FRIEND_STRINGS.registerRid!, rect.width, size);
      view.paintLabelLines(context, lines, rect, size,
        bmlColor(T(node, "textColor") as string | undefined, "rgb(42,55,80)"), lineHeight + 2);
    };
    view = await te.load({
      library, root, definition: decorated, roots: [folder, "stage_/common"],
      modal: true, label: ADD_FRIEND_STRINGS.mainCaption, preserveDisplayPixels: true, smoothImages: true,
      onCancel: cancel,
      onConfirm: confirm,
      state: (node: BmlNode) => {
        if (node.name === "CaptionWindow") return { text: ADD_FRIEND_STRINGS.mainCaption };
        const name = T(node, "name") as string | undefined;
        switch (name) {
          case "IdEdit": return {
            disabled: busy, label: "车手名",
            input: { value: nickname, maxLength: 16, submit: confirm,
              change: (value: string) => {
                nickname = value;
                view?.render();
              } },
          };
          case "guideStr": return { visible: nickname === "", text: ADD_FRIEND_STRINGS.guideStr };
          case "okButton": return { disabled: busy || !nickname.trim(), label: ADD_FRIEND_STRINGS.registerOk,
            text: ADD_FRIEND_STRINGS.registerOk, action: confirm };
          case "cancelButton": return { disabled: busy, label: "取消", text: "取消", action: cancel };
          case "close": return { disabled: busy, label: "关闭", action: cancel };
        }
        const key = sbKey(node, "text");
        if (key === "registerRid") return { text: "", paint: (context: CanvasRenderingContext2D,
          rect: { x: number; y: number; width: number; height: number }) => label(rect, context, node) };
        if (key && ADD_FRIEND_STRINGS[key]) return { text: ADD_FRIEND_STRINGS[key] };
        return {};
      },
    } as never) as unknown as DialogView;
    if (closed) {
      view.dispose();
      return dialog;
    }
    release = dialogKeys(view, cancel, confirm);
    view.render();
    view.show();
    view.focus("IdEdit");
    return dialog;
  } catch (error) {
    if (!closed) {
      closed = true;
      release?.();
      view?.dispose();
    }
    throw error;
  }
}
