/** Gameplay channel names and the original room creation dropdown template. */

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
  if (mode === "roadblock") return { speedIndiCombine: "挡人模式（Web）" };
  if (mode === "giant") return { speedIndiCombine: "巨人模式" };
  if (mode === "rp") return rp;
  if (mode === "lte") return {
    speedIndiCombine: "个人LTE Web试玩",
    speedTeamCombine: "组队LTE Web试玩",
  };
  if (mode === "ordinary") return ordinary;
  if (mode === "shadow") return {
    speedIndiCombine: "个人幽灵标准",
    speedTeamCombine: "组队幽灵标准",
    speedIndiInfinit: "个人幽灵无限加速",
    speedTeamInfinit: "组队幽灵无限加速",
  };
  const name = mode === "grip" ? "抓地" : "幽灵";
  return { speedIndiCombine: `个人${name}`,
    speedTeamCombine: `组队${name}` };
}

export function roomChannelKey(value: string,
  channels: Record<string, string>): string {
  const key = Object.keys(channels).find(candidate =>
    channels[candidate] === value);
  if (!key) throw new Error("无效的普通竞速类别");
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
    throw new Error("缺少普通建房的下拉选项模板");
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
