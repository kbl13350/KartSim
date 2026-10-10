import { T } from "../generated/formats.js";
import { C8, F9, h2, te } from "../generated/library.js";
import type { FavoriteItem, MyRoomProfile } from "./local-profile";
import type { MyRoomEnvironment } from "./my-room-catalog";

/**
 * The release room management dialog, dialog.rho/roomAdmin/mq_dialog@zz.bml,
 * drawn by the shared BML window renderer used by the multiplayer dialogs.
 */

export interface MyRoomAdminNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: MyRoomAdminNode[];
}

export interface MyRoomAdminKart {
  item: FavoriteItem;
  title: string;
}

export interface MyRoomAdminOptions {
  library: unknown;
  root: HTMLElement;
  room: MyRoomProfile;
  environments: readonly MyRoomEnvironment[];
  /** Starred karts offered as the two representative karts. */
  starredKarts: readonly MyRoomAdminKart[];
  onSave(room: MyRoomProfile): Promise<boolean> | boolean;
  onClose(): void;
}

export interface MyRoomAdminDialog { dispose(): void }

const FOLDER = "dialog/roomAdmin";
const NONE = "不选择";
const BGM_DEFAULT = "默认";
const nodeName = (node: MyRoomAdminNode): string | undefined =>
  T(node, "name") as string | undefined;

/** Combo values must be unique; repeated kart titles get a running number. */
export function myRoomAdminKartChoices(karts: readonly MyRoomAdminKart[]):
  Array<{ label: string; kart?: MyRoomAdminKart }> {
  const seen = new Map<string, number>();
  return [{ label: NONE }, ...karts.map(kart => {
    const count = (seen.get(kart.title) ?? 0) + 1;
    seen.set(kart.title, count);
    return { label: count === 1 ? kart.title : `${kart.title} (${count})`, kart };
  })];
}

export function sameFavorite(a: FavoriteItem | undefined, b: FavoriteItem | undefined): boolean {
  return !!a && !!b && a.category === b.category && a.itemId === b.itemId &&
    a.serial === b.serial && (a.systemKart ?? "") === (b.systemKart ?? "");
}

/** The release combos hold one option template; repeat it once per value. */
function withOptions(combo: MyRoomAdminNode, template: MyRoomAdminNode,
  values: readonly string[]): MyRoomAdminNode {
  const options = values.map(value => h2(template, { text: value }) as MyRoomAdminNode);
  return { ...combo, children: [
    ...combo.children.filter(child => child.name !== "Skip"),
    { name: "Skip", attributes: [], children: options },
  ] };
}

function findTemplate(node: MyRoomAdminNode): MyRoomAdminNode | undefined {
  if (node.name === "Skip") return node.children[0];
  for (const child of node.children) {
    const found = findTemplate(child);
    if (found) return found;
  }
  return undefined;
}

export async function openMyRoomAdmin(options: MyRoomAdminOptions): Promise<MyRoomAdminDialog> {
  const room = options.room;
  let passwordOn = !!room.roomPassword;
  let password = room.roomPassword ?? "";
  let etcOn = !!room.etcPassword;
  let etcPassword = room.etcPassword ?? "";
  let chatAllowed = room.chatAllowed !== false;
  let environmentId = room.environmentId;
  const choices = myRoomAdminKartChoices(options.starredKarts);
  const chosen = [0, 1].map(index => {
    const saved = room.displayKarts?.[index];
    return choices.find(choice => sameFavorite(choice.kart?.item, saved))?.label ?? NONE;
  });
  let busy = false;

  const raw = await F9(options.library, FOLDER, "mq_dialog@zz") as MyRoomAdminNode;
  const template = findTemplate(raw);
  if (!template) throw new Error("缺少原版管理下拉模板");
  const environmentTitles = options.environments.map(item => item.title);
  const values: Record<string, string[]> = {
    myRoomBgm: [BGM_DEFAULT], chatTrack: environmentTitles,
    reserveKart_1: choices.map(choice => choice.label),
    reserveKart_2: choices.map(choice => choice.label),
  };
  const transform = (node: MyRoomAdminNode): MyRoomAdminNode => {
    const name = nodeName(node) ?? "";
    const list = values[name];
    if (node.name === "ComboBox" && list) return withOptions(node, template, list);
    return { ...node, children: node.children.map(transform) };
  };
  const dialog = raw.children.find(child => child.name === "CaptionWindow");
  if (!dialog) throw new Error("缺少原版管理窗口");
  const definition = { ...raw, children: [
    await C8(options.library, transform(dialog), FOLDER) as MyRoomAdminNode,
  ] };

  const save = async (): Promise<void> => {
    if (busy) return;
    busy = true;
    const karts = chosen.map(label => choices.find(choice => choice.label === label)?.kart)
      .filter((kart): kart is MyRoomAdminKart => !!kart)
      .filter((kart, index, all) => all.findIndex(other =>
        sameFavorite(other.item, kart.item)) === index);
    const next: MyRoomProfile = {
      ...room, environmentId, chatAllowed,
      displayKarts: karts.map(kart => kart.item),
      roomPassword: passwordOn ? password : "",
      etcPassword: etcOn ? etcPassword : "",
    };
    try {
      if (await options.onSave(next)) options.onClose();
    } finally {
      busy = false;
      if (!view.disposed) view.render();
    }
  };

  const view = await te.load({
    library: options.library, root: options.root, definition,
    roots: [FOLDER, "stage_/common", "stage_/myRoom"],
    preserveDisplayPixels: true, smoothImages: true,
    modal: true, label: "小屋管理",
    onCancel: () => { if (!busy) options.onClose(); },
    onConfirm: () => { void save(); },
    state: (node: MyRoomAdminNode) => {
      const name = nodeName(node);
      const render = () => view.render();
      switch (name) {
        case "closeMyRoom": return { label: "设置小屋访问密码", checked: passwordOn,
          disabled: busy, action: () => { passwordOn = !passwordOn; render(); } };
        case "passMyRoom": return { label: "小屋密码", disabled: busy || !passwordOn,
          input: { value: password, password: true, maxLength: 12,
            change: (value: string) => { password = value; } } };
        case "closeEtc": return { label: "设置车库等公开密码", checked: etcOn,
          disabled: busy, action: () => { etcOn = !etcOn; render(); } };
        case "passEtc": return { label: "车库等公开密码", disabled: busy || !etcOn,
          input: { value: etcPassword, password: true, maxLength: 12,
            change: (value: string) => { etcPassword = value; } } };
        case "btnMyRoomChat": return { label: "允许聊天", checked: chatAllowed,
          disabled: busy, action: () => { chatAllowed = !chatAllowed; render(); } };
        case "myRoomBgm": return { label: "设置音乐", disabled: busy,
          select: { value: BGM_DEFAULT, valueText: BGM_DEFAULT, values: values.myRoomBgm!,
            change: () => {} } };
        case "chatTrack": {
          const current = options.environments.find(item => item.id === environmentId);
          return { label: "小屋环境设定", disabled: busy, select: {
            value: current?.title ?? environmentTitles[0]!, valueText: current?.title,
            values: environmentTitles,
            change: (value: string) => {
              environmentId = options.environments.find(item => item.title === value)?.id
                ?? environmentId;
              render();
            } } };
        }
        case "reserveKart_1":
        case "reserveKart_2": {
          const index = name === "reserveKart_1" ? 0 : 1;
          return { label: `代表卡丁车 ${index + 1}`, disabled: busy, select: {
            value: chosen[index]!, valueText: chosen[index], values: values[name]!,
            change: (value: string) => {
              chosen[index] = value;
              // The two slots show different karts.
              if (value !== NONE && chosen[1 - index] === value) chosen[1 - index] = NONE;
              render();
            } } };
        }
        // Kart search needs a text field the release opens on demand; the
        // starred-kart list is short, so the combos alone cover the choice.
        case "searchBtn_1":
        case "searchBtn_2": return { visible: false };
        case "OK": return { label: "确定", disabled: busy, action: () => { void save(); } };
        case "Close": return { label: "关闭", disabled: busy,
          action: () => { if (!busy) options.onClose(); } };
      }
      return {};
    },
  }) as { render(): void; show(): void; focus(name?: string): void; dispose(): void;
    disposed: boolean };
  view.show();
  view.focus("OK");
  return { dispose: () => view.dispose() };
}
