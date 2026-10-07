import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  loadPauseMenuAssets, pauseButtonHits, validatePauseDialog,
} from "../src/timeattack/pause-menu-assets.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function sourceOf(name) {
  const node = declarations.find(item => item.id?.name === name ||
    item.declarations?.some(part => part.id.name === name));
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
const originalNames = ["ws", "zd0", "Ud0", "Z_", "Hf", "KD", "Q_", "$d0",
  "Wd0", "Hd0", "j5", "jD", "E1", "Vy", "wm", "qd0", "Gi", "XD"];

function fixture(options = {}) {
  const attributes = (name, values, children = []) => ({ name, attrs: values, children });
  const button = (title, adjust, iconSet, text) => attributes("StateButton", {
    name: title, windowSize: "104 106", align: "center", adjust,
    iconSet, iconAlign: "hcenter", text, textAlign: "hcenter",
    stringPos: "0 55",
  });
  const container = attributes("Container", {
    windowRect: "0 15 330 120", align: "hcenter",
  }, [
    button("다시시도", "-57 0", "btn_singleAgain@zz", "#sb(retry)"),
    button("싱글플레이", "57 0", "btn_menu@zz", "#sb(goToMenu)"),
  ]);
  const caption = attributes("CaptionWindow", {
    frame: "CaptionDialog", caption: "#sb(menu)",
    windowRect: "0 0 360 180", align: "center",
    setCloseButton: "cancelButton",
  }, [container]);
  const definition = attributes("Panel", {
    name: "메뉴", windowRect: "fullscreen", alphaBlend: "true",
    visible: "false", color: options.badColor ?? "128 0 0 0",
  }, [caption]);
  const layout = attributes("Root", {}, [attributes("CaptionDialog", {},
    [attributes("Activated", {}, [])])]);
  const config = attributes("Root", {}, [attributes("CaptionWindow", {},
    [attributes("CaptionDialog", { textRender: "bold20" })])]);
  const closeDefinition = attributes("Close", { autoLoadImage: "btn_close_" });
  const nodes = new Map([[1, definition], [2, layout], [3, config]]);
  const archiveFor = path => path.includes("retryPopup_")
    ? "stage_speedIndiGame.rho"
    : path.includes("stage_/common/") ? "stage_common.rho"
    : path.includes("gui_/font/") ? "gui_font.rho"
    : "gui_monocoque.rho";
  const resources = new Map();
  const required = [
    ["stage_/speedIndiGame/retryPopup_2btn.bml", 1],
    ["etc_/baseStringBag.xml", 0],
    ["gui_/monocoque/frame01.png", 4],
    ["gui_/monocoque/frame.bml", 2],
    ["gui_/monocoque/config.bml", 3],
    ["gui_/font/SourceHanSansCN-Bold.otf", 9],
  ];
  for (const [path, id] of required) {
    resources.set(path, {
      sourceKind: "rho", sourceName: archiveFor(path), virtualPath: path,
      bytes: async () => Uint8Array.of(id),
      text: async () => "<strings/>",
    });
  }
  for (const prefix of ["btn_singleAgain_", "btn_menu_", "btn_close_"]) {
    for (let index = 1; index <= 4; index++) {
      const filename = index + (prefix === "btn_close_" ? ".png" : "@cn.png");
      const path = `stage_/common/${prefix}${filename}`;
      resources.set(path, {
        sourceKind: "rho", sourceName: "stage_common.rho", virtualPath: path,
        bytes: async () => Uint8Array.of(4), text: async () => "",
      });
    }
  }
  const library = { canonicalCandidates: path => resources.has(path)
    ? [resources.get(path)] : [] };
  const attribute = (node, name) => node.attrs[name];
  const windowRect = (node, parent) => ({
    x: parent.x + (node.name === "StateButton" ? 10 : 0),
    y: parent.y + (node.name === "StateButton" ? 15 : 0),
    width: 100, height: 100,
  });
  const ops = {
    parseBml: bytes => nodes.get(bytes[0]),
    decodePng: async () => ({ width: 104, height: 106,
      pixels: Uint8Array.of(1, 2, 3, 4) }),
    attribute,
    frameState: () => ({ texture: options.badTexture ?? "frame01" }),
    captionOffset: () => ({ x: 7, y: 9 }),
    loadAutoImage: async () => closeDefinition,
    registerFont: (family, bytes) => ({ family, bytes: [...bytes] }),
    frameInset: (_frame, dialog) => ({ ...dialog, x: dialog.x + 5 }),
    windowRect,
  };
  const Original = new Function(
    "s2", "p2", "Ft", "an", "ma", "f5", "T", "E9", "V0",
    `${originalNames.map(sourceOf).join("\n")};
      return { load: zd0, validate: Ud0, hits: Wd0 };`,
  )(ops.parseBml, ops.decodePng, ops.frameState, ops.captionOffset,
    ops.loadAutoImage, ops.registerFont, ops.attribute, ops.frameInset,
    ops.windowRect);
  return { library, resources, definition, ops, Original };
}

function normalized(assets) {
  return {
    overlayAlpha: assets.overlayAlpha,
    captionFrame: assets.captionFrame,
    captionOffset: assets.captionOffset,
    font: assets.font,
    strings: [...assets.strings],
    frame: [assets.frame.width, assets.frame.height],
    retry: assets.retry.map(image => [image.width, image.height]),
    menu: assets.menu.map(image => [image.width, image.height]),
    close: assets.close.map(image => [image.width, image.height]),
  };
}

test("pause resource loading, exact source and layout match release", async () => {
  const globals = ["document", "ImageData", "DOMParser"];
  const previous = Object.fromEntries(globals.map(name =>
    [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries({
    document: { createElement: () => ({
      getContext: () => ({ putImageData() {} }),
    }) },
    ImageData: class { constructor(pixels, width, height) {
      this.pixels = pixels; this.width = width; this.height = height;
    } },
    DOMParser: class { parseFromString() {
      return {
        querySelector: () => null,
        documentElement: { children: ["menu", "retry", "goToMenu", "close"]
          .map(name => ({
            getAttribute: key => key === "n" ? name : null,
            children: [{ getAttribute: key => key === "c" ? "cn" : "文本" }],
          })) },
      };
    } },
  })) Object.defineProperty(globalThis, name,
    { configurable: true, writable: true, value });
  try {
    const releaseFixture = fixture();
    const authoredFixture = fixture();
    const expected = await releaseFixture.Original.load(releaseFixture.library);
    const actual = await loadPauseMenuAssets(authoredFixture.library,
      authoredFixture.ops);
    assert.deepEqual(normalized(actual), normalized(expected));
    assert.equal(validatePauseDialog(authoredFixture.definition, authoredFixture.ops),
      releaseFixture.Original.validate(releaseFixture.definition));
    const dialog = { x: 10, y: 20, width: 1000, height: 700 };
    assert.deepEqual(pauseButtonHits(actual, dialog, authoredFixture.ops),
      releaseFixture.Original.hits(expected, dialog));
    for (const fault of ["badColor", "badTexture"]) {
      const original = fixture({ [fault]: fault === "badColor" ? "bad" : "wrong" });
      const authored = fixture({ [fault]: fault === "badColor" ? "bad" : "wrong" });
      const outcome = async task => {
        try { await task(); return "ok"; }
        catch (error) { return error.message; }
      };
      assert.equal(await outcome(() => loadPauseMenuAssets(authored.library, authored.ops)),
        await outcome(() => original.Original.load(original.library)));
    }
  } finally {
    for (const name of globals) {
      const descriptor = previous[name];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
