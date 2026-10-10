import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import { decodeBinaryXml } from "../codecs/binary-xml";
import { decodePngRgba } from "../resources/png-decoder";
import { openMirrorLibrary, releaseSourcePath, type MirrorLibrary } from "./item-hud-test-support";
import {
  ITEM_SLOT_REORDER_MS, buildItemSlotCommands, countdownText, itemSlotIconRect, itemSlotRect,
  loadItemSlotDefinition, type ItemSlotDefinition, type ItemSlotDependencies, type SlotNode,
} from "./item-slot-hud";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as typeof import("@babel/parser");
const release = readFileSync(releaseSourcePath, "utf8");
const program = parse(release, { sourceType: "module" }).program.body;

function declaration(name: string): string {
  const node = program.find(entry =>
    (entry.type === "FunctionDeclaration" || entry.type === "ClassDeclaration") &&
    entry.id?.name === name);
  assert.ok(node, `发行版仍应有 ${name}`);
  return release.slice(node.start!, node.end!);
}

const attribute = (node: SlotNode, name: string) =>
  node.attributes.find(entry => entry.name === name)?.value;
const numbers = new Function(`const z9 = Math.fround;\n${declaration("j2")}\nreturn j2;`)() as
  ItemSlotDependencies["numbers"];

function findResource(library: unknown, path: string, container: string) {
  const candidates = (library as MirrorLibrary).canonicalCandidates(path);
  if (candidates.length !== 1)
    throw new Error(`${path} source 数量必须为 1，实际 ${candidates.length}。`);
  const file = candidates[0]!;
  if (file.sourceKind !== "rho" || file.sourceName.toLowerCase() !== container.toLowerCase())
    throw new Error(`${path} 必须来自 ${container}。`);
  return file;
}

const deps: ItemSlotDependencies = {
  attribute, numbers, parseBml: bytes => decodeBinaryXml(bytes) as unknown as SlotNode,
  decodeTexture: decodePngRgba, findResource,
};

/** The release s00/XJ with their own helpers, run against the same resources. */
const Release = new Function("T", "j2", "s2", "p2", `
  const C2 = Math.fround, Zr = "item/slot", Qr = "item.rho";
  ${["s00", "Ax", "Mx", "zs", "lh", "ln", "iI", "XJ", "sI", "u00", "h00", "d00", "f00",
    "p00", "rI", "Yl", "bx"].map(declaration).join("\n")}
  return { s00, XJ };`)(attribute, numbers, deps.parseBml, decodePngRgba) as {
  s00(library: unknown, frame: string): Promise<Record<string, unknown>>;
  XJ(definition: unknown, slots: number[], disabled: unknown, start: number,
    time: number, progress?: number): unknown[];
};

const library = openMirrorLibrary(["item.rho", "stage_common.rho", "stage_speedIndiGame.rho"]);
const frames = ["normal", "dual", "v1", "v2", "nine", "nine_lodi"];

test("真实 slot_template 与六种道具槽框和发行版 s00 一致", async () => {
  for (const frame of frames) {
    const expected = await Release.s00(library, frame);
    const actual = await loadItemSlotDefinition(library, frame, deps);
    const { small, resources, ...releaseShape } = actual;
    assert.deepEqual(releaseShape, expected, frame);
    assert.deepEqual(Object.keys(releaseShape), Object.keys(expected));
    assert.deepEqual(small.rect, { left: 0, top: 0, right: 30, bottom: 30 });
    assert.deepEqual(small.uvPixels, { left: 0, top: 98, right: 30, bottom: 128 });
    assert.equal(small.adjust, 0);
    assert.equal(resources.icon(6), actual.boostTexture);
    assert.equal(resources.icon(14), actual.teamBoostTexture);
  }
  for (const missing of ["xmas2", "ht"]) {
    await assert.rejects(loadItemSlotDefinition(library, missing, deps),
      { message: `P3528 ItemSlot frame=${missing} 不在 slot_frameResource。` });
  }
});

test("竞速加速器槽的绘制命令与发行版 XJ 逐项一致", async () => {
  const definition = await loadItemSlotDefinition(library, "normal", deps);
  const cases: Array<[number[], unknown, number, number, number | undefined]> = [
    [[-1, -1], [false, false], 0, 0, undefined],
    [[6, -1], [false, false], 0, 100, undefined],
    [[6, 6], [false, false], 0, 100, undefined],
    [[14, 6], [false, false], 0, 100, undefined],
    [[6, 14], [true, false], 900, 1250, undefined],
    [[6, 14], [true, true], 900, 1350, undefined],
    [[14, 6], [false, false], 0, 100, 0],
    [[14, 6], [false, false], 0, 100, 0.37],
    [[6, 14], [false, true], 0, 100, 1],
    [[6, 14], [false, false], 0, 100, 1.5],
    [[6, -1], [false, false], 0, 100, -0.2],
    [[6], [false], 0, 0, undefined],
    [[6, 14, 6], [false, false, false], 0, 0, undefined],
    [[6, 14, 6], [false, false, false], 0, 0, 0.5],
    [[6, 6], false, 0, 0, undefined],
  ];
  for (const [slots, disabled, start, time, progress] of cases) {
    assert.deepEqual(
      buildItemSlotCommands(definition, slots, disabled as ArrayLike<unknown>, start, time, progress),
      Release.XJ(definition, slots, disabled, start, time, progress),
      JSON.stringify([slots, disabled, start, time, progress]));
  }
});

test("道具赛槽位：任意道具图标、发行版几何与 2/3 槽", async () => {
  const definition = await loadItemSlotDefinition(library, "normal", deps);
  await definition.resources.prepare([7, 8, 10]);
  assert.ok(definition.resources.icon(7));
  // The release threw for any id but 6 and 14.
  assert.throws(() => Release.XJ(definition, [7, 8], [false, false], 0, 0),
    /boost-only item slot 不接受 id=7/);

  const two = buildItemSlotCommands(definition, [7, 8], [], 0, 0, undefined, {});
  assert.deepEqual(two.map(command => [command.textureName, command.worldRect]), [
    ["slot", { left: 106, top: 24, right: 198, bottom: 116 }],
    ["slot", { left: 24, top: 24, right: 96, bottom: 96 }],
    ["item7", { left: 110, top: 28, right: 194, bottom: 112 }],
    ["item8", { left: 28, top: 28, right: 92, bottom: 92 }],
  ]);
  assert.deepEqual(two[0]!.uv, { left: Math.fround(72 / 256), top: 0,
    right: Math.fround(164 / 256), bottom: Math.fround(92 / 128) });
  assert.deepEqual(two[0]!.framebufferRect, { left: 105.5, top: 23.5, right: 197.5, bottom: 115.5 });

  const three = buildItemSlotCommands(definition, [10, -1, 7], [], 0, 0, undefined, {});
  assert.deepEqual(three.map(command => [command.textureName, command.worldRect.left,
    command.worldRect.right]), [
    ["slot", 188, 280], ["slot", 106, 178], ["slot", 24, 96],
    ["item10", 192, 276], ["item7", 28, 92],
  ]);
  assert.deepEqual(itemSlotRect(definition, 0, 3), { left: 188, top: 24, right: 280, bottom: 116 });
  assert.deepEqual(itemSlotIconRect(definition, 2, 3), { left: 28, top: 28, right: 92, bottom: 92 });
});

test("道具赛 3 槽的换位动画、锁定遮罩与倒计时", async () => {
  const definition = await loadItemSlotDefinition(library, "normal", deps);
  await definition.resources.prepare([5, 7, 9]);
  const start = buildItemSlotCommands(definition, [7, 9, 5], [], 0, 0, 0, {});
  const icons = start.filter(command => command.textureName.startsWith("item"));
  // Reversed while moving: slot 0 on top; slot 0 starts where slot 1 was.
  assert.deepEqual(icons.map(command => [command.textureName, command.worldRect]), [
    ["item5", { left: 28, top: 28, right: 92, bottom: 92 }],
    ["item9", { left: 192, top: 28, right: 276, bottom: 112 }],
    ["item7", { left: 110, top: 28, right: 174, bottom: 92 }],
  ]);
  const end = buildItemSlotCommands(definition, [7, 9, 5], [], 0, 0, 1, {});
  assert.deepEqual(end.filter(command => command.textureName === "item7")[0]!.worldRect,
    { left: 192, top: 28, right: 276, bottom: 112 });

  const locked = buildItemSlotCommands(definition, [7, -1], [], 0, 0, undefined,
    { locked: true, countdownMs: 2400 });
  const freeze = locked.filter(command => command.textureName === "freeze_slot");
  assert.deepEqual(freeze.map(command => command.worldRect), [
    { left: 106, top: 24, right: 198, bottom: 116 },
    { left: 24, top: 24, right: 96, bottom: 96 },
  ]);
  assert.deepEqual(freeze[1]!.uv, { left: 0, top: 0, right: Math.fround(72 / 256),
    bottom: Math.fround(72 / 128) });
  const digits = locked.filter(command => command.textureName === "미사일숫자");
  assert.equal(digits.length, 1);
  assert.deepEqual(digits[0]!.worldRect, { left: 141, top: 57, right: 163, bottom: 83 });
  assert.deepEqual(digits[0]!.uv, { left: Math.fround(66 / 220), top: 0,
    right: Math.fround(88 / 220), bottom: 1 });
  assert.equal(attribute(digits[0]!.node, "name"), "slotTimer");
  assert.equal(locked.indexOf(digits[0]!), locked.length - 1);

  assert.equal(countdownText(undefined), undefined);
  assert.equal(countdownText(0), undefined);
  assert.equal(countdownText(1), "1");
  assert.equal(countdownText(3000), "3");
  assert.equal(countdownText(3001), "4");
  assert.equal(ITEM_SLOT_REORDER_MS, 350);
});

test("图标缺失与加载中只画槽框", async () => {
  const definition: ItemSlotDefinition = await loadItemSlotDefinition(library, "normal", deps);
  const first = buildItemSlotCommands(definition, [111, 39], [], 0, 0, undefined, {});
  assert.deepEqual(first.map(command => command.textureName), ["slot", "slot"]);
  await definition.resources.prepare([111, 39]);
  assert.ok(definition.resources.missing.has("item39"), "iconGuide noIcon 39 has no slot icon");
  const second = buildItemSlotCommands(definition, [111, 39], [], 0, 0, undefined, {});
  assert.deepEqual(second.map(command => command.textureName), ["slot", "slot", "item111"]);
  assert.equal(definition.resources.smallIcon(111)?.width, 30);
});

test("特殊加速器：持有 31 的槽改用 animalBooster 的 animal<iconId>.png", async () => {
  const definition = await loadItemSlotDefinition(library, "normal", deps);
  await definition.resources.prepare([31]);
  const first = buildItemSlotCommands(definition, [31, 6], [false, false], 0, 0, undefined,
    { icons: [241, undefined] }) as Array<{ textureName: string; texture: { width: number } }>;
  // The animal icon loads on first use and shows from the next frame.
  assert.ok(!first.some(command => command.textureName === "animal241"));
  await new Promise(resolve => setTimeout(resolve, 50));
  const commands = buildItemSlotCommands(definition, [31, 6], [false, false], 0, 0, undefined,
    { icons: [241, undefined] }) as Array<{ textureName: string; texture: { width: number } }>;
  assert.deepEqual(commands.map(command => command.textureName).filter(name => !name.startsWith("slot")),
    ["animal241", "item6"]);
  assert.equal(commands.find(command => command.textureName === "animal241")!.texture.width, 84);
  // Without an icon id (or one with no art) the item's own icon shows.
  await definition.resources.prepare([31]);
  const plain = buildItemSlotCommands(definition, [31, -1], [false, false], 0, 0, undefined, {}) as
    Array<{ textureName: string }>;
  assert.ok(plain.some(command => command.textureName === "item31"));
  buildItemSlotCommands(definition, [31, -1], [false, false], 0, 0, undefined, { icons: [99999] });
  await new Promise(resolve => setTimeout(resolve, 50));
  const missing = buildItemSlotCommands(definition, [31, -1], [false, false], 0, 0, undefined,
    { icons: [99999] }) as Array<{ textureName: string }>;
  assert.ok(missing.some(command => command.textureName === "item31"));
});
