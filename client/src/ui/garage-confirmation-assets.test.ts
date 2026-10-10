import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  garageConfirmationFontFamily, garageConfirmationLayout,
  garageConfirmationPartEquipRequest, loadGarageConfirmationAssets,
  loadGarageConfirmationBlueprint, loadGarageConfirmationFont,
  type ConfirmationNode, type GarageConfirmationAssetDependencies,
  type GarageConfirmationLibrary,
} from "./garage-confirmation-assets";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("const PR = \"KartSim Garage Dialog SourceHanSansCN\";");
const end = release.indexOf("\nclass xQ {", start);
assert.ok(start > 0 && end > start);

function node(name: string, attributes: Record<string, string> = {},
  children: ConfirmationNode[] = []): ConfirmationNode {
  return { name, attributes, children };
}

async function exercise(readable: boolean) {
  const events: unknown[] = [];
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const item = (name: string, attributes: Record<string, string> = {},
    children: ConfirmationNode[] = []) => node(name,
      { name, ...attributes }, children);
  const definition = node("Root", {}, [item("Window", {
    name: "captionWnd", frame: "Dialog", leftTopWH: "0 0 400 200",
  }, [
    item("Window", { name: "iconPanel", leftTopWH: "0 0 25 26" }),
    item("Label", { name: "textLabel" }),
    item("Window", { frame: "HSection" }),
    item("Container", {}, [
      item("Button", { name: "okButton", windowSize: "100 30" }),
      item("Button", { name: "cancelButton" }),
    ]),
  ])]);
  const frameGroup = (name: string, states: string[]) => node(name, {},
    states.map(state => item(state, { texture: `${name}-${state}` })));
  const skin = node("Root", {}, [
    frameGroup("Dialog", ["Activated"]), frameGroup("HSection", ["Normal"]),
    frameGroup("TextButton", ["Normal", "MouseOn", "Clicked"]),
    frameGroup("DefaultFocusedButton", ["Normal", "MouseOn", "Clicked"]),
  ]);
  const config = node("Config");
  const strings = node("Root", {}, [
    node("Entry", { n: "plantTune" }, [node("Text", { c: "cn", v: " 装备测试 " })]),
    node("Entry", { n: "confirmUseParts" }, [node("Text", {
      c: "cn", v: "使用[%s]|确认？",
    })]),
  ]);
  const paths = new Map<string, ConfirmationNode>([
    ["dialog2_/customMessageBox/mq_dialog@zz.bml", definition],
    ["gui_/monocoque/frame.bml", skin],
    ["gui_/monocoque/config.bml", config],
    ["stage_/garageX/stage_stringBag.bml", strings],
  ]);
  const attribute = (entry: ConfirmationNode | undefined, key: string) =>
    (entry?.attributes as Record<string, string> | undefined)?.[key];
  const parseBml = (bytes: Uint8Array) => {
    const path = decoder.decode(bytes);
    events.push(["parse", path]);
    return paths.get(path)!;
  };
  const frame = (entry: ConfirmationNode) => ({ texture: attribute(entry, "texture") });
  const exactCanonicalCandidates = (path: string) => {
    events.push(["find", path]);
    return [{ sourceKind: "rho", sourceName: "gui_font.rho",
      bytes: async () => { events.push(["bytes", path]); return encoder.encode(path); } }];
  };
  const library = { exactCanonicalCandidates } satisfies GarageConfirmationLibrary;
  const loadFont = async (family: string, bytes: Uint8Array) => {
    events.push(["font", family, decoder.decode(bytes)]);
    return "font";
  };
  const createImageBitmap = async (blob: Blob) => ({
    path: decoder.decode(new Uint8Array(await blob.arrayBuffer())),
    close: () => events.push(["close-image"]),
  });
  const decodeImage = async (bytes: Uint8Array) => {
    const image = await createImageBitmap(new Blob([new Uint8Array(bytes)],
      { type: "image/png" }));
    events.push(["decode", image.path]);
    return image;
  };
  const rectangle = (entry: ConfirmationNode, parent: { x: number; y: number;
    width: number; height: number }, skin?: unknown, _extra?: unknown,
  size?: { width: number; height: number }) => {
    events.push(["rect", entry.name, skin, size]);
    return { x: parent.x + 10, y: parent.y + 20,
      width: size?.width ?? parent.width - 20,
      height: size?.height ?? parent.height - 40 };
  };
  const innerRectangle = (_frame: unknown, parent: { x: number; y: number;
    width: number; height: number }) => ({
      x: parent.x + 2, y: parent.y + 2,
      width: parent.width - 4, height: parent.height - 4,
    });
  const deps = { loadFont, parseBml, attribute, frame, decodeImage,
    rectangle, innerRectangle } as GarageConfirmationAssetDependencies;
  const Original = new Function("f5", "s2", "T", "Ft", "$p", "V0", "E9",
    "createImageBitmap", "Blob", `${release.slice(start, end)}\n` +
    "return { pQ, yQ, _w, bQ, MQ, PR };"
  )(loadFont, parseBml, attribute, frame,
    (image: { path: string; close(): void }) => {
      events.push(["decode", image.path]); return image;
    }, rectangle, innerRectangle, createImageBitmap, Blob) as {
      pQ(library: GarageConfirmationLibrary): Promise<unknown>;
      yQ(library: GarageConfirmationLibrary): Promise<any>;
      _w(library: GarageConfirmationLibrary): Promise<any>;
      bQ(strings: Map<string, string>, partName: string): any;
      MQ(blueprint: any, lines: number, size: { width: number; height: number },
        request: { singleAction?: boolean }): any;
      PR: string;
    };
  const font = readable ? await loadGarageConfirmationFont(library, deps)
    : await Original.pQ(library);
  const blueprint = readable ? await loadGarageConfirmationBlueprint(library, deps)
    : await Original._w(library);
  const first = readable ? await loadGarageConfirmationAssets(library, deps)
    : await Original.yQ(library);
  const second = readable ? await loadGarageConfirmationAssets(library, deps)
    : await Original.yQ(library);
  const requests = ["Tire", "Paint"].map(name => readable
    ? garageConfirmationPartEquipRequest(blueprint.strings, name)
    : Original.bQ(blueprint.strings, name));
  const layouts = [1, 3].flatMap(lines => [false, true].map(singleAction =>
    readable ? garageConfirmationLayout(blueprint as never, lines,
      { width: 1600, height: 900 }, { singleAction }, deps)
      : Original.MQ(blueprint, lines, { width: 1600, height: 900 },
        { singleAction })));
  return {
    font, fontFamily: readable ? garageConfirmationFontFamily : Original.PR,
    blueprint: {
      paths: [blueprint.definitionPath, blueprint.warningPath],
      frameNames: [...blueprint.frames.keys()],
      strings: [...blueprint.strings],
      sizes: [blueprint.baseSize, blueprint.iconSize, blueprint.buttonSize],
    },
    imagePaths: [...first.images.keys()], cached: first === second,
    requests, layouts, events,
  };
}

test("garage confirmation font, blueprint, image cache, copy and layout match release", async () => {
  assert.deepEqual(await exercise(true), await exercise(false));
});
