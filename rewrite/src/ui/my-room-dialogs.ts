import { T } from "../generated/formats.js";
import { C8, F9, h2, te } from "../generated/library.js";

/**
 * Release dialogs of the My Room visits, drawn by the shared BML window
 * renderer: dialog2_findRider mq_dialog@zz (寻找小屋: a rider name, or a
 * friend from the list) and dialog2_passwordBox passwordBox@zz (the room
 * password a locked room asks visitors for).
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

const nodeName = (node: DialogNode): string | undefined => T(node, "name") as string | undefined;

/** dialog2_findRider dialog_stringBag (cn) and the release base strings. */
export const FIND_RIDER_STRINGS = {
  findRiderCaption: "查找车手",
  inputRiderName: "请输入车手名称",
  friends: "选择好友",
  ok: "确定",
  cancel: "取消",
};

const NO_FRIEND = "—";

/** The release combo option look (roomAdmin's Skip template). */
const OPTION_TEMPLATE: DialogNode = { name: "TextButton", children: [], attributes: [
  { name: "windowRect", value: "0 2 330 20" }, { name: "frame", value: "SelectBtn" },
  { name: "textAlign", value: "vcenter" }, { name: "stringPos", value: "12 3" },
  { name: "textColor", value: "255 42 55 80" }, { name: "textRender", value: "bold16" },
] };

async function decorate(library: unknown, node: DialogNode, folder: string): Promise<DialogNode> {
  return node.name === "CaptionWindow"
    ? await C8(library, node, folder) as DialogNode
    : { ...node, children: await Promise.all(node.children.map(child => decorate(library, child, folder))) };
}

export interface FindRiderDialog {
  setBusy(busy: boolean): void;
  close(): void;
}

/**
 * 寻找小屋: type a rider name or pick a friend; 确定 calls submit, which
 * keeps the dialog open (busy) until it closes it.
 */
export async function openFindRiderDialog(options: {
  library: unknown;
  root: HTMLElement;
  friends: readonly string[];
  submit(nickname: string, dialog: FindRiderDialog): void;
  onClose(): void;
}): Promise<FindRiderDialog> {
  const folder = "dialog2_/findRider";
  const raw = await F9(options.library, folder, "mq_dialog@zz") as DialogNode;
  const friendValues = [NO_FRIEND, ...options.friends];
  const withFriends = (node: DialogNode): DialogNode => {
    if (node.name === "ComboBox" && nodeName(node) === "cmbFriendList") return { ...node, children: [
      ...node.children.filter(child => child.name !== "Skip"),
      { name: "Skip", attributes: [], children: friendValues.map(value =>
        h2(OPTION_TEMPLATE, { text: value }) as DialogNode) },
    ] };
    return { ...node, children: node.children.map(withFriends) };
  };
  const definition = await decorate(options.library, withFriends(raw), folder);
  let nickname = "";
  let friend = NO_FRIEND;
  let busy = false;
  let closed = false;
  let view: DialogView | undefined;
  const dialog: FindRiderDialog = {
    setBusy(value) {
      busy = value;
      view?.render();
    },
    close() {
      if (closed) return;
      closed = true;
      view?.dispose();
      options.onClose();
    },
  };
  const cancel = () => { if (!busy) dialog.close(); };
  const confirm = () => {
    const value = nickname.trim();
    if (!busy && value) options.submit(value, dialog);
  };
  view = await te.load({
    library: options.library, root: options.root, definition, roots: [folder, "stage_/common"],
    modal: true, label: FIND_RIDER_STRINGS.findRiderCaption, preserveDisplayPixels: true, smoothImages: true,
    onCancel: cancel, onConfirm: confirm,
    state: (node: DialogNode) => {
      if (node.name === "CaptionWindow") return { text: FIND_RIDER_STRINGS.findRiderCaption };
      switch (nodeName(node)) {
        // The label has no textColor; the renderer's default white would vanish.
        case "confirm_text": return { text: FIND_RIDER_STRINGS.inputRiderName, textColor: "rgb(42, 55, 80)" };
        case "RiderEdit": return {
          disabled: busy, label: FIND_RIDER_STRINGS.inputRiderName,
          input: { value: nickname, maxLength: 16, submit: confirm,
            change: (value: string) => {
              nickname = value;
              view?.render();
            } },
        };
        case "cmbFriendList": return {
          label: FIND_RIDER_STRINGS.friends, disabled: busy || friendValues.length <= 1,
          select: { value: friend, valueText: friend === NO_FRIEND ? FIND_RIDER_STRINGS.friends : friend,
            values: friendValues,
            change: (value: string) => {
              friend = value;
              if (value !== NO_FRIEND) nickname = value;
              view?.render();
            } },
        };
        case "okButton": return { disabled: busy || !nickname.trim(), label: FIND_RIDER_STRINGS.ok,
          text: FIND_RIDER_STRINGS.ok, action: confirm };
        // setCloseButton="cancelButton" also names the caption's close button.
        case "cancelButton": return { disabled: busy, label: FIND_RIDER_STRINGS.cancel,
          ...(node.name === "TextButton" ? { text: FIND_RIDER_STRINGS.cancel } : {}), action: cancel };
      }
      return {};
    },
  } as never) as unknown as DialogView;
  if (closed) {
    view.dispose();
    return dialog;
  }
  view.show();
  view.focus("RiderEdit");
  return dialog;
}

/** dialog2_passwordBox (cn): the locked room's password; resolves undefined when cancelled. */
export async function askRoomPassword(options: {
  library: unknown;
  root: HTMLElement;
  /** 小屋密码 for the room, 车库等公开密码 for its emblems and careers. */
  label: string;
}): Promise<string | undefined> {
  const folder = "dialog2_/passwordBox";
  const raw = await F9(options.library, folder, "passwordBox@zz") as DialogNode;
  const definition = await decorate(options.library, raw, folder);
  return new Promise(resolve => {
    let password = "";
    let view: DialogView | undefined;
    let done = false;
    const finish = (value: string | undefined) => {
      if (done) return;
      done = true;
      view?.dispose();
      resolve(value);
    };
    const confirm = () => { if (password) finish(password); };
    void (te.load({
      library: options.library, root: options.root, definition, roots: [folder, "stage_/common"],
      modal: true, label: options.label, preserveDisplayPixels: true, smoothImages: true,
      onCancel: () => finish(undefined), onConfirm: confirm,
      state: (node: DialogNode) => {
        if (node.name === "CaptionWindow") return { text: "输入密码" };
        switch (nodeName(node)) {
          case "passwordEdit": return { label: options.label,
            input: { value: password, password: true, maxLength: 12, submit: confirm,
              change: (value: string) => {
                password = value;
                view?.render();
              } } };
          case "okButton": return { disabled: !password, label: "确定", text: "确定", action: confirm };
          case "cancelButton": return { label: "取消",
            ...(node.name === "TextButton" ? { text: "取消" } : {}), action: () => finish(undefined) };
        }
        return {};
      },
    } as never) as Promise<DialogView>).then(loaded => {
      view = loaded;
      if (done) loaded.dispose();
      else {
        loaded.show();
        loaded.focus("passwordEdit");
      }
    }, () => finish(undefined));
  });
}
