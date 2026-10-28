import { tr } from "../i18n/locale";
/** Gameplay channel names and the original room creation dropdown template. */

import { BRAVE_CHANNEL, BRAVE_LABEL } from "./lobby-brave-mode";
import { BRAWL_LABEL } from "./lobby-brawl-mode";
import { itemModeLabel } from "./lobby-item-mode";

export interface RoomOptionNode {
  name: string;
  children: RoomOptionNode[];
  [key: string]: unknown;
}

export interface RoomDropdownDependencies {
  attribute(node: RoomOptionNode, name: string): string | undefined;
  clone(node: RoomOptionNode, attributes: Record<string, string>,
    children?: RoomOptionNode[]): RoomOptionNode;
}

export function roomChannelNames(mode: string,
  ordinary: Record<string, string>, rp: Record<string, string>):
    Record<string, string> {
  if (mode === "brave") return { [BRAVE_CHANNEL]: tr(BRAVE_LABEL) };
  if (mode === "roadblock") return { speedIndiCombine: tr("挡人模式（Web）") };
  if (mode === "item") return {
    itemIndiCombine: tr(itemModeLabel(false)),
    itemTeamCombine: tr(itemModeLabel(true)),
  };
  if (mode === "giant") return { speedIndiCombine: tr("巨人模式") };
  if (mode === "brawl") return { speedIndiCombine: tr(BRAWL_LABEL) };
  if (mode === "rp") return Object.fromEntries(Object.entries(rp).map(([key, value]) => [key, tr(value)]));
  if (mode === "lte") return {
    speedIndiCombine: tr("个人LTE Web试玩"),
    speedTeamCombine: tr("组队LTE Web试玩"),
  };
  if (mode === "ordinary") return Object.fromEntries(Object.entries(ordinary).map(([key, value]) => [key, tr(value)]));
  if (mode === "shadow") return {
    speedIndiCombine: tr("个人幽灵标准"),
    speedTeamCombine: tr("组队幽灵标准"),
    speedIndiInfinit: tr("个人幽灵无限加速"),
    speedTeamInfinit: tr("组队幽灵无限加速"),
  };
  const name = mode === "grip" ? tr("抓地") : tr("幽灵");
  return { speedIndiCombine: tr("个人{value}", { value: String(name) }),
    speedTeamCombine: tr("组队{value}", { value: String(name) }) };
}

export function roomChannelKey(value: string,
  channels: Record<string, string>): string {
  const key = Object.keys(channels).find(candidate =>
    channels[candidate] === value);
  if (!key) throw new Error(tr("无效的普通竞速类别"));
  return key;
}

export function roomStyleDropdown(combo: RoomOptionNode,
  template: RoomOptionNode, values: string[],
  dependencies: RoomDropdownDependencies): RoomOptionNode {
  const skip = template.children.find(child => child.name === "Skip");
  const rows = skip?.children;
  const frame = dependencies.attribute(template, "frame");
  const listFrame = dependencies.attribute(template, "listFrame");
  if (combo.name !== "ComboBox" || !skip || !rows ||
    rows.length < values.length || !values.length || !frame || !listFrame) {
    throw new Error(tr("缺少普通建房的下拉选项模板"));
  }
  return dependencies.clone(combo, {
    windowRect: "0 0 184 26",
    frame,
    listFrame,
    comboListLength: String(values.length * 26),
    showDropDownButton: "true",
    enable: "true",
    textAlign: "center",
    textRender: "bold16",
  }, [{ ...skip, children: values.map((value, index) =>
    dependencies.clone(rows[index]!, {
      text: value, windowRect: "0 0 158 26",
    })) }]);
}
