import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import { addGraphicsPresentationOptions } from "./graphics-presentation-options";
import { loadSettingsWindowAssets, parseOfficialBgmChoices,
  type SettingsWindowAssetDependencies, type SettingsWindowNode,
  type SettingsWindowResourceLibrary } from "./settings-window-assets";

const release = readFileSync(new URL(
  "../../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function sourceOf(name: string): string {
  const declaration = declarations.find(node =>
    (node.type === "FunctionDeclaration" && node.id?.name === name) ||
    (node.type === "VariableDeclaration" && node.declarations.some(part =>
      part.id.type === "Identifier" && part.id.name === name)));
  assert.ok(declaration, name);
  return release.slice(declaration.start!, declaration.end!);
}

function node(name: string, values: Record<string, string> = {},
  children: SettingsWindowNode[] = []): SettingsWindowNode {
  return { name, text: "", attributes: Object.entries(values).map(([key, value]) =>
    ({ name: key, value })), children };
}
function attribute(source: SettingsWindowNode, key: string): string | undefined {
  return source.attributes.find(entry => entry.name === key)?.value;
}

type Fault = "none" | "missing-bml" | "duplicate-bml" | "missing-game-template" |
  "invalid-game-layout" | "missing-speed-target" | "missing-image" |
  "duplicate-image" | "invalid-xml" | "no-canvas";

function fixture(fault: Fault) {
  const events: string[] = [];
  const ids = new Map<string, number>();
  const resources = new Map<string, { bytes(): Promise<Uint8Array>; text(): Promise<string> }>();
  const native: SettingsWindowNode[] = [];
  const add = (path: string, value: SettingsWindowNode) => {
    const id = native.push(value);
    ids.set(path, id);
    resources.set(path, {
      async bytes() { events.push(`bytes:${path}`); return Uint8Array.of(id); },
      async text() { events.push(`text:${path}`); return "BASE"; },
    });
  };
  const dialog = node("Panel", {}, [
    node("CaptionWindow", { frame: "CaptionDialog", setCloseButton: "cancel" }, [
      node("TextButton", { name: "ok", texture: "dialogButton" }),
      node("Panel", { autoLoadImage: "close_" }),
    ]),
  ]);
  const graphics = node("Panel", { name: "graphic" }, [
    node("TextButton", { name: "graphicTab", texture: "graphicTabImage" }),
  ]);
  const game = node("Panel", {
    name: "game", windowRect: fault === "invalid-game-layout" ? "oops" : "0 0 940 700",
  }, [
    node("Container", { name: "vipCont" }, [
      node("Label", { text: "#sb(infoOption)" }),
      node("Label", { text: "#sb(premiumHideDesc)" }),
    ]),
    node("Container", { name: "riderSchoolCont" }),
    node("Container", { name: "tierGradeCont" }),
    node("Container", { name: "onAutoReadyCont" }, [
      node("PlaneCheckButton", { name: "onAutoReady" }),
      node("Label", { text: "Auto ready" }),
    ]),
    node("Container", { name: "receiveOption" }, [
      node("Label", { text: "#sb(receiveOption)" }),
    ]),
    node("Container", {
      name: "onIgnoreRequestFriendMsgCont", leftTopWH: "36 420 868 26",
    }, [node("PlaneCheckButton", { name: "friend" })]),
    node("Container", { name: "onIgnoreInviteMsgCont" }),
    node("Container", { name: "recOption" }),
    node("Panel", { texture: "gameTexture", autoImage: "gameIcon_" }),
  ]);
  if (fault === "missing-game-template") game.children = game.children.filter(child =>
    attribute(child, "name") !== "onAutoReadyCont");
  if (fault === "missing-speed-target") game.children = game.children.filter(child =>
    attribute(child, "name") !== "vipCont");
  const keyboard = node("Panel", { name: "keyboard" }, [
    node("ScrollBar", { name: "keymapScroll" }),
  ]);
  const config = node("Config");
  const frameNames = ["CaptionDialog", "TabBoxLarge", "GrayInnerFrame",
    "GrayInputBox", "DefaultEdit", "SelectBtn", "VSection",
    "DefaultCheckButton", "NewHorizonScrollButton", "NewHorizonScrollArea",
    "BulletLeftButton", "BulletRightButton", "DefaultVerticalScrollArea",
    "DefaultVerticalScrollButton", "HSection"];
  const frames = node("Frames", {}, frameNames.map(name => node(name, {}, [
    node("Normal", { texture: `frame_${name}` }),
  ])));
  const strings = node("StringBag", {}, [node("Entry", { n: "option" }, [
    node("Value", { c: "cn", v: "设置覆盖" }),
  ])]);
  const message = node("Message", {}, [node("CaptionWindow", {
    name: "keyError", texture: "messageFrame",
  }, [node("TextButton", { name: "okButton", texture: "messageButton" })])]);
  const path = (name: string) => `dialog/optionDialog/${name}.bml`;
  add(path("mq_dialog@zz"), dialog);
  add(path("view_graphicsOption@zz"), graphics);
  add(path("view_gameOption@cn"), game);
  add(path("view_keyboardMap@zz"), keyboard);
  add("gui_/monocoque/config.bml", config);
  add("gui_/monocoque/frame.bml", frames);
  add(path("dialog_stringBag"), strings);
  add("dialog2_/customMessageBox/mq_dialog@zz.bml", message);
  resources.set("etc_/baseStringBag.xml", {
    async bytes() { events.push("bytes:etc_/baseStringBag.xml");
      return Uint8Array.of(0); },
    async text() { events.push("text:etc_/baseStringBag.xml");
      return fault === "invalid-xml" ? "INVALID" : "BASE"; },
  });
  resources.set("gui_/font/SourceHanSansCN-Bold.otf", {
    async bytes() { events.push("bytes:gui_/font/SourceHanSansCN-Bold.otf");
      return Uint8Array.of(42); },
    async text() { return ""; },
  });
  if (fault === "missing-bml" || fault === "duplicate-bml")
    resources.delete(path("view_graphicsOption@zz"));

  const resourceFor = (name: string) => ({
    async bytes() { events.push(`bytes:${name}`);
      return new TextEncoder().encode(name); },
    async text() { return ""; },
  });
  const library: SettingsWindowResourceLibrary = {
    canonicalCandidates(candidate) {
      events.push(`candidate:${candidate}`);
      if (candidate === path("view_graphicsOption@zz") && fault === "duplicate-bml")
        return [resourceFor(candidate), resourceFor(candidate)];
      const resource = resources.get(candidate);
      if (resource) return [resource];
      if (!candidate.endsWith(".png")) return [];
      const imageName = candidate.slice(candidate.lastIndexOf("/") + 1);
      if (fault === "missing-image" && imageName === "frame_CaptionDialog.png")
        return [];
      const directory = imageName === "대화상자경고.png"
        ? "dialog2_/customMessageBox" : imageName === "gameTexture.png"
          ? "stage_/common" : imageName === "frame_CaptionDialog.png"
            ? "gui_/monocoque" : "dialog/optionDialog";
      if (!candidate.startsWith(`${directory}/`)) return [];
      if (fault === "duplicate-image" && candidate.endsWith("/dialogButton.png"))
        return [resourceFor(candidate), resourceFor(candidate)];
      return [resourceFor(candidate)];
    },
  };
  const dependencies: SettingsWindowAssetDependencies = {
    parseBml: bytes => native[bytes[0]! - 1]!,
    decodePng: async () => ({ width: 2, height: 1,
      pixels: Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8) }),
    attribute,
    frameState: source => ({
      texture: attribute(source, "texture") ?? "",
      caption: { x: 0, y: 0, width: 0, height: 0 },
      left: { x: 0, y: 0, width: 0, height: 0 },
      right: { x: 0, y: 0, width: 0, height: 0 },
      client: { x: 0, y: 0, width: 0, height: 0 },
      bottom: { x: 0, y: 0, width: 0, height: 0 },
      captionLeftMargin: 0, captionRightMargin: 0,
      bottomLeftMargin: 0, bottomRightMargin: 0, clientType: "none",
    }),
    buttonStyle: (button, _config, frameTree) => ({
      frameName: "DefaultEdit", states: Array.from({ length: 4 }, () => ({
        frame: dependencies.frameState(frameTree.children[0]!.children[0]!),
        textRender: attribute(button, "textRender") ?? "default",
        textColor: "black", textColor2: "black",
      })),
    }),
    loadAutoImage: async (_library, _caption, _directory) =>
      node("ImageButton", { name: "cancel", autoLoadImage: "close_" }),
    registerFont: (family, bytes) => ({ family, bytes: [...bytes] }),
    scrollbarAssets: (_scroll, frameTree) => ({
      areaFrame: dependencies.frameState(frameTree.children[12]!.children[0]!),
      buttonFrames: [dependencies.frameState(frameTree.children[13]!.children[0]!)],
      minButtonHeight: 25,
    }),
  };
  return { library, dependencies, events };
}

const releaseNames = ["_i", "qc0", "Kc0", "Qg", "_T", "Xc0", "GT", "MF",
  "Ec", "Ml", "Yc0", "Zc0", "Qc0", "Vc0"];
function originalLoader(dependencies: SettingsWindowAssetDependencies):
  (library: SettingsWindowResourceLibrary) => Promise<unknown> {
  return new Function("s2", "p2", "T", "Ft", "m4", "ma", "f5", "Hv",
    "addGraphicsPresentationOptions",
    `${releaseNames.map(sourceOf).join("\n")}; return qc0;`)(
    dependencies.parseBml, dependencies.decodePng, dependencies.attribute,
    dependencies.frameState, dependencies.buttonStyle, dependencies.loadAutoImage,
    dependencies.registerFont, dependencies.scrollbarAssets,
    addGraphicsPresentationOptions,
  ) as (library: SettingsWindowResourceLibrary) => Promise<unknown>;
}

function snapshot(assets: any, released = false) {
  return {
    definition: assets.definition,
    // The browser-only graphics checkbox is layered onto the native definition.
    graphics: released ? addGraphicsPresentationOptions(assets.graphics) : assets.graphics,
    game: assets.game,
    keyboard: assets.keyboard, keymapScrollbar: assets.keymapScrollbar,
    keyMessageBox: assets.keyMessageBox, config: assets.config,
    frames: [...assets.frames],
    styles: [...assets.styles].map(([key, value]) => [key, value]),
    images: [...assets.images].map(([key, value]) =>
      [key, { width: value.width, height: value.height,
        canvasWidth: value.image.width, canvasHeight: value.image.height }]),
    strings: [...assets.strings], font: assets.font,
  };
}

async function compare(fault: Fault) {
  const original = fixture(fault);
  const authored = fixture(fault);
  const run = async (task: () => Promise<unknown>, events: string[],
    released = false) => {
    try { return { value: snapshot(await task(), released), events }; }
    catch (error) { return { error: (error as Error).message, events }; }
  };
  assert.deepEqual(await run(() => loadSettingsWindowAssets(
    authored.library, authored.dependencies), authored.events),
  await run(() => originalLoader(original.dependencies)(original.library),
    original.events, true), fault);
}

test("settings resource blueprint, images, strings and failures match release qc0", async () => {
  const previous = Object.fromEntries(["document", "ImageData", "DOMParser"].map(name =>
    [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  let canvasAvailable = true;
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: { createElement: () => ({
      width: 0, height: 0,
      getContext: () => canvasAvailable ? { putImageData() {} } : null,
    }) } },
    ImageData: { configurable: true, value: class {
      constructor(public pixels: Uint8ClampedArray,
        public width: number, public height: number) {}
    } },
    DOMParser: { configurable: true, value: class {
      parseFromString(text: string) {
        const value = { getAttribute: (name: string) => name === "n" ? "option" :
          name === "c" ? "cn" : name === "v" ? "设置" : null, children: [] };
        return { querySelector: (selector: string) =>
          selector === "parsererror" && text === "INVALID" ? {} : null,
        documentElement: { children: [{ getAttribute: (name: string) =>
          name === "n" ? "option" : null, children: [value] }] },
        querySelectorAll: () => [],
        };
      }
    } },
  });
  try {
    for (const fault of ["none", "missing-bml", "duplicate-bml",
      "missing-game-template", "invalid-game-layout", "missing-speed-target",
      "missing-image", "duplicate-image", "invalid-xml"] as const)
      await compare(fault);
    canvasAvailable = false;
    await compare("no-canvas");
  } finally {
    for (const [name, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});

test("official BGM catalog parser matches release Dc0", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "DOMParser");
  Object.defineProperty(globalThis, "DOMParser", { configurable: true, value: class {
    parseFromString(text: string) {
      const bgm = (attributes: Record<string, string>) => ({
        getAttribute: (name: string) => attributes[name] ?? null,
      });
      const values = [
        { id: "1", theme: "kart", name: "lobby" },
        { id: "0", theme: "kart", name: "bad" },
        { id: "2", theme: "bad/path", name: "invalid" },
        { id: "3", theme: "kart", name: "second" },
      ].map(bgm);
      return {
        querySelector: (selector: string) =>
          selector === "parsererror" && text === "INVALID" ? {} : null,
        querySelectorAll: (selector: string) => selector === "bgmList > bgm"
          ? values : selector === "StringBag > k" ? [{
            getAttribute: (name: string) => name === "n" ? "lobby" : null,
            children: [{ getAttribute: (name: string) => name === "c" ? "cn" :
              name === "v" ? "大厅" : null }],
          }] : [],
      };
    }
  } });
  try {
    const original = new Function(`${sourceOf("Dc0")}; return Dc0;`)() as
      (catalog: string, strings: string) => unknown;
    for (const [catalog, strings] of [["BGM", "STRINGS"],
      ["INVALID", "STRINGS"], ["BGM", "INVALID"]]) {
      const run = (fn: (a: string, b: string) => unknown) => {
        try { return { value: fn(catalog!, strings!) }; }
        catch (error) { return { error: (error as Error).message }; }
      };
      assert.deepEqual(run(parseOfficialBgmChoices), run(original));
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, "DOMParser", previous);
    else Reflect.deleteProperty(globalThis, "DOMParser");
  }
});
