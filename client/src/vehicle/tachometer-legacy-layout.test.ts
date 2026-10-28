import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeLegacyTachometerLayout, type TachometerLayoutNode } from "./tachometer-legacy-layout";

function node(name: string, attributes: Record<string, string>, children: TachometerLayoutNode[] = []): TachometerLayoutNode {
  return { name, text: "", attributes: Object.entries(attributes).map(([name, value]) => ({ name, value })), children };
}
const attrs = (node: TachometerLayoutNode) => Object.fromEntries(node.attributes.map(({ name, value }) => [name, value]));

test("台服 default 保留真实指针矩形、旋转轴、UV、数字与 Lucci 面板", () => {
  const hand = node("Graduation", { name: "hand", clientRect: "9 89 81 105",
    texture: "aw_01@zz", alphaBlend: "true", alphaTest: "true", uvRect: "0 176 72 192",
    minDegree: "-90", maxDegree: "180", minValue: "0", maxValue: "360", axis: "70.5 8", defaultValue: "0" });
  const kmh = node("CharPanel", { name: "kmh", clientRect: "134 105 221 143",
    alphaBlend: "true", alphaTest: "true", texture: "aw_02@zz", fontSize: "29 38", fontStr: "0123456789" });
  const lucci = node("DashboardPanel", { name: "LucciNum", clientRect: "134 153 223 168",
    alphaBlend: "true", alphaTest: "true", texture: "aw_02@zz", fontSize: "10 15", text: "         " });
  const source = node("Container", { windowSize: "800 600" }, [hand, kmh, lucci]);
  const copy = structuredClone(source);
  const result = normalizeLegacyTachometerLayout(source, "Tacho1");
  assert.deepEqual(source, copy, "source BML and cached nodes are never mutated");
  const { clientRect, defaultValue, alphaTest: _alphaTest, ...other } = attrs(hand);
  assert.deepEqual(attrs(result.children[0]!), { ...other, windowRect: clientRect, defaultVal: defaultValue });
  assert.equal(attrs(result.children[1]!).windowRect, "134 105 221 143");
  assert.equal(attrs(result.children[2]!).name, "LucciNum");
  assert.equal(attrs(result.children[2]!).text, "         ");
});

test("原生经典仪表转换保留四边坐标与所有非布局属性", () => {
  for (const kind of ["Panel", "CharPanel", "DashboardPanel", "Graduation"]) {
    const source = node(kind, { clientRect: "-2.5 3 25.5 19", alphaBlend: "true", alphaTest: "true",
      uvRect: "1 2 3 4", defaultValue: "10" });
    const result = attrs(normalizeLegacyTachometerLayout(source, "Tacho1"));
    assert.deepEqual(result, { windowRect: "-2.5 3 25.5 19", alphaBlend: "true", uvRect: "1 2 3 4",
      [kind === "Graduation" ? "defaultVal" : "defaultValue"]: "10" });
  }
});

test("TW legacy 两值尺寸保留容器和零尺寸 booster 占位，而不改现代四边矩形", () => {
  const root = node("Container", { windowRect: "174 162", align: "right;bottom", adjust: "10 -7" }, [
    node("Graduation", { clientRect: "9 89 81 105" }),
    node("Panel", { name: "boost_On", windowRect: "0 0", visible: "false" }),
    node("Panel", { windowRect: "10 75 57 122", alphaBlend: "true", alphaTest: "true" }),
  ]);
  const result = normalizeLegacyTachometerLayout(root, "Tacho1");
  assert.equal(attrs(result).windowSize, "174 162");
  assert.equal(attrs(result).adjust, "10 -7");
  assert.equal(attrs(result.children[1]!).windowSize, "0 0");
  assert.equal(attrs(result.children[1]!).visible, "false");
  assert.equal(attrs(result.children[2]!).windowRect, "10 75 57 122");
  assert.equal(attrs(result.children[2]!).alphaTest, undefined);
});

test("现代布局保留对象身份，未知 frame/alpha 状态与非法矩形仍拒绝", () => {
  const modern = node("Graduation", { windowRect: "0 0 50 10", defaultVal: "0" });
  assert.equal(normalizeLegacyTachometerLayout(modern, "Tacho1"), modern);
  const old = node("Graduation", { clientRect: "0 0 50 10" });
  assert.equal(normalizeLegacyTachometerLayout(old, "NineTacho"), old);
  const invalid: Record<string, string>[] = [{ clientRect: "0 0 1 1", frame: "frame" },
    { clientRect: "0 0 1 1", windowRect: "0 0 1 1" },
    { clientRect: "0 0 1 1", alphaTest: "false" },
    ...["0 0 0 2", "0 0 1", "0 0 Infinity 1", "0 0 1e99 1", "0 1 2 0", "0 0 x 1"].map(clientRect => ({ clientRect }))];
  for (const attributes of invalid)
    assert.throws(() => normalizeLegacyTachometerLayout(node("Graduation", attributes), "Tacho1"));
});

test("生成入口在仪表解析后、窗口投影和指针布局前使用适配", () => {
  const source = readFileSync(new URL("../generated/vehicle.js", import.meta.url), "utf8");
  const begin = source.indexOf("async function $50(");
  const end = source.indexOf("\nfunction W50(", begin);
  const loader = source.slice(begin, end);
  assert.match(loader, /normalizeLegacyTachometerLayout\(s2\(await i\[0\]\.bytes\(\)\), e\.type\)/);
  assert.ok(loader.indexOf("normalizeLegacyTachometerLayout") < loader.indexOf("layout: WB("));
});
