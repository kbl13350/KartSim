import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { jc } from "../generated/formats.js";
import {
  attr, BUY_DIALOG, CAM_INTRO, camIntroPan, find, frameName, parseLayoutXml, screenRect, SHOP_CARD_TIP, SHOP_CARDS,
  SHOP_FRAMES, SHOP_STRINGS, shopColor, ShopLayout, shopScreen, shopText, STAGE_WINDOW, TC_CASH_SLOT, TC_CASH_WINDOW,
  textAlignment, textButtonStyle, textRenderStyle, textureSize, type ShopNode,
} from "./shop-original";
import * as data from "./shop-original-data";

const DATA_FULL = new URL("../../../recovered/data-full/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, DATA_FULL), "utf8");
const body = (text: string) => text.replace(/^<\?xml[^>]*>\n/, "").replace(/\n$/, "");

test("内嵌的原版布局与解码后的原版资源逐字一致", () => {
  const constants = data as unknown as Record<string, string>;
  for (const [name, path] of Object.entries(data.ORIGINAL_SOURCES))
    assert.equal(constants[name], body(read(path)), `${name} = ${path}`);
  const frames = read("gui_monocoque.rho/frame.bml.xml");
  const embedded = parseLayoutXml(data.MONOCOQUE_FRAMES_XML);
  assert.deepEqual(embedded.children.map(frame => frame.name), [...data.ORIGINAL_FRAME_NAMES]);
  for (const frame of data.ORIGINAL_FRAME_NAMES) {
    const original = new RegExp(`\\n  <${frame}>\\n[\\s\\S]*?\\n  </${frame}>`).exec(frames)?.[0];
    assert.ok(original, frame);
    assert.ok(data.MONOCOQUE_FRAMES_XML.includes(original.slice(1)), frame);
  }
});

test("布局用到的每个窗口帧都已内嵌", () => {
  const visit = (node: ShopNode, used: Set<string>) => {
    const frame = frameName(node);
    if (node.name === "TextButton") used.add(textButtonStyle(node).frameName);
    else if (frame) used.add(frame);
    for (const child of node.children) visit(child, used);
    return used;
  };
  const used = new Set<string>();
  for (const root of [STAGE_WINDOW, SHOP_CARD_TIP, BUY_DIALOG, ...Object.values(SHOP_CARDS)]) visit(root, used);
  for (const frame of used) assert.ok(SHOP_FRAMES.has(frame), frame);
  // 确定 uses the monocoque focus frame, 取消 the static one (generated m4).
  assert.equal(textButtonStyle(find(BUY_DIALOG, "okButton")).frameName, "DefaultFocusedButton");
  assert.equal(textButtonStyle(find(BUY_DIALOG, "cancelButton")).frameName, "DefaultStaticButton");
});

function stringBag(path: string): Map<string, string> {
  const bag = new Map<string, string>();
  for (const match of read(path).matchAll(/<k n=["']([^"']+)["']>([\s\S]*?)<\/k>/g)) {
    const cn = /c=["']cn["'] v=["']([^"']*)["']/.exec(match[2]!)?.[1];
    if (cn !== undefined && !bag.has(match[1]!)) bag.set(match[1]!, cn.replaceAll("&gt;", ">"));
  }
  return bag;
}

test("中文文本取自原版字符串表（stage_stringBag、baseStringBag、buyItem_stringBag）", () => {
  const stage = stringBag("stage_mqShop.rho/stage_stringBag.bml.xml");
  const base = stringBag("DataPack1/etc_/baseStringBag.xml");
  const dialog = stringBag("dialog2_buyItem.rho/buyItem_stringBag.bml.xml");
  for (const [key, value] of Object.entries(SHOP_STRINGS)) {
    const original = ["itemName", "itemPrice", "selectStr", "selectError"].includes(key)
      ? dialog.get(key) : stage.get(key) ?? base.get(key);
    assert.equal(value, original, key);
  }
  assert.equal(shopText("#sb(trade) #sb(missing)"), "兑换 ");
});

test("原版坐标：用发布版布局函数（V0/E9）解出的商城与对话框位置", () => {
  const stage = new ShopLayout(STAGE_WINDOW);
  const rect = (name: string) => {
    const { x, y, width, height } = stage.rect(find(STAGE_WINDOW, name));
    return [x, y, width, height];
  };
  assert.deepEqual(rect("shopItems"), [714, 110, 752, 694]);
  assert.deepEqual(rect("recommand"), [716, 114, 85, 36]);
  assert.deepEqual(rect("useful"), [1131, 114, 85, 36]);
  assert.deepEqual(rect("itemList"), [735, 198, 766, 800]);
  assert.deepEqual(rect("itemListBar"), [1440, 205, 12, 584]);
  assert.deepEqual(rect("reset"), [344, 754, 162, 50]);
  assert.deepEqual(rect("shopCoupon"), [408, 110, 272, 68]);
  assert.deepEqual(rect("gachaOpenResult"), [1304, 60, 162, 40]);
  assert.deepEqual(rect("curCash"), [919, 11, 113, 32]);
  assert.deepEqual(rect("shopKoinCharge"), [1546, 12, 30, 30]);
  assert.deepEqual(rect("searchBtn"), [1143, 152, 60, 22]);
  const card = new ShopLayout(SHOP_CARDS.coupon, { x: 0, y: 0, width: 230, height: 194 });
  const cardRect = (name: string) => {
    const { x, y, width, height } = card.rect(find(SHOP_CARDS.coupon, name));
    return [x, y, width, height];
  };
  assert.deepEqual(cardRect("item"), [25, 40, 180, 115]);
  assert.deepEqual(cardRect("price"), [87, 158, 56, 20]);
  assert.deepEqual(cardRect("priceType"), [54, 162, 20, 20]);
  assert.deepEqual(cardRect("buy"), [8, 154, 106, 34]);
  assert.deepEqual(cardRect("giveGift"), [116, 154, 106, 34]);
  assert.deepEqual(cardRect("selected"), [195, 44, 26, 26]);
  const dialog = new ShopLayout(BUY_DIALOG);
  const dialogRect = (name: string) => {
    const { x, y, width, height } = dialog.rect(find(BUY_DIALOG, name));
    return [x, y, width, height];
  };
  assert.deepEqual(dialogRect("itemPanel"), [566, 271, 220, 150]);
  assert.deepEqual(dialogRect("cmbStock"), [806, 382, 228, 26]);
  assert.deepEqual(dialogRect("cashPanel"), [566, 435, 468, 62]);
  assert.deepEqual(dialogRect("okButton"), [659, 611, 132, 42]);
  assert.deepEqual(dialogRect("cancelButton"), [809, 611, 132, 42]);
  assert.deepEqual(dialogRect("closeButton"), [1026, 226, 26, 26]);
  const caption = BUY_DIALOG.children.find(child => child.name === "CaptionWindow")!;
  assert.deepEqual(Object.values(dialog.rect(caption)), [538, 217, 524, 465]);
});

test("PC 客户端的屏幕：高 1080，宽随视口比例；按原版锚点在 1920×1080 上解出 2.jpg 的位置", () => {
  assert.deepEqual(shopScreen(1920, 1080), { width: 1920, height: 1080, scale: 1 });
  assert.deepEqual(shopScreen(1280, 720), { width: 1920, height: 1080, scale: 720 / 1080 });
  assert.deepEqual(shopScreen(2560, 1080), { width: 2560, height: 1080, scale: 1 });
  assert.deepEqual(shopScreen(1440, 1080), { width: 1440, height: 1080, scale: 1 });
  const screen = new ShopLayout(STAGE_WINDOW, screenRect({ width: 1920, height: 1080 }));
  const rect = (name: string) => {
    const { x, y, width, height } = screen.rect(find(STAGE_WINDOW, name));
    return [x, y, width, height];
  };
  assert.deepEqual(rect("shopItems"), [874, 200, 752, 694]);
  assert.deepEqual(rect("shopCoupon"), [568, 200, 272, 68]);
  assert.deepEqual(rect("reset"), [504, 844, 162, 50]);
  assert.deepEqual(rect("tcCashWndPos"), [290, 278, 550, 184]);
  assert.deepEqual(rect("gachaOpenResult"), [1464, 150, 162, 40]);
  // The tcCash window and one step slot (tcCashWindow@zz, tcCashSlotCard).
  const window = new ShopLayout(TC_CASH_WINDOW, { x: 0, y: 0, width: 550, height: 184 });
  const part = (name: string) => {
    const { x, y, width, height } = window.rect(find(TC_CASH_WINDOW, name));
    return [x, y, width, height];
  };
  assert.deepEqual(part("title"), [30, 3, 164, 24]);
  assert.deepEqual(part("period"), [242, 2, 300, 20]);
  assert.deepEqual(part("tcCashPoint"), [28, 59, 60, 40]);
  assert.deepEqual(part("progressBar"), [93, 82, 440, 6]);
  assert.deepEqual(part("help"), [0, 158, 550, 15]);
  const slot = new ShopLayout(TC_CASH_SLOT, { x: 0, y: 0, width: 80, height: 80 });
  assert.deepEqual(Object.values(slot.rect(TC_CASH_SLOT)), [0, 44, 80, 80]);
  assert.deepEqual(Object.values(slot.rect(find(TC_CASH_SLOT, "rewardCount"))), [0, 104, 80, 20]);
});

test("与发布版布局遍历（generated jc）逐节点一致", () => {
  // jc lays out the visible nodes with the frames' client areas, like the release window renderer.
  const frames = new Map([...SHOP_FRAMES].map(([name, states]) => [name, states[0]]));
  const sizes = (root: ShopNode, map = new Map<ShopNode, unknown>()) => {
    const size = textureSize(root);
    if (size) map.set(root, size);
    for (const child of root.children) sizes(child, map);
    return map;
  };
  for (const root of [STAGE_WINDOW, BUY_DIALOG]) {
    const layout = new ShopLayout(root);
    const release = jc(root, { x: 0, y: 0, width: 1600, height: 900 }, frames, sizes(root)) as
      Map<ShopNode, unknown>;
    assert.ok(release.size > 15, `${release.size} nodes`);
    for (const [node, rect] of release) assert.deepEqual(layout.rect(node), rect, attr(node, "name") ?? node.name);
  }
});

test("字体与文字样式按 gui_/font font@cn", () => {
  assert.deepEqual(textRenderStyle("bold16"), { size: 16, face: "bold", stroke: false });
  assert.deepEqual(textRenderStyle("outline16"), { size: 16, face: "bold", stroke: true });
  assert.deepEqual(textRenderStyle("bold20"), { size: 20, face: "bold", stroke: false });
  assert.deepEqual(textRenderStyle("bold"), { size: 12, face: "bold", stroke: false });
  assert.deepEqual(textRenderStyle("outline"), { size: 12, face: "bold", stroke: true });
  assert.deepEqual(textRenderStyle(undefined), { size: 12, face: "default", stroke: false });
  assert.deepEqual(textRenderStyle("medium16"), { size: 16, face: "medium", stroke: false });
  assert.equal(shopColor("255 42 55 80"), "rgba(42, 55, 80, 1)");
  assert.equal(shopColor("160 0 0 0"), "rgba(0, 0, 0, 0.627)");
  assert.equal(shopColor("yellow"), "#ffff00");
  assert.deepEqual(textAlignment(find(STAGE_WINDOW, "curCash")), { align: "right", valign: "center" });
  assert.deepEqual(textAlignment(find(STAGE_WINDOW, "recommand")), { align: "center", valign: "center" });
  assert.deepEqual(textAlignment(SHOP_CARDS.koin), { align: "center", valign: "top" });
});

test("相机开场动画 camIntroAni：三个关键帧，人物从左侧平移进来并略微缩小", () => {
  assert.deepEqual(CAM_INTRO.map(key => key.time), [0, 1000, 2000]);
  assert.deepEqual(CAM_INTRO[2]!.position, [-5.7, -12, 1.8]);
  assert.deepEqual(camIntroPan(2000), { x: 0, y: 0, scale: 1 });
  const start = camIntroPan(0);
  assert.ok(start.x < -0.6 && start.scale > 1.09);
  assert.ok(camIntroPan(1000).x > start.x && camIntroPan(1000).x < 0);
  assert.deepEqual(camIntroPan(5000), camIntroPan(2000));
});

test("布局 XML 解析器拒绝损坏的输入", () => {
  assert.throws(() => parseLayoutXml("<A><B></A>"));
  assert.throws(() => parseLayoutXml("<A/><B/>"));
  assert.throws(() => parseLayoutXml("<A x=1/>"));
  const node = parseLayoutXml('<?xml version="1.0"?>\n<A t="&lt;&amp;&#x41;"><B/></A>');
  assert.equal(attr(node, "t"), "<&A");
  assert.equal(node.children[0]!.name, "B");
});
