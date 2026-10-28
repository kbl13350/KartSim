import { refreshVehicleDisplaySettings, vehicleCatalogDisplayEnabled } from "../resources/vehicle-display-settings";
import { tr } from "../i18n/locale";
import { T } from "../generated/formats.js";
import { C8, F9, h2, te } from "../generated/library.js";
import type { FavoriteItem, MyRoomProfile } from "./local-profile";
import type { MyRoomEnvironment } from "./my-room-catalog";
import type { MyRoomBgmChoice } from "../myroom/my-room-bgm";

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
  /** Starred in 我的物品; a room without saved choices shows the first two. */
  starred?: boolean;
}

export interface MyRoomAdminOptions {
  library: unknown;
  root: HTMLElement;
  room: MyRoomProfile;
  environments: readonly MyRoomEnvironment[];
  /** The account's karts offered as the two representative karts (starred first). */
  karts: readonly MyRoomAdminKart[];
  /** 设置音乐's tracks after 默认. */
  bgmChoices: readonly MyRoomBgmChoice[];
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
  return [{ label: tr(NONE) }, ...karts.filter(kart => vehicleCatalogDisplayEnabled({
    itemId: kart.item.itemId, systemKey: kart.item.systemKart })).map(kart => {
    const count = (seen.get(kart.title) ?? 0) + 1;
    seen.set(kart.title, count);
    return { label: count === 1 ? kart.title : `${kart.title} (${count})`, kart };
  })];
}

export function sameFavorite(a: FavoriteItem | undefined, b: FavoriteItem | undefined): boolean {
  return !!a && !!b && a.category === b.category && a.itemId === b.itemId &&
    a.serial === b.serial && (a.systemKart ?? "") === (b.systemKart ?? "");
}

/** gui_/monocoque config.bml `<ScrollBar defaultSize="12"/>`. */
const SCROLLBAR_WIDTH = 12;

/**
 * The release combos hold one option template (250 wide); repeat it once
 * per value, as wide as the combo less a scrollbar the list needs.
 */
function withOptions(combo: MyRoomAdminNode, template: MyRoomAdminNode,
  values: readonly string[]): MyRoomAdminNode {
  const [left = 0, , right = 0] = (T(combo, "windowRect") as string | undefined ?? "")
    .split(/\s+/).map(Number);
  const height = Number((T(template, "windowSize") as string | undefined ?? "")
    .split(/\s+/)[1]) || 20;
  const scrolls = T(combo, "scrollBarVisible") === "true" &&
    values.length * height > Number(T(combo, "comboListLength") ?? Infinity);
  const width = right - left - (scrolls ? SCROLLBAR_WIDTH : 0);
  const options = values.map(value => h2(template, { text: value,
    ...(width > 0 ? { windowSize: `${width} ${height}` } : {}) }) as MyRoomAdminNode);
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
  await refreshVehicleDisplaySettings(true);
  const room = options.room;
  let passwordOn = !!room.roomPassword;
  let password = room.roomPassword ?? "";
  let etcOn = !!room.etcPassword;
  let etcPassword = room.etcPassword ?? "";
  let chatAllowed = room.chatAllowed !== false;
  let environmentId = room.environmentId;
  let bgmId = options.bgmChoices.some(choice => choice.id === room.bgmId) ? room.bgmId! : 0;
  const choices = myRoomAdminKartChoices(options.karts);
  // Keep a closed currently parked kart unless this slot is explicitly changed.
  // Its label remains visible as the current value but is absent from selectable options.
  const retained = new Map<string, MyRoomAdminKart>();
  const chosen = [0, 1].map(index => {
    const saved = room.displayKarts?.[index];
    const current = choices.find(choice => sameFavorite(choice.kart?.item, saved));
    if (current) return current.label;
    if (saved) {
      const kart = options.karts.find(kart => sameFavorite(kart.item, saved)) ??
        { item: saved, title: `#${saved.itemId}` };
      const label = tr("{0}（当前保留 {1}）", { "0": kart.title, "1": index + 1 });
      retained.set(label, kart);
      return label;
    }
    return tr(NONE);
  });
  let busy = false;

  const raw = await F9(options.library, FOLDER, "mq_dialog@zz") as MyRoomAdminNode;
  const template = findTemplate(raw);
  if (!template) throw new Error("缺少原版管理下拉模板");
  const environmentTitles = options.environments.map(item => item.title);
  const bgmTitles = [tr(BGM_DEFAULT), ...options.bgmChoices.map(choice => choice.label)];
  const values: Record<string, string[]> = {
    myRoomBgm: bgmTitles, chatTrack: environmentTitles,
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
    const karts = chosen.map(label => choices.find(choice => choice.label === label)?.kart ?? retained.get(label))
      .filter((kart): kart is MyRoomAdminKart => !!kart)
      .filter((kart, index, all) => all.findIndex(other =>
        sameFavorite(other.item, kart.item)) === index);
    const next: MyRoomProfile = {
      ...room, environmentId, chatAllowed, bgmId,
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
    modal: true, label: tr("小屋管理"),
    onCancel: () => { if (!busy) options.onClose(); },
    onConfirm: () => { void save(); },
    state: (node: MyRoomAdminNode) => {
      const name = nodeName(node);
      const render = () => view.render();
      switch (name) {
        case "closeMyRoom": return { label: tr("设置小屋访问密码"), checked: passwordOn,
          disabled: busy, action: () => { passwordOn = !passwordOn; render(); } };
        case "passMyRoom": return { label: tr("小屋密码"), disabled: busy || !passwordOn,
          input: { value: password, password: true, maxLength: 12,
            change: (value: string) => { password = value; } } };
        case "closeEtc": return { label: tr("设置车库等公开密码"), checked: etcOn,
          disabled: busy, action: () => { etcOn = !etcOn; render(); } };
        case "passEtc": return { label: tr("车库等公开密码"), disabled: busy || !etcOn,
          input: { value: etcPassword, password: true, maxLength: 12,
            change: (value: string) => { etcPassword = value; } } };
        case "btnMyRoomChat": return { label: tr("允许聊天"), checked: chatAllowed,
          disabled: busy, action: () => { chatAllowed = !chatAllowed; render(); } };
        case "myRoomBgm": {
          // 默认 plays the room environment's own music (myroom/my-room-bgm.ts).
          const current = options.bgmChoices.find(choice => choice.id === bgmId)?.label ?? tr(BGM_DEFAULT);
          return { label: tr("设置音乐"), disabled: busy, select: {
            value: current, valueText: current, values: bgmTitles,
            change: (value: string) => {
              bgmId = options.bgmChoices.find(choice => choice.label === value)?.id ?? 0;
              render();
            } } };
        }
        case "chatTrack": {
          const current = options.environments.find(item => item.id === environmentId);
          return { label: tr("小屋环境设定"), disabled: busy, select: {
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
          return { label: tr("代表卡丁车 {slot}", { slot: index + 1 }), disabled: busy, select: {
            value: chosen[index]!, valueText: chosen[index], values: values[name]!,
            change: (value: string) => {
              chosen[index] = value;
              // The two slots show different karts.
              if (value !== tr(NONE) && chosen[1 - index] === value) chosen[1 - index] = tr(NONE);
              render();
            } } };
        }
        // Kart search needs a text field the release opens on demand; the
        // combos scroll through the karts (comboListLength) instead.
        case "searchBtn_1":
        case "searchBtn_2": return { visible: false };
        case "OK": return { label: tr("确定"), disabled: busy, action: () => { void save(); } };
        case "Close": return { label: tr("关闭"), disabled: busy,
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
