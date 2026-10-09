/**
 * The release dialogs of 好友聊天系统, drawn by the shared BML window
 * renderer: dialog/addFriend mq_dialog@zz (加为好友) and the customMessageBox
 * notices and confirmations (屏蔽好友, 删除好友, 解除屏蔽, refusing a request,
 * 整理发件箱).
 */
import { T } from "../generated/formats.js";
import { C8, F9, _w, h2, te } from "../generated/library.js";
import { showLobbyMessageBox, type LobbyDialogViewDependencies } from "../multiplayer/lobby-dialog-views";
import type { BmlNode, MessengerLibrary } from "./messenger-art";

interface DialogView {
  readonly element: HTMLElement;
  render(): void;
  show(): void;
  focus(name?: string): void;
  dispose(): void;
}

const dependencies: LobbyDialogViewDependencies = {
  loadMessageTemplate: library => _w(library),
  loadDefinition: (library, folder, file) => F9(library, folder, file),
  decorateDefinition: (library, definition, folder) => C8(library, definition, folder),
  clone: (node, attributes, children) => children === undefined
    ? h2(node, attributes) : h2(node, attributes, children),
  nodeName: node => T(node, "name") as string | undefined,
  loadView: loaded => te.load(loaded as never),
};

/**
 * A release message box. With `no` it asks (resolves true for the first
 * button); without it is a notice (resolves true when closed).
 */
export function openMessengerMessage(library: MessengerLibrary, root: HTMLElement, title: string,
  message: string, labels: { yes?: string; no?: string } = {}): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    let view: DialogView | undefined;
    let done = false;
    const finish = (answer: boolean) => {
      if (done) return;
      done = true;
      view?.dispose();
      resolve(answer);
    };
    showLobbyMessageBox(
      () => ({ busy: false, view: undefined as unknown as DialogView }),
      { library, root, cancel: () => finish(false) },
      title, message, () => finish(true), { yes: labels.yes ?? "确定", no: labels.no ?? "取消" },
      labels.no === undefined, dependencies,
    ).then(dialog => {
      view = dialog.view as DialogView;
      if (done) view.dispose();
    }, reject);
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
 * on success by calling close().
 */
export async function openAddFriendDialog(library: MessengerLibrary, root: HTMLElement,
  submit: (nickname: string, dialog: AddFriendDialog) => void, onClose: () => void): Promise<AddFriendDialog> {
  const folder = "dialog/addFriend";
  const definition = await F9(library, folder, "mq_dialog@zz") as BmlNode;
  const decorate = async (node: BmlNode): Promise<BmlNode> => node.name === "CaptionWindow"
    ? await C8(library, node, folder) as BmlNode
    : { ...node, children: await Promise.all(node.children.map(decorate)) };
  const decorated = await decorate(definition);
  let nickname = "";
  let busy = false;
  let view: DialogView | undefined;
  let closed = false;
  const dialog: AddFriendDialog = {
    setBusy(value) {
      busy = value;
      view?.render();
    },
    close() {
      if (closed) return;
      closed = true;
      view?.dispose();
      onClose();
    },
  };
  const cancel = () => { if (!busy) dialog.close(); };
  const confirm = () => {
    const value = nickname.trim();
    if (!busy && value) submit(value, dialog);
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
      if (key && ADD_FRIEND_STRINGS[key]) return { text: ADD_FRIEND_STRINGS[key] };
      return {};
    },
  } as never) as unknown as DialogView;
  if (closed) {
    view.dispose();
    return dialog;
  }
  view.show();
  view.focus("IdEdit");
  return dialog;
}
