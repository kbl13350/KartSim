export interface TachometerLayoutNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: TachometerLayoutNode[];
  [key: string]: unknown;
}

const LEGACY_PANELS = new Set(["Panel", "CharPanel", "DashboardPanel", "Graduation"]);
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Some native Tacho1 skins embed the original 800x600 dashboard widgets.
 * With no frame, clientRect and windowRect have the same four boundaries.
 * This is the same conversion as the classic-dashboard loader (S50): keep
 * the real rectangle, UV and axis, rename defaultValue, and let the overlay
 * renderer perform its existing alpha test. Framed widgets stay unsupported.
 */
export function normalizeLegacyTachometerLayout<T extends TachometerLayoutNode>(
  root: T, type: string,
): T {
  if (type !== "Tacho1") return root;
  const hasClientRect = (node: TachometerLayoutNode): boolean =>
    node.attributes.some(attribute => attribute.name === "clientRect") || node.children.some(hasClientRect);
  if (!hasClientRect(root)) return root;
  function visit(node: TachometerLayoutNode): TachometerLayoutNode {
    const attr = (name: string) => node.attributes.find(attribute => attribute.name === name)?.value;
    const clientRect = attr("clientRect");
    let attributes = node.attributes;
    if (attr("frame") !== undefined)
      throw new Error(`${node.name} 的带边框仪表布局尚未支持。`);
    if (clientRect !== undefined) {
      if (!LEGACY_PANELS.has(node.name) || attr("frame") !== undefined)
        throw new Error(`${node.name}.clientRect 的带边框仪表布局尚未支持。`);
      if (attr("windowRect") !== undefined)
        throw new Error(`${node.name} 同时声明 clientRect 和 windowRect。`);
      const parts = clientRect.trim().split(/\s+/);
      const values = parts.map(Number);
      if (parts.length !== 4 || parts.some(part => !NUMBER.test(part)) ||
          values.some(value => !Number.isFinite(Math.fround(value))) ||
          values[2]! <= values[0]! || values[3]! <= values[1]!)
        throw new Error(`${node.name}.clientRect=${clientRect} 不是有效的仪表矩形。`);
      attributes = attributes.map(attribute => attribute.name === "clientRect"
        ? { ...attribute, name: "windowRect" } : attribute);
    }
    if (attr("alphaTest") !== undefined) {
      if (!LEGACY_PANELS.has(node.name) || attr("alphaTest") !== "true" || attr("alphaBlend") !== "true")
        throw new Error(`${node.name} 的旧仪表 alpha 状态无效。`);
      attributes = attributes.filter(attribute => attribute.name !== "alphaTest");
    }
    if (node.name === "Graduation" && attr("defaultValue") !== undefined && attr("defaultVal") === undefined)
      attributes = attributes.map(attribute => attribute.name === "defaultValue"
        ? { ...attribute, name: "defaultVal" } : attribute);
    const windowRect = attr("windowRect");
    if (windowRect !== undefined && windowRect.trim().split(/\s+/).length === 2) {
      // The TW legacy default skin uses the two-value extent form on its
      // container and zero-sized booster placeholders. Preserve both extents,
      // including zero, at the local origin; four-boundary rectangles are not
      // reinterpreted and modern skins never enter this adapter.
      const parts = windowRect.trim().split(/\s+/);
      if (parts.some(part => !NUMBER.test(part) || !Number.isFinite(Math.fround(Number(part))) || Number(part) < 0))
        throw new Error(`${node.name}.windowRect=${windowRect} 不是有效的仪表尺寸。`);
      attributes = attributes.map(attribute => attribute.name === "windowRect"
        ? { ...attribute, name: "windowSize" } : attribute);
    }
    const children = node.children.map(visit);
    return attributes === node.attributes && children.every((child, index) => child === node.children[index])
      ? node : { ...node, attributes, children };
  }
  return visit(root) as T;
}
