import assert from "node:assert/strict";
import test from "node:test";

import { decodePngRgba } from "../resources/png-decoder";
import { loadItemDescriptions, loadItemHudAssets, type HudImage, type HudNode,
  type ItemHudAssetDependencies, type ItemHudAssets } from "./item-hud-assets";
import {
  ITEM_INFO_HEAD_MS, ITEM_INFO_KEY_FRAME_MS, ITEM_LOG_LIFE_MS, ITEM_LUCCI_TOP, buildItemHudCommands,
  liveEntries, logAlpha, noticeAlpha, slotRowRight, warningAlpha,
  type HudPanelCommand, type HudTextSpec, type ItemHudFrameInput,
} from "./item-hud-commands";
import { ItemHud, type ItemHudDependencies } from "./item-hud";
import { defaultItemHudOptions } from "./item-hud-options";
import { emptyItemHudState, itemHudSlots, type ItemHudState } from "./item-hud-state";
import { HudTextRasterizer, type HudTextCanvas, type HudTextContext } from "./item-hud-text";
import { openMirrorLibrary, type MirrorLibrary } from "./item-hud-test-support";
import { loadItemSlotDefinition, type ItemSlotDependencies } from "./item-slot-hud";
import { MultiplayerRaceHud, itemSlotInput, type MultiplayerHudDependencies } from "./multiplayer-race-hud";

(globalThis as { document?: unknown }).document ??= {
  createElement: () => ({ relList: { supports: () => true } }),
};
const { T, j2, s2, lt, l5 } = await import("../generated/formats.js") as unknown as {
  T(node: HudNode, name: string): string | undefined;
  j2(text: string, count: number, label: string): number[];
  s2(bytes: Uint8Array): HudNode;
  lt: ItemHudAssetDependencies["geometry"];
  l5: ItemHudAssetDependencies["place"];
};
const { U1 } = await import("../generated/library.js") as unknown as {
  U1: ItemHudAssetDependencies["findResource"];
};

const library = openMirrorLibrary(["item.rho", "stage_common.rho", "stage_speedIndiGame.rho",
  "gui_windowTemplate.rho"], ["DataPack1"]);
const assetDeps: ItemHudAssetDependencies = {
  attribute: T, numbers: j2, parseBml: s2, decodeTexture: decodePngRgba, findResource: U1,
  geometry: lt, place: l5,
};
const slotDeps: ItemSlotDependencies = {
  attribute: T, numbers: j2, parseBml: s2, decodeTexture: decodePngRgba,
  findResource(library, path, container) {
    const files = (library as MirrorLibrary).canonicalCandidates(path)
      .filter(file => file.sourceName.toLowerCase() === container.toLowerCase());
    if (files.length !== 1) throw new Error(`${path} 缺失`);
    return files[0]!;
  },
};
const assets = await loadItemHudAssets(library, assetDeps);
const descriptions = await loadItemDescriptions(library, assetDeps);

/** A canvas whose glyphs are `size` px squares; it records what it draws. */
function fakeCanvas(log: string[] = []): HudTextCanvas {
  let size = 16;
  const context: HudTextContext = {
    get font() { return `${size}px`; },
    set font(value: string) { size = Number(/(\d+)px/.exec(value)?.[1] ?? 16); log.push(`font ${value}`); },
    fillStyle: "", strokeStyle: "", lineWidth: 1, lineJoin: "miter", textBaseline: "alphabetic",
    measureText: text => ({ width: [...text].length * size }),
    clearRect() {},
    fillText(text, x, y) { log.push(`fill ${text} ${x} ${y} ${String(context.fillStyle)}`); },
    strokeText(text, x, y) { log.push(`stroke ${text} ${x} ${y} ${String(context.strokeStyle)}`); },
    getImageData: (_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
  };
  return { width: 1, height: 1, getContext: () => context };
}

function frame(state: Partial<ItemHudState>, timeMs = 0,
  overrides: Partial<ItemHudFrameInput> = {}): HudPanelCommand[] {
  const text = new HudTextRasterizer(() => fakeCanvas());
  const icon = { width: 45, height: 45, pixels: new Uint8Array(45 * 45 * 4) };
  const small = { width: 30, height: 30, pixels: new Uint8Array(30 * 30 * 4) };
  return buildItemHudCommands(assets, {
    state: { ...emptyItemHudState(2), ...state }, options: defaultItemHudOptions(), timeMs,
    noticeIcon: () => icon, smallIcon: () => small,
    describe: idx => descriptions.get(idx), abuseText: "无法获取更多道具。|请移动至下个道具箱。",
    text: text.draw, ...overrides,
  }).over;
}

const names = (commands: HudPanelCommand[]) => commands.map(command => command.textureName);
const rect = (command: HudPanelCommand | undefined) => command?.worldRect;

test("道具 HUD 模板按原版几何布局（1600×900）", () => {
  assert.deepEqual(assets.teamWarn.lamp.rect, { left: 762, top: 6, right: 837, bottom: 82 });
  assert.deepEqual(assets.teamWarn.light.rect, { left: 782, top: 20, right: 814, bottom: 52 });
  const bad = assets.notices.bad[0]!;
  assert.deepEqual(bad.icon.rect, { left: 460, top: 500, right: 505, bottom: 545 });
  assert.deepEqual(bad.label.rect, { left: 505, top: 498, right: 705, bottom: 518 });
  assert.deepEqual(bad.state.rect, { left: 505, top: 522, right: 579, bottom: 544 });
  assert.equal(T(bad.state.node, "texture"), "공격당함@zz");
  assert.deepEqual(bad.label.style, { color: "rgba(255,205,212,1)", outline: "black", size: 16,
    align: "left", verticalAlign: "center" });
  const good = assets.notices.good[2]!;
  assert.deepEqual(good.icon.rect, { left: 955, top: 600, right: 1000, bottom: 645 });
  assert.equal(T(good.state.node, "texture"), "효과적용@zz");
  assert.equal(assets.notices.lifeTimeMs, 2000);
  assert.equal(assets.notices.affectTimeMs, 1000);
  // itemStateTotalNotice: align right, anchor "0 0.2" → y 180.
  const log = assets.log.rows;
  assert.deepEqual(log.map(row => row.root.rect.top), [180, 226, 272]);
  assert.deepEqual(log[0]!.icon.rect, { left: 1409, top: 178, right: 1454, bottom: 223 });
  assert.deepEqual(log[0]!.failIcon.rect, { left: 1441, top: 188, right: 1466, bottom: 213 });
  assert.equal(log[0]!.attacker.style.align, "right");
  assert.equal(log[0]!.victim.style.align, "left");
  assert.deepEqual(assets.log.colors, {
    solo: { attacker: "rgba(163,255,42,1)", victim: "rgba(230,230,230,1)" },
    blue: { attacker: "rgba(191,233,255,1)", victim: "rgba(255,205,212,1)" },
    red: { attacker: "rgba(255,205,212,1)", victim: "rgba(191,233,255,1)" },
  });
  // itemInfoCard adjust 25 115: the pointer of each balloon is over the current slot.
  assert.deepEqual(assets.infoCard.balloons[2].rect, { left: 25, top: 115, right: 281, bottom: 179 });
  assert.deepEqual(assets.infoCard.text.rect, { left: 45, top: 123, right: 275, bottom: 179 });
  assert.deepEqual(assets.infoCard.text.style, { color: "white", outline: "rgba(28,50,87,1)",
    size: 14, align: "center", verticalAlign: "center" });
  const { slot, item } = assets.changers;
  assert.deepEqual([slot.key.rect, slot.number.rect, item.key.rect, item.infinity.rect], [
    { left: 0, top: 0, right: 34, bottom: 34 }, { left: 68, top: 6, right: 128, bottom: 28 },
    { left: 0, top: 38, right: 34, bottom: 72 }, { left: 70, top: 45, right: 102, bottom: 65 },
  ]);
  assert.deepEqual([slot.glyphWidth, slot.glyphHeight, slot.glyphAdvance, slot.glyphs],
    [18, 22, 14, "0123456789x"]);
  assert.deepEqual(slot.keyUv.enabled, { left: 0, top: 0, right: 34, bottom: 34 });
  assert.deepEqual(item.cardUv.disabled, { left: 106, top: 34, right: 144, bottom: 68 });
  assert.equal(assets.crosshairs.ontarget.texture.width, 128);
  assert.equal(assets.abuse.texture.width, 360);
});

test("原版道具说明与刷箱提示文字", () => {
  assert.deepEqual(descriptions.get(7), { name: "导弹", description: "发射导弹攻击对手" });
  assert.deepEqual(descriptions.get(6), { name: "加速器", description: "速度加快！" });
  for (const idx of [2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 33, 109, 110, 111, 113, 114])
    assert.ok(descriptions.get(idx)?.name && descriptions.get(idx)?.description, `idx ${idx}`);
  // randomRocket: the cn name is empty in the original string bag.
  assert.deepEqual(descriptions.get(127),
    { name: "", description: "可随机向一名比自己领先的车手发射导弹。" });
});

test("空状态不画任何东西；被瞄准警告闪烁", () => {
  assert.deepEqual(frame({}), []);
  const start = frame({ warning: "rocket" }, 0);
  assert.deepEqual(names(start), ["warning_rocket", "crash_01", "crash_02"]);
  assert.deepEqual(rect(start[0]), { left: 0, top: 0, right: 1600, bottom: 900 });
  assert.equal(start[0]!.alpha, 96);
  const peak = frame({ warning: "waterfly" }, 250);
  assert.deepEqual(names(peak), ["warning_waterfly", "crash_01"]);
  assert.equal(peak[0]!.alpha, undefined);
  assert.equal(warningAlpha(125), 176);
  assert.equal(warningAlpha(500), 96);
});

test("准星按阶段换图并以舞台坐标居中", () => {
  const cases = [["aiming", "crosshaira", 256], ["inrange", "crosshairb", 256],
    ["ontarget", "crosshairc", 128]] as const;
  for (const [phase, texture, size] of cases) {
    const [command] = frame({ aim: { phase, x: 800, y: 400 } });
    assert.equal(command!.textureName, texture);
    assert.deepEqual(command!.worldRect, { left: 800 - size / 2, top: 400 - size / 2,
      right: 800 + size / 2, bottom: 400 + size / 2 });
  }
});

test("我的受击提示：最新 3 条、2000 ms 寿命、后 1000 ms 淡出、可关闭", () => {
  const notices = [0, 1, 2, 3].map(index => ({ kind: "bad" as const, itemIdx: 7,
    text: `车手${index}`, at: 1000 + index * 100 }));
  const commands = frame({ notices: [...notices,
    { kind: "good", itemIdx: 9, text: "车手A 等2人", at: 1300 }] }, 1400);
  const labels = commands.filter(command => command.textureName.startsWith("text:"));
  assert.deepEqual(labels.map(command => command.textureName),
    ["text:车手3", "text:车手2", "text:车手1", "text:车手A 等2人"]);
  // Left aligned and vertically centred in itemStateLabel (200×20 at 505,498).
  assert.deepEqual(labels[0]!.worldRect, { left: 505, top: 497, right: 505 + 16 * 3 + 4,
    bottom: 497 + 22 });
  const states = names(commands).filter(name => name.endsWith("@zz"));
  assert.deepEqual(states, ["공격당함@zz", "공격당함@zz", "공격당함@zz", "효과적용@zz"]);
  assert.deepEqual(rect(commands.find(command => command.textureName === "효과적용@zz")),
    { left: 1000, top: 522, right: 1074, bottom: 544 });
  const fading = frame({ notices }, 2600);
  assert.deepEqual(fading.filter(command => command.textureName.startsWith("text:"))
    .map(command => [command.textureName, command.alpha]),
  [["text:车手3", 179], ["text:车手2", 153], ["text:车手1", 128]]);
  assert.deepEqual(frame({ notices }, 3300), []);
  assert.deepEqual(frame({ notices }, 1400, { options: { ...defaultItemHudOptions(),
    itemStateNotice: false } }), []);
  assert.equal(noticeAlpha(1000, 2000, 1000), 255);
  assert.equal(noticeAlpha(1500, 2000, 1000), 128);
  assert.equal(noticeAlpha(2000, 2000, 1000), 0);
});

test("全体受击记录：队伍底图与文字颜色、被挡图标、3 秒后消失、可关闭", () => {
  const log = [
    { attacker: "红队车手", victim: "蓝队车手", itemIdx: 7, failed: false, team: "red" as const, at: 100 },
    { attacker: "蓝队车手", victim: "红队车手", itemIdx: 4, failed: true, team: "blue" as const, at: 200 },
    { attacker: "个人", victim: "对手", itemIdx: 8, failed: false, at: 50 },
  ];
  const commands = frame({ log }, 300);
  const backgrounds = commands.filter(command => command.textureName.startsWith("itemInfo_BG"));
  assert.deepEqual(backgrounds.map(command => [command.textureName, command.worldRect.top]), [
    ["itemInfo_BG_teamBlue", 180], ["itemInfo_BG_teamRed", 226], ["itemInfo_BG_solo", 272],
  ]);
  assert.equal(names(commands).filter(name => name === "itemInfo_failIcon").length, 1);
  const fail = commands.find(command => command.textureName === "itemInfo_failIcon");
  assert.deepEqual(fail!.worldRect, { left: 1441, top: 188, right: 1466, bottom: 213 });
  const attacker = commands.find(command => command.textureName === "text:蓝队车手");
  // Right aligned against the icon (rid0 1277..1407).
  assert.equal(attacker!.worldRect.right, 1407);
  assert.equal(liveEntries(log, 100 + ITEM_LOG_LIFE_MS, ITEM_LOG_LIFE_MS).length, 1);
  assert.equal(logAlpha(ITEM_LOG_LIFE_MS - 250), 128);
  assert.deepEqual(frame({ log }, 300, { options: { ...defaultItemHudOptions(),
    itemStateTotalNotice: false } }), []);
});

test("道具说明卡：先名称、图标与 Ctrl，再说明；按槽数选气泡、可关闭", () => {
  // itemInfoCard: itemName (10 16 135 62), itemIcon (135 16 181 62), ctrl (188 16 239 67) at adjust 25 115.
  const card = assets.infoCard;
  assert.deepEqual([card.name.rect, card.icon.rect, card.key.rect], [
    { left: 35, top: 131, right: 160, bottom: 177 }, { left: 160, top: 131, right: 206, bottom: 177 },
    { left: 213, top: 131, right: 264, bottom: 182 },
  ]);
  assert.deepEqual([card.icon.textureName, card.key.textureName, card.key.glyphWidth, card.key.glyphs],
    ["설정아이콘_01", "key_01", 51, "12"]);
  const head = frame({ infoCard: { itemIdx: 7 } }, 0, { infoCard: { ageMs: 0, first: false } });
  assert.deepEqual(names(head), ["말풍선_슬롯2개_위치값슬롯3과동일", "text:导弹", "notice7", "key_01"]);
  assert.deepEqual(head[2]!.worldRect, { left: 160, top: 131, right: 205, bottom: 176 });
  assert.deepEqual([head[3]!.worldRect, head[3]!.uv], [{ left: 213, top: 131, right: 264, bottom: 182 },
    { left: 0, top: 0, right: 0.5, bottom: 1 }]);
  // The Ctrl key presses (frame "2") and lifts again.
  const pressed = frame({ infoCard: { itemIdx: 7 } }, 0, { infoCard: { ageMs: ITEM_INFO_KEY_FRAME_MS, first: false } });
  assert.deepEqual(pressed[3]!.uv, { left: 0.5, top: 0, right: 1, bottom: 1 });
  const body = frame({ infoCard: { itemIdx: 7 } }, 0, { infoCard: { ageMs: ITEM_INFO_HEAD_MS, first: false } });
  assert.deepEqual(names(body), ["말풍선_슬롯2개_위치값슬롯3과동일", "text:发射导弹攻击对手"]);
  // The race's first card: 查看道具说明 with the template's wrench, then first_desc.
  const prompt = { name: "查看道具说明", description: "在[设置]中可以关闭道具说明" };
  const first = frame({ infoCard: { itemIdx: 7 } }, 0, { infoCard: { ageMs: 0, first: true }, prompt });
  assert.deepEqual(names(first), ["말풍선_슬롯2개_위치값슬롯3과동일", "text:查看道具说明", "설정아이콘_01"]);
  assert.deepEqual(names(frame({ infoCard: { itemIdx: 7 } }, 0,
    { infoCard: { ageMs: ITEM_INFO_HEAD_MS, first: true }, prompt })),
  ["말풍선_슬롯2개_위치값슬롯3과동일", "text:在[设置]中可以关闭道具说明"]);
  const three = frame({ capacity: 3, slots: [7, -1, -1], infoCard: { itemIdx: 7 } });
  assert.equal(three[0]!.textureName, "말풍선_슬롯3개_위치값슬롯2와동일");
  assert.deepEqual(frame({ infoCard: { itemIdx: 7 } }, 0, { options: { ...defaultItemHudOptions(),
    dispIngameItemInfoCard: false } }), []);
  assert.deepEqual(frame({ infoCard: { itemIdx: 9999 } }), []);
});

test("换位卡/变更卡：数量、∞、为 0 时隐藏，位置随槽数", () => {
  const commands = frame({ slotChanger: 3, itemChanger: "infinite" });
  assert.equal(slotRowRight(2), 198);
  assert.deepEqual(commands.map(command => [command.textureName, command.worldRect]), [
    ["changer", { left: 206, top: 34, right: 240, bottom: 68 }],
    ["changer", { left: 240, top: 34, right: 274, bottom: 68 }],
    ["time_num", { left: 274, top: 40, right: 292, bottom: 62 }],
    ["time_num", { left: 288, top: 40, right: 306, bottom: 62 }],
    ["changer", { left: 206, top: 72, right: 240, bottom: 106 }],
    ["changer", { left: 240, top: 72, right: 274, bottom: 106 }],
    ["changerItem_num_infinite", { left: 276, top: 79, right: 308, bottom: 99 }],
  ]);
  // "x" then "3" of time_num (18×22 glyphs, fontStr 0123456789x).
  assert.deepEqual(commands[2]!.uv, { left: Math.fround(180 / 198), top: 0, right: 1, bottom: 1 });
  assert.deepEqual(commands[3]!.uv, { left: Math.fround(54 / 198), top: 0,
    right: Math.fround(72 / 198), bottom: 1 });
  assert.deepEqual(commands[4]!.uv, { left: 0, top: 0.5, right: Math.fround(34 / 144), bottom: 1 });
  assert.deepEqual(frame({ slotChanger: 0, itemChanger: 0 }), []);
  const three = frame({ capacity: 3, slots: [-1, -1, -1], slotChanger: 1, itemChanger: 0 });
  assert.equal(three[0]!.worldRect.left, 288);
});

test("刷箱提示：原版底图与文字，结束前淡出", () => {
  const commands = frame({ abuseUntil: 5000 }, 4000);
  assert.deepEqual(commands.map(command => [command.textureName, command.worldRect.left,
    command.worldRect.top]), [
    ["itemCubeAbusingMsgBg", 620, 300],
    ["text:无法获取更多道具。\n请移动至下个道具箱。", 620 + Math.floor((360 - (10 * 14 + 4)) / 2),
      300 + Math.floor((38 - 36) / 2)],
  ]);
  assert.equal(frame({ abuseUntil: 5000 }, 4850)[0]!.alpha, 128);
  assert.deepEqual(frame({ abuseUntil: 5000 }, 5000), []);
});

test("透视镜：对手名次行右侧显示道具槽小图标", () => {
  const smallFrame = { node: { name: "Slot", attributes: [], children: [] },
    rect: { left: 0, top: 0, right: 30, bottom: 30 },
    uvPixels: { left: 0, top: 98, right: 30, bottom: 128 }, adjust: 0 };
  const texture = { width: 256, height: 128, pixels: new Uint8Array(0) };
  const commands = frame({ scan: [{ playerId: "p2", slots: [7, -1] }] }, 0, {
    smallSlot: { frame: smallFrame, texture, textureName: "slot" },
    rank: { left: 0, top: 310, rowWidth: 245, rowHeight: 31, rows: [
      { participantId: "p1", x: 2, y: 0, local: true },
      { participantId: "p2", x: 2, y: 33 },
      { participantId: "p3", x: 2, y: 66 },
    ] },
  });
  // Row p2 at y 33 of the list at (0, 310): cells right of the 245 px row.
  assert.deepEqual(commands.map(command => [command.textureName, command.worldRect]), [
    ["slot", { left: 251, top: 343, right: 281, bottom: 373 }],
    ["slot_scanning", { left: 254, top: 346, right: 277, bottom: 369 }],
    ["item_s7", { left: 251, top: 343, right: 281, bottom: 373 }],
    ["slot", { left: 283, top: 343, right: 313, bottom: 373 }],
    ["slot_scanning", { left: 286, top: 346, right: 309, bottom: 369 }],
  ]);
  assert.deepEqual(commands[0]!.uv, { left: 0, top: Math.fround(98 / 128),
    right: Math.fround(30 / 256), bottom: 1 });
  assert.deepEqual(frame({ scan: [{ playerId: "p2", slots: [7] }] }), []);
});

test("文字栅格化：描边、对齐、过宽缩小与缓存", () => {
  const log: string[] = [];
  const text = new HudTextRasterizer(() => fakeCanvas(log), "TestFace");
  const style = { color: "white", outline: "black", size: 16, align: "center" as const,
    verticalAlign: "center" as const };
  const image = text.draw({ text: "导弹\n发射", style });
  assert.deepEqual([image?.width, image?.height], [36, 40]);
  assert.ok(log.includes('font bold 16px "TestFace", sans-serif'));
  assert.ok(log.some(entry => entry.startsWith("stroke 导弹 2 11 black")));
  assert.ok(log.some(entry => entry.startsWith("fill 发射 2 29 white")));
  assert.equal(text.draw({ text: "导弹\n发射", style }), image);
  assert.equal(text.size, 1);
  // 160 px at 16 px shrinks to 12 px to fit 124 (padding 2); never below 10 px.
  assert.equal(text.draw({ text: "一二三四五六七八九十", style, maxWidth: 124 })?.width, 124);
  assert.equal(text.draw({ text: "一二三四五六七八九十", style, maxWidth: 84 })?.width, 104);
  assert.equal(new HudTextRasterizer(() => undefined).draw({ text: "x", style }), undefined);
});

class RecordingRenderer {
  static created: RecordingRenderer[] = [];
  updates: Array<{ commands: unknown[]; time: number }> = [];
  renders = 0;
  smooth = false;
  disposed = false;
  constructor() { RecordingRenderer.created.push(this); }
  enableUiSmoothing() { this.smooth = true; }
  update(commands: unknown[], time: number) { this.updates.push({ commands, time }); }
  render() { this.renders++; }
  dispose() { this.disposed = true; }
}

test("ItemHud：载入原版资源、喂状态、渲染与释放", async () => {
  RecordingRenderer.created = [];
  const deps: ItemHudDependencies = { ...assetDeps,
    createRenderer: () => new RecordingRenderer(), createTextCanvas: () => fakeCanvas() };
  const slots = await loadItemSlotDefinition(library, "normal", slotDeps);
  const hud = await ItemHud.load(library, deps, { capacity: 2, slots, itemIds: [7, 9] });
  const renderer = RecordingRenderer.created[0]!;
  assert.ok(renderer.smooth);
  assert.equal(hud.cloud, undefined);
  assert.ok(hud.noticeIcon(7));
  assert.equal(hud.noticeIcon(7)!.width, 45);
  assert.ok(slots.resources.freeze && slots.resources.timer);
  assert.equal(hud.smallIcon(9)?.width, 30);
  assert.deepEqual(hud.describe(7), { name: "导弹", description: "发射导弹攻击对手" });

  hud.update(10);
  assert.deepEqual(renderer.updates.at(-1), { commands: [], time: 10 });
  hud.renderOver({}, 1600, 900);
  assert.equal(renderer.renders, 0);

  // The race's first card is the 查看道具说明 prompt (itemDescList first / first_desc).
  assert.deepEqual(hud.prompt, { name: "查看道具说明", description: "在[设置]中可以关闭道具说明" });
  hud.setState({ ...emptyItemHudState(2), aim: { phase: "aiming", x: 800, y: 450 },
    infoCard: { itemIdx: 7 } });
  hud.update(20);
  assert.deepEqual(names(hud.commands), ["crosshaira", "말풍선_슬롯2개_위치값슬롯3과동일",
    "text:查看道具说明", "설정아이콘_01"]);
  hud.update(20 + ITEM_INFO_HEAD_MS);
  assert.deepEqual(names(hud.commands), ["crosshaira", "말풍선_슬롯2개_위치값슬롯3과동일",
    "text:在[设置]中可以关闭道具说明"]);
  hud.renderOver({}, 1600, 900);
  assert.equal(renderer.renders, 1);
  // Later cards show the item.
  hud.setState({ ...emptyItemHudState(2), aim: { phase: "aiming", x: 800, y: 450 } });
  hud.update(5000);
  hud.setState({ ...emptyItemHudState(2), aim: { phase: "aiming", x: 800, y: 450 }, infoCard: { itemIdx: 7 } });
  hud.update(6000);
  assert.deepEqual(names(hud.commands), ["crosshaira", "말풍선_슬롯2개_위치값슬롯3과동일", "text:导弹",
    "notice7", "key_01"]);
  hud.setOptions({ ...defaultItemHudOptions(), dispIngameItemInfoCard: false });
  hud.update(6030);
  assert.deepEqual(names(hud.commands), ["crosshaira"]);

  // Notice icons fall back to item_none (booster 6 has no notice icon).
  await hud.prepareIcons([6]);
  assert.equal(hud.noticeIcon(6)?.width, 45);

  hud.reset();
  assert.deepEqual(hud.state, emptyItemHudState(2));
  hud.dispose();
  assert.ok(renderer.disposed);
  hud.update(40);
  assert.equal(renderer.updates.at(-1)!.time, 0);
});

function multiplayerFixture(kind: string, options: { capacity?: number; classicHud?: boolean } = {}) {
  const events: unknown[] = [];
  const definition = { items: { slot: "definition" } };
  const ui = {
    definition,
    update: (input: Record<string, unknown>, time: number) => events.push(["ui-update", input, time]),
    boostGaugeFullActive: () => false,
    startSlotReorder: () => events.push(["ui-reorder"]),
    loadClassicBoost: async () => { events.push(["classic-boost"]); },
    enableUiSmoothing() {}, setTimeInfoVisible() {}, setLocalMarkerTint() {},
    render: () => events.push(["ui-render"]),
    dispose: () => events.push(["ui-dispose"]),
  };
  const layer = {
    state: emptyItemHudState(2),
    setState(state: ItemHudState) { this.state = state; events.push(["item-state", state]); },
    setOptions: (value: unknown) => events.push(["item-options", value]),
    update: (time: number, rank: unknown) => events.push(["item-update", time, rank === ui]),
    renderUnder: () => events.push(["item-under"]),
    renderOver: () => events.push(["item-over"]),
    reset: () => events.push(["item-reset"]),
    dispose: () => events.push(["item-dispose"]),
  };
  const deps = {
    createGap: () => ({ update: () => [] }),
    resolveDye: async () => ({ primary: 0 }),
    loadHudAssets: async () => ({ rank: { rank: 1, suffix: 2, riderCount: 3, tree: { children: [] } },
      boostVisible: true, teamBoostVisible: true }),
    attribute: () => undefined,
    loadMinimap: async () => ({ setLocalRunnerFlag() {}, dispose() {} }),
    createHud: (assets: unknown) => { events.push(["create-hud", assets]); return ui; },
    loadGiant: async () => undefined,
    loadItemHud: async (_library: unknown, value: unknown) => {
      events.push(["load-item", value]); return layer;
    },
    itemHudOptions: () => ({ ...defaultItemHudOptions(), itemStateNotice: false }),
    normalizeRank: (rank: unknown) => rank,
    racingState: "racing", viewportWidth: 1600, viewportHeight: 900,
  } as unknown as MultiplayerHudDependencies;
  const race = {
    drivingMode: { kind }, mode: "individual",
    participants: [{ playerId: "p1", characterDyeId: 0, profile: { equipment: { itemIds: {} } },
      vehicle: { tachometerSelection: {}, classicHud: options.classicHud ?? false,
        kartItem: { engineGrade: 3 },
        physicsParams: { itemSlotCapacity: options.capacity ?? 2 } } }],
    map: {},
  };
  return { events, deps, race, ui, layer, definition };
}

test("多人 HUD：道具赛载入道具层、隐藏 N2O/集气、喂槽位并按层渲染", async () => {
  const fixture = multiplayerFixture("item", { capacity: 3, classicHud: true });
  const hud = await MultiplayerRaceHud.load({}, fixture.race, "p1", fixture.deps,
    (ui, tints, anonymous, competition, runner) =>
      new MultiplayerRaceHud(ui, tints, anonymous, competition, runner, fixture.deps));
  const created = fixture.events.find(event => (event as unknown[])[0] === "create-hud") as
    [string, Record<string, unknown>];
  assert.equal(created[1].boostVisible, false);
  assert.equal(created[1].teamBoostVisible, false);
  assert.ok(!fixture.events.some(event => (event as unknown[])[0] === "classic-boost"));
  assert.deepEqual(fixture.events.find(event => (event as unknown[])[0] === "load-item"), ["load-item", {
    capacity: 3, slots: fixture.definition.items,
    options: { ...defaultItemHudOptions(), itemStateNotice: false } }]);
  assert.equal(hud.item!.state.capacity, 3);

  const state: ItemHudState = { ...emptyItemHudState(3), slots: [7, 9], lock: { remainingMs: 1200 },
    reorderProgress: 0.25 };
  hud.setItemState(state);
  fixture.events.length = 0;
  const local = {
    physics: { body: "body", itemSlotCapacity: 3,
      timeAttackTachometerGauges: () => ({ mainRatio: 0.5, teamRatio: 0, teamBooster: false }) },
    track: { data: { lapTarget: 3 }, getRouteState: () => ({ lap: 1 }) },
    elapsedMs: (time: number) => time, lapTiming: {},
  };
  hud.update(local, 500, []);
  const [kind, input, time] = fixture.events[0] as [string, Record<string, unknown>, number];
  assert.equal(kind, "ui-update");
  assert.equal(time, 500);
  assert.deepEqual(input.speedSlots, [7, 9, -1]);
  assert.deepEqual(input.speedSlotDisabled, [false, false, false]);
  assert.equal(input.speedSlotWindowStartMs, 0);
  assert.deepEqual(input.itemSlotOverlay, { locked: true, countdownMs: 1200 });
  assert.equal(input.slotReorderProgress, 0.25);
  assert.deepEqual(fixture.events[1], ["item-update", 500, true]);

  fixture.events.length = 0;
  hud.render({});
  assert.deepEqual(fixture.events, [["item-under"], ["ui-render"], ["item-over"]]);
  hud.startItemSlotReorder();
  assert.deepEqual(fixture.events.at(-1), ["ui-reorder"]);
  hud.dispose();
  assert.ok(fixture.events.some(event => (event as unknown[])[0] === "item-dispose"));
});

test("多人 HUD：竞速赛不载入道具层；未接入时道具赛报错", async () => {
  const speed = multiplayerFixture("speed");
  const hud = await MultiplayerRaceHud.load({}, speed.race, "p1", speed.deps,
    (ui, tints, anonymous, competition, runner) =>
      new MultiplayerRaceHud(ui, tints, anonymous, competition, runner, speed.deps));
  assert.equal(hud.item, undefined);
  assert.ok(!speed.events.some(event => (event as unknown[])[0] === "load-item"));
  const created = speed.events.find(event => (event as unknown[])[0] === "create-hud") as
    [string, Record<string, unknown>];
  assert.equal(created[1].boostVisible, true);
  hud.setItemState(emptyItemHudState(2));

  const missing = multiplayerFixture("item");
  delete (missing.deps as { loadItemHud?: unknown }).loadItemHud;
  await assert.rejects(MultiplayerRaceHud.load({}, missing.race, "p1", missing.deps,
    (ui, tints, anonymous, competition, runner) =>
      new MultiplayerRaceHud(ui, tints, anonymous, competition, runner, missing.deps)),
  /道具赛 HUD 未接入/);
  assert.ok(missing.events.some(event => (event as unknown[])[0] === "ui-dispose"));
});

test("多人 HUD：道具说明与图标取本局道具目录（含特殊道具）；特殊加速器图标进道具槽", async () => {
  const fixture = multiplayerFixture("item");
  const catalog = { items: [{ idx: 7 }, { idx: 99 }],
    get: (idx: number) => idx === 99 ? { title: "老虎导弹", description: "遮挡对手视野|并使车辆减速" }
      : idx === 7 ? { title: "导弹", description: "" } : undefined };
  await MultiplayerRaceHud.load({}, { ...fixture.race, itemCatalog: catalog }, "p1", fixture.deps,
    (ui, tints, anonymous, competition, runner) =>
      new MultiplayerRaceHud(ui, tints, anonymous, competition, runner, fixture.deps));
  const [, options] = fixture.events.find(event => (event as unknown[])[0] === "load-item") as
    [string, { itemIds: number[]; describe(idx: number): unknown }];
  assert.deepEqual(options.itemIds, [7, 99]);
  assert.deepEqual(options.describe(99), { name: "老虎导弹", description: "遮挡对手视野|并使车辆减速" });
  assert.deepEqual(options.describe(7), { name: "导弹", description: "" });
  assert.equal(options.describe(5), undefined);
  assert.deepEqual(itemSlotInput({ ...emptyItemHudState(2), slots: [31, 6], slotIcons: [241] }).itemSlotOverlay,
    { locked: false, countdownMs: undefined, icons: [241] });
});

test("道具槽输入：锁定与定时水炸弹倒计时", () => {
  assert.deepEqual(itemSlotInput({ ...emptyItemHudState(2), slots: [5] }), {
    speedSlots: [5, -1], speedSlotDisabled: [false, false], speedSlotWindowStartMs: 0,
    itemSlotOverlay: { locked: false, countdownMs: undefined },
  });
  assert.deepEqual(itemSlotInput({ ...emptyItemHudState(2), lock: { remainingMs: 2500 },
    timeBomb: { remainingMs: 900 } }).itemSlotOverlay, { locked: true, countdownMs: 900 });
  assert.deepEqual(itemSlotInput({ ...emptyItemHudState(2), lock: { remainingMs: 0 } })
    .itemSlotOverlay, { locked: false, countdownMs: 0 });
  assert.deepEqual(itemHudSlots({ capacity: 3, slots: [1.5, 7, -4, 9] }), [-1, 7, -1]);
});

// ---- phase 3 (ITEM_MODE.md C.6, C.10, C.2 lucci) ----

test("换位卡/变更卡（服务器 changers）：x+最多三位、∞、不能用时 disableUv、没有卡就不显示", () => {
  const commands = frame({ changers: { slot: 500, item: "infinite", slotUsable: true, itemUsable: false } });
  assert.deepEqual(names(commands), ["changer", "changer", "time_num", "time_num", "time_num", "time_num",
    "changer", "changer", "changerItem_num_infinite"]);
  // "x500": 4 glyphs fill changerNum's 60 px (18 + 3 × 14).
  assert.deepEqual([commands[2]!.worldRect.left, commands[5]!.worldRect.right], [274, 334]);
  assert.deepEqual(commands[3]!.uv, { left: Math.fround(90 / 198), top: 0, right: Math.fround(108 / 198), bottom: 1 });
  // Z cannot change now (not armed, locked or no item): keyDisp and exist use disableUv.
  const { item } = assets.changers;
  const changer = assets.textures.get("changer")!;
  assert.deepEqual(commands[6]!.uv, { left: Math.fround(item.keyUv.disabled.left / changer.width),
    top: Math.fround(item.keyUv.disabled.top / changer.height),
    right: Math.fround(item.keyUv.disabled.right / changer.width),
    bottom: Math.fround(item.keyUv.disabled.bottom / changer.height) });
  assert.deepEqual(commands[7]!.uv.top, Math.fround(item.cardUv.disabled.top / changer.height));
  // Four digits are capped at x999; no card and no voucher hides the row.
  const capped = frame({ changers: { slot: 1234, item: 0, slotUsable: true, itemUsable: true } });
  assert.equal(names(capped).filter(name => name === "time_num").length, 4);
  assert.equal(names(capped).filter(name => name === "changer").length, 2);
  assert.deepEqual(frame({ changers: { slot: 0, item: 0, slotUsable: false, itemUsable: false } }), []);
  // `changers` wins over the phase-2 fields.
  assert.deepEqual(frame({ slotChanger: "infinite", itemChanger: 3,
    changers: { slot: 0, item: 0, slotUsable: false, itemUsable: false } }), []);
});

test("教程板：倒计时时左下角 223×106，持有换位卡用 Alt+Z 图，只有变更卡用 Z 图，组队赛 avoidTeamkill", () => {
  const both = frame({ tutorial: "changer", changers: { slot: 3, item: 2, slotUsable: true, itemUsable: true } });
  const board = both.find(command => command.textureName.startsWith("changerTuto"))!;
  assert.equal(board.textureName, "changerTuto02@zz");
  assert.deepEqual(board.worldRect, { left: 9, top: 900 - 8 - 106, right: 9 + 223, bottom: 900 - 8 });
  const zOnly = frame({ tutorial: "changer", changers: { slot: 0, item: "infinite", slotUsable: false,
    itemUsable: true } });
  assert.ok(names(zOnly).includes("changerTuto01@zz"));
  assert.deepEqual(names(frame({ tutorial: "avoidTeamkill" })), ["avoidTeamTuto01@zz"]);
  // The @zz names load the @cn art.
  assert.deepEqual([assets.textures.get("changerTuto02@zz")!.width, assets.textures.get("avoidTeamTuto01@zz")!.width],
    [270, 223]);
});

test("赛中金币：plus<金额>@cn 图居中，与道具提示同样 2 秒淡出；没有图时写文字", () => {
  const plus = { width: 128, height: 32, pixels: new Uint8Array(128 * 32 * 4) };
  const shown = frame({ lucci: { amount: 10, atMs: 1000 } }, 1500, { lucciImage: amount => amount === 10 ? plus : undefined });
  assert.deepEqual(shown.map(command => [command.textureName, command.worldRect, command.alpha]), [
    ["lucci_plus10", { left: 736, top: ITEM_LUCCI_TOP, right: 864, bottom: ITEM_LUCCI_TOP + 32 }, undefined],
  ]);
  assert.equal(frame({ lucci: { amount: 10, atMs: 1000 } }, 2500, { lucciImage: () => plus })[0]!.alpha, 128);
  assert.deepEqual(frame({ lucci: { amount: 10, atMs: 1000 } }, 3000, { lucciImage: () => plus }), []);
  assert.deepEqual(names(frame({ lucci: { amount: 7, atMs: 0 } }, 0, { lucciImage: () => undefined })),
    ["text:+7 金币"]);
});

test("符咒：uiEffect 五个方向键，已按亮起，下一个放大", () => {
  assert.ok(assets.talisman);
  const commands = frame({ talisman: { keys: ["up", "left", "down", "right", "up"], done: 2 } });
  assert.deepEqual(names(commands), ["talisman_up_press", "talisman_left_press", "talisman_down_normal_big",
    "talisman_right_normal", "talisman_up_normal"]);
  // Container 810×248 centred, 165 above the middle; key 2 is the centre one, its big panel 162×248.
  assert.deepEqual(commands[2]!.worldRect, { left: 800 - 52 - 29, top: 450 - 165 - 80 - 44,
    right: 800 - 52 - 29 + 162, bottom: 450 - 165 - 80 - 44 + 248 });
  assert.deepEqual(commands[0]!.worldRect, { left: 800 - 52 - 308, top: 450 - 165 - 80,
    right: 800 - 52 - 308 + 104, bottom: 450 - 165 + 80 });
});
