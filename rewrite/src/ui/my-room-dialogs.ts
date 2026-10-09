import { T, m9 } from "../generated/formats.js";
import { C8, F9, h2, te } from "../generated/library.js";
import { decodeImage } from "../myroom/myroom-data";

/**
 * Release dialogs of the My Room visits, drawn by the shared BML window
 * renderer: dialog2_findRider mq_dialog@zz (寻找小屋: a rider name, or a
 * friend from the list), dialog2_passwordBox passwordBox@zz (the room
 * password a locked room asks visitors for) and the 道具图鉴's
 * itemDictionaryReward@zz (图鉴收藏奖励).
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

/**
 * dialog.rho/itemDictionaryReward itemDictionaryReward@zz: the K币 the newly
 * collected items pay (dialog/koin img_koinBox in the item window) and
 * dictionaryRewardDlgDesc; resolves true for 领取奖励.
 */
export async function askDictionaryReward(options: {
  library: unknown;
  root: HTMLElement;
  title: string;
  lines: readonly string[];
  count: number;
  /** A loaded font for the description (the dictionary window's). */
  fontFamily: string;
  ok: string;
  cancel: string;
}): Promise<boolean> {
  const folder = "dialog/itemDictionaryReward";
  const raw = await F9(options.library, folder, "itemDictionaryReward@zz") as DialogNode;
  const definition = await decorate(options.library, raw, folder);
  const library = options.library as { canonicalCandidates(path: string): Array<{ bytes(): Promise<Uint8Array> }> };
  const iconFile = library.canonicalCandidates("dialog/koin/img_koinBox.png")[0];
  const icon = iconFile ? await decodeImage(iconFile).catch(() => undefined) : undefined;
  const text = (context: CanvasRenderingContext2D, value: string, rect: { x: number; y: number; width: number;
    height: number }, size: number, align: "center" | "right") => m9(context, value, rect, {
    family: options.fontFamily, size, kind: "label", color: "rgb(42, 55, 80)", align, verticalAlign: "center",
    stroke: 0, strokeColor: "black" });
  return new Promise(resolve => {
    let view: DialogView | undefined;
    let done = false;
    const finish = (value: boolean) => {
      if (done) return;
      done = true;
      view?.dispose();
      resolve(value);
    };
    void (te.load({
      library: options.library, root: options.root, definition, roots: [folder, "stage_/common"],
      modal: true, label: options.title, preserveDisplayPixels: true, smoothImages: true,
      onCancel: () => finish(false), onConfirm: () => finish(true),
      state: (node: DialogNode) => {
        if (node.name === "CaptionWindow") return { text: options.title };
        switch (nodeName(node)) {
          case "rewardItemPanel": return { paint: (context: CanvasRenderingContext2D, rect: { x: number;
            y: number; width: number; height: number }) => {
            const size = 120;
            const x = rect.x + (rect.width - size) / 2;
            const y = rect.y + (rect.height - size) / 2 + 10;
            if (icon) context.drawImage(icon, x, y, size, size);
            text(context, `×${options.count}`, { x: x + size - 80, y: y + size - 28, width: 76, height: 24 }, 18,
              "right");
          } };
          case "rewardInfoLbl": return { text: "", paint: (context: CanvasRenderingContext2D, rect: { x: number;
            y: number; width: number; height: number }) => {
            const middle = rect.x + rect.width / 2;
            options.lines.forEach((line, index) =>
              text(context, line, { x: middle - 230, y: rect.y + index * 26, width: 460, height: 24 }, 16, "center"));
          } };
          case "okButton": return { label: options.ok, text: options.ok, action: () => finish(true) };
          case "cancelButton": return { label: options.cancel,
            ...(node.name === "TextButton" ? { text: options.cancel } : {}), action: () => finish(false) };
        }
        return {};
      },
    } as never) as Promise<DialogView>).then(loaded => {
      view = loaded;
      if (done) loaded.dispose();
      else {
        loaded.show();
        loaded.focus("okButton");
      }
    }, () => finish(false));
  });
}
