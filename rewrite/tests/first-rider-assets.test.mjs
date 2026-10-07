import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  loadRiderBlueprint, loadRiderImages, normalizeRiderName,
  riderLayout,
} from "../src/timeattack/first-rider-assets.ts";

const release = readFileSync(
  new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const statements = parse(release, { sourceType: "module" }).program.body;
const sourceOf = name => {
  const node = statements.find(item =>
    item.type === "FunctionDeclaration" && item.id.name === name);
  assert.ok(node, name);
  return release.slice(node.start, node.end);
};

const paths = {
  window: "stage_/newRider/stage_window@zz.bml",
  strings: "stage_/newRider/stage_stringBag.bml",
  frame: "gui_/monocoque/frame.bml",
  config: "gui_/monocoque/config.bml",
  cn: "stage_/newRider/newRiderItem@cn.bml",
  zz: "stage_/newRider/newRiderItem@zz.bml",
};
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function node(name, attrs = {}, children = []) {
  return { name, attrs, children };
}

function fixture() {
  const attr = (item, key) => item.attrs[key];
  const label = (name, attrs = {}) => node("Label", attrs);
  const named = (tag, name, children = [], attrs = {}) =>
    node(tag, { name, ...attrs }, children);
  const section = (name, title, list) => named("Container", name, [
    label(name, { text: `#sb(${title})` }),
    named("Panel", "iconPanel"),
    named("Container", list),
  ]);
  const nameBox = named("Window", "라이더이름", [
    label("prompt"), named("Edit", "라이더이름입력", [],
      { maxChar: "12", frame: "DefaultEdit" }),
  ]);
  const first = named("Container", "step1", [
    named("RenderPanel", "preview"),
    named("Container", "descPlane", [
      label("warning"), named("Panel", "iconPanel"),
    ]),
    node("Container", {}, [label("detail", { text: "#sb(warningDetail0)" })]),
    node("Container", {}, [label("detail", { text: "#sb(warningDetail4)" })]),
    nameBox,
    node("Container", {}, [named("Button", "완료", [],
      { frame: "DefaultFocusedButton" })]),
    named("Container", "itemSelect", [
      section("characterCont", "selectCharacter", "characterList"),
      section("dyeCont", "selectDye", "dyeList"),
      section("colorCont", "selectPaint", "colorList"),
    ]),
  ]);
  const second = named("Container", "step2", [
    node("Window", {}, [label("trainee"), named("Label", "riderId")]),
    node("Container", {}, [named("Button", "nextStep", [],
      { frame: "DefaultFocusedButton" })]),
  ]);
  const dialog = node("CaptionWindow", { frame: "CaptionDialog" }, [
    named("Container", "bg", [first, second]),
  ]);
  const texts = [
    "newRiderCaption", "warningBold", "warningDetail0", "warningDetail1",
    "warningDetail2_3", "warningDetail4", "inputRiderId", "nextStep",
    "trainee", "selectCharacter", "selectDye", "selectPaint",
  ];
  const frame = name => node(name, {}, [
    node("Activated", { texture: `${name}-active` }),
    node("Normal", { texture: `${name}-normal` }),
  ]);
  const resources = new Map([
    [paths.window, node("Panel", {}, [dialog])],
    [paths.strings, node("StringBag", {}, texts.map(text =>
      node("String", { n: text }, [node("Translation",
        { c: "cn", v: `文本-${text}` })])))],
    [paths.frame, node("Frames", {}, [
      frame("CaptionDialog"), frame("DefaultEdit"),
      frame("DefaultFocusedButton"), frame("DefaultScrollUpButton"),
      frame("DefaultScrollDownButton"),
    ])],
    [paths.config, node("Config")],
    [paths.cn, node("newRiderItem", {}, [node("character", { id: "101" })])],
    [paths.zz, node("newRiderItem", {}, [node("color", { id: "202" })])],
  ]);
  const rect = (item, parent, frameState) => ({
    x: parent.x + (item.name.length % 5),
    y: parent.y + (frameState ? 3 : 1),
    width: 20 + item.name.length,
    height: 10 + item.children.length,
  });
  const ops = {
    parseBml: bytes => resources.get(decoder.decode(bytes)),
    attribute: attr,
    frameState: item => ({ texture: attr(item, "texture") }),
    windowRect: rect,
    frameInset: (frameState, bounds) => ({
      ...bounds, x: bounds.x + 2, y: bounds.y + 3,
    }),
    captionOffset: () => 2,
    captionRect: (frameState, bounds, offset) => ({
      ...bounds, y: bounds.y + offset,
    }),
    loadImage: async bytes => ({
      path: decoder.decode(bytes), close() {},
    }),
  };
  const library = {
    exactCanonicalCandidates(path) {
      if (path.endsWith("2_202_4.png")) return [];
      return [{ bytes: async () => encoder.encode(path) }];
    },
  };
  return { ops, library, resources };
}

function originalFunctions(ops) {
  const keys = ["Ad0", "bd0", "Md0", "xd0", "Cd0", "s2", "T", "Ft",
    "V0", "E9", "f3", "an", "H3", "q3", "UD", "$D", "WD",
    "$p", "Vc", "createImageBitmap"];
  const values = [paths.window, paths.strings, paths.frame, paths.config,
    [paths.cn, paths.zz], ops.parseBml, ops.attribute, ops.frameState,
    ops.windowRect, ops.frameInset, ops.captionRect, ops.captionOffset,
    1600, 900, "stage_/newRider/createCharacter_bg.png",
    "stage_/newRider/createCha_infoIcon.png",
    [1, 2, 3].map(i => `stage_/newRider/createCharacter_icon_${i}.png`),
    async image => image, new WeakMap(),
    async blob => ({ path: await blob.text(), close() {} }),
  ];
  return new Function(...keys, ["n1", "F3", "ms", "Td0", "U5", "Y_",
    "_d0", "Gd0"].map(sourceOf).join("\n") +
    "; return { Td0, Y_, _d0, Gd0 }; ")(...values);
}

test("first-rider BML blueprint and calculated layout match release", async () => {
  const { ops, library } = fixture();
  const original = originalFunctions(ops);
  const readable = await loadRiderBlueprint(library, ops);
  const released = await original.Td0(library);
  assert.deepEqual(readable, released);
  assert.deepEqual(riderLayout(readable, ops), original.Y_(released));
  for (const value of [" abc ", "    ", "abcdefghijklmnop "])
    assert.equal(normalizeRiderName(value, 12), original.Gd0(value, 12));
});

test("first-rider image loading and per-library cache match release", async () => {
  const readableFixture = fixture();
  const releasedFixture = fixture();
  const original = originalFunctions(releasedFixture.ops);
  const readable = await loadRiderImages(readableFixture.library,
    readableFixture.ops);
  const released = await original._d0(releasedFixture.library);
  assert.deepEqual([...readable.images.keys()], [...released.images.keys()]);
  assert.deepEqual(readable.blueprint, released.blueprint);
  assert.equal(await loadRiderImages(readableFixture.library,
    readableFixture.ops), readable);
  assert.equal(await original._d0(releasedFixture.library), released);
});
