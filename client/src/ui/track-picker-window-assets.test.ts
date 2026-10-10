import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { BinaryXmlNode } from "../codecs/binary-xml";
import { attribute } from "../codecs/binary-xml";
import {
  findTrackPickerNode, loadTrackCard, loadTrackPickerWindowAssets,
  resolveTrackCardResource, type TrackPickerAssetDependencies,
  type TrackPickerResource, type TrackPickerResourceLibrary,
} from "./track-picker-window-assets";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("const Ai = 1600,");
const end = release.indexOf("class Tc0 {", start);
assert.ok(start > 0 && end > start);

function node(name: string, values: Record<string, string> = {},
  children: BinaryXmlNode[] = []): BinaryXmlNode {
  return { name, text: "", attributes: Object.entries(values).map(([key, value]) =>
    ({ name: key, value })), children };
}

class FakeImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

function fakeCanvas() {
  const canvas = {
    width: 0, height: 0, pixels: [] as number[],
    getContext(kind: string) {
      if (kind !== "2d") return null;
      return { putImageData(image: FakeImageData) { canvas.pixels = [...image.data]; } };
    },
  };
  return canvas;
}

class FakeElement {
  constructor(readonly values: Record<string, string>, readonly children: FakeElement[] = []) {}
  getAttribute(name: string): string | null { return this.values[name] ?? null; }
}

class FakeDOMParser {
  parseFromString(xml: string) {
    const invalid = xml === "INVALID";
    const entry = new FakeElement({ n: "themeMabinogi" }, [
      new FakeElement({ c: "cn", v: "基地马比诺基" }),
    ]);
    const root = new FakeElement({}, [entry]);
    return {
      documentElement: root,
      querySelector(name: string) { return name === "parsererror" && invalid ? {} : null; },
    };
  }
}

function withFakeBrowser<T>(run: () => Promise<T>): Promise<T> {
  const target = globalThis as any;
  const previous = {
    document: target.document, ImageData: target.ImageData, DOMParser: target.DOMParser,
  };
  target.document = { createElement: fakeCanvas };
  target.ImageData = FakeImageData;
  target.DOMParser = FakeDOMParser;
  return run().finally(() => Object.assign(target, previous));
}

type Fault = "none" | "random-image" | "missing-main" | "duplicate-main" |
  "wrong-config-owner" | "missing-random-theme" | "invalid-xml";

function fixture(fault: Fault = "none") {
  const requests: string[] = [];
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const config = node("Config", {}, [node("themeTabOrder", {}, [
    node("theme", { id: "mabi", icon: "mabiIcon" }),
    ...(fault === "missing-random-theme" ? [] : [
      node("theme", { id: "1024", icon: "randomIcon" }),
    ]),
    node("theme", { id: "1025", icon: "hiddenIcon" }),
    node("theme", { id: "maple", icon: "mapleIcon" }),
  ])]);
  const localBag = node("Bag", {}, [
    node("k", { n: "themeMabinogi" }, [node("m", { c: "cn", v: "马比诺基" })]),
    node("k", { n: "themeMapleStory" }, [node("m", { c: "cn", v: "冒险岛" })]),
  ]);
  const mainWindow = node("Window", { name: "selectTrackEx" }, [
    node("TextButton", { name: "ok" }), node("TextButton", { name: "cancel" }),
    node("ScrollBar", { name: "selectThemeListBar" }),
    node("ScrollBar", { name: "thumbListBar" }),
    node("Panel", { name: "randomTrackDesc" }),
  ]);
  const definitions = new Map<string, BinaryXmlNode>([
    ["dialog2_/selectTrackEx/config@cn.bml", config],
    ["dialog2_/selectTrackEx/selectTrackEx_stringBag.bml", localBag],
    ["dialog2_/selectTrackEx/selectTrackEx@zz.bml", node("Root", {}, [mainWindow])],
    ["dialog2_/selectTrackEx/radioButton.bml", node("Radio", {}, [
      node("Panel", { name: "randomRadioButton" }),
    ])],
    ["dialog2_/selectTrackEx/themeTemplate.bml", node("ThemeTemplate")],
    ["dialog2_/selectTrackEx/trackThumbCard@zz.bml", node("CardTemplate")],
    ["gui_/monocoque/config.bml", node("GuiConfig")],
    ["gui_/monocoque/frame.bml", node("Frames", {}, [
      node("NoFrame", {}, [node("Normal", { texture: "none" })]),
      node("DefaultCheckButton", {}, [
        node("Normal", { texture: "check-normal" }),
        node("Hover", { texture: "check-hover" }),
      ]),
      node("CaptionDialog", {}, [node("Activated", { texture: "caption" })]),
    ])],
    ["gui_/windowTemplate/blinkMessageWindow.bml", node("Notice", { frame: "CaptionDialog" })],
  ]);
  const owner = (path: string) => path.startsWith("dialog2_/selectTrackEx/")
    ? "dialog2_selectTrackEx.rho" : path.startsWith("gui_/monocoque/")
      ? "gui_monocoque.rho" : path.startsWith("gui_/font/")
        ? "gui_font.rho" : path.startsWith("gui_/windowTemplate/")
          ? "gui_windowTemplate.rho" : "stage_common.rho";
  function source(path: string, sourceName = owner(path)): TrackPickerResource {
    return {
      virtualPath: path, canonicalPath: path, sourceKind: "rho", sourceName,
      async bytes() { requests.push(`bytes:${path}`); return encoder.encode(path); },
      async text() { requests.push(`text:${path}`); return fault === "invalid-xml" ? "INVALID" : "VALID"; },
    };
  }
  const library: TrackPickerResourceLibrary = {
    canonicalCandidates(path) {
      requests.push(`candidate:${path}`);
      if (fault === "missing-main" && path.endsWith("trackSelect_img_mainBG.png")) return [];
      if (fault === "random-image" && path.includes("popup_bg_tracklist_title.png")) return [];
      if (path.endsWith("@cn.png") || path.endsWith("@zz.png") || path.endsWith(".png") ||
        path.endsWith(".otf") || path === "etc_/baseStringBag.xml" || definitions.has(path)) {
        const found = source(path, fault === "wrong-config-owner" &&
          path.endsWith("config@cn.bml") ? "wrong.rho" : owner(path));
        return fault === "duplicate-main" && path.endsWith("trackSelect_img_mainBG.png")
          ? [found, found] : [found];
      }
      return [];
    },
    get(path) { return path === "track/harbor/scene.3d" ? source(path) : undefined; },
    resolveContainerPath(_origin, path) {
      requests.push(`container:${path}`);
      return { status: "found", entry: source(path) };
    },
  };
  const rectangle = { x: 0, y: 0, width: 1, height: 1 };
  const frame = (entry: BinaryXmlNode) => ({
    texture: attribute(entry, "texture") ?? "",
    caption: rectangle, left: rectangle, right: rectangle,
    client: rectangle, bottom: rectangle,
    captionLeftMargin: 0, captionRightMargin: 0,
    bottomLeftMargin: 0, bottomRightMargin: 0,
    clientType: "none" as const,
  });
  const dependencies: TrackPickerAssetDependencies = {
    parseBml(bytes) { return definitions.get(decoder.decode(bytes))!; },
    async decodePng(bytes) {
      const path = decoder.decode(bytes);
      const seed = [...path].reduce((sum, char) => (sum + char.charCodeAt(0)) % 256, 0);
      return { width: 1, height: 1, pixels: Uint8Array.of(seed, path.length % 256, 3, 255) };
    },
    frame,
    buttonStyle(button, _config, tree) { return {
      frameName: attribute(button, "name") ?? "",
      states: [{ frame: frame(tree.children[0]!.children[0]!),
        textRender: "bold14", textColor: "white", textColor2: "black" }],
    }; },
    scrollbar(scroll, tree) { return { areaFrame: frame(tree.children[0]!.children[0]!),
      buttonFrames: [frame(tree.children[1]!.children[0]!)],
      minButtonHeight: attribute(scroll, "name") === "thumbListBar" ? 26 : 25 }; },
    captionOffset() { return { x: 7, y: 8 }; },
    async loadFont(family, bytes) { return { family, path: decoder.decode(bytes) } as unknown as FontFace; },
  };
  return { library, dependencies, requests };
}

function original(deps: TrackPickerAssetDependencies) {
  const compiled = new Function("s2", "T", "Ft", "m4", "Hv", "an", "p2", "f5",
    `${release.slice(start, end)}; return { ac0, nt, pc0, o4 };`);
  return compiled(deps.parseBml, attribute, deps.frame, deps.buttonStyle,
    deps.scrollbar, deps.captionOffset, deps.decodePng, deps.loadFont) as {
      ac0(library: TrackPickerResourceLibrary, groups: Array<{ cardToken: string }>): Promise<unknown>;
      nt(root: BinaryXmlNode, name: string, secondary?: BinaryXmlNode): BinaryXmlNode;
      pc0(library: TrackPickerResourceLibrary, path: string): TrackPickerResource;
      o4(resource: TrackPickerResource): Promise<unknown>;
    };
}

function snapshot(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, part) => {
    if (part instanceof Map) return { entries: [...part] };
    if (part instanceof Error) return { error: part.message };
    return part;
  }));
}

test("native SelectTrackEx assets and random card resources match the release", async () =>
  withFakeBrowser(async () => {
    for (const [fault, groupSources] of [
      ["none", []],
      ["none", [{ cardToken: "allRandom@zz" }, { cardToken: "allRandom@zz" },
        { cardToken: "speedAllRandom@zz" }]],
      ["random-image", [{ cardToken: "allRandom@zz" }]],
      ["missing-random-theme", [{ cardToken: "allRandom@zz" }]],
    ] as const) {
      const groups = [...groupSources];
      const authored = fixture(fault);
      const packaged = fixture(fault);
      const actual = await loadTrackPickerWindowAssets(authored.library, groups,
        authored.dependencies);
      const expected = await original(packaged.dependencies).ac0(packaged.library, groups);
      assert.deepEqual(snapshot(actual), snapshot(expected), fault);
      assert.deepEqual(authored.requests.slice().sort(), packaged.requests.slice().sort(), fault);
    }
  }));

test("missing and duplicate required resources reject as in the release", async () =>
  withFakeBrowser(async () => {
    for (const fault of ["missing-main", "duplicate-main", "wrong-config-owner", "invalid-xml"] as const) {
      const authored = fixture(fault);
      const packaged = fixture(fault);
      const actual = await loadTrackPickerWindowAssets(authored.library, [],
        authored.dependencies).then(() => "resolved", error => String(error));
      const expected = await original(packaged.dependencies).ac0(packaged.library, [])
        .then(() => "resolved", error => String(error));
      assert.equal(actual, expected, fault);
    }
  }));

test("same-container card selection and optional secondary node search match release", async () =>
  withFakeBrowser(async () => {
    const root = node("Root", {}, [node("Panel", { name: "target" })]);
    const secondary = node("Radio", {}, [node("Panel", { name: "target" })]);
    const built = fixture();
    const packaged = original(built.dependencies);
    assert.equal(findTrackPickerNode(root, "target", secondary),
      packaged.nt(root, "target", secondary));
    const path = "track/harbor/scene.3d";
    const authored = fixture();
    const expected = fixture();
    assert.deepEqual(snapshot(resolveTrackCardResource(authored.library, path)),
      snapshot(original(expected.dependencies).pc0(expected.library, path)));
    const actualImage = await loadTrackCard(authored.library, path, authored.dependencies);
    const releaseImage = await original(expected.dependencies).o4(
      original(expected.dependencies).pc0(expected.library, path));
    assert.deepEqual(snapshot(actualImage), snapshot(releaseImage));

    for (const status of ["missing", "ambiguous"] as const) {
      const first = fixture();
      const second = fixture();
      const failing = (fixtureValue: ReturnType<typeof fixture>): TrackPickerResourceLibrary => ({
        ...fixtureValue.library,
        resolveContainerPath() { return status === "missing"
          ? { status: "missing" } : { status: "ambiguous", entries: [] }; },
      });
      const actual = (() => {
        try { return resolveTrackCardResource(failing(first), path); }
        catch (error) { return String(error); }
      })();
      const releaseValue = (() => {
        try { return original(second.dependencies).pc0(failing(second), path); }
        catch (error) { return String(error); }
      })();
      assert.equal(actual, releaseValue);
    }
  }));
