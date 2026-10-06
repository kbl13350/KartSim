import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { decodeBinaryXml, type BinaryXmlNode } from "../codecs/binary-xml";
import { loadTaskbarAssets, type TaskbarAssetEntry, type TaskbarFormatOperations } from "./taskbar-assets";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function between(start: string, end: string): string {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first > 0 && last > first, `${start} → ${end}`);
  return source.slice(first, last);
}
const formats: TaskbarFormatOperations = {
  decodePng: async bytes => ({ width: bytes[0] ?? 1, height: 2,
    pixels: new Uint8Array((bytes[0] ?? 1) * 2 * 4) }),
  layout: (node, viewport, image) => ({
    x: viewport.x + Number(node.attributes.find(item => item.name === "x")?.value ?? 0),
    y: viewport.y + Number(node.attributes.find(item => item.name === "y")?.value ?? 0),
    width: node.attributes.find(item => item.name === "windowSize")?.value.startsWith("1600")
      ? 1600 : image?.width ?? 42,
    height: image?.height ?? 66,
  }),
};
const Original = new Function("s2", "p2", "V0", "T", `
  ${between('const wF = "gui_/window/menu"', "class ry {")}
  ${between("function vF(n, e) {", "function Fc0(")}
  return kc0;
`)(decodeBinaryXml, formats.decodePng,
  (node: BinaryXmlNode, rect: unknown, _frame: unknown, image: unknown) =>
    formats.layout(node, rect as Parameters<TaskbarFormatOperations["layout"]>[1],
      image as Parameters<TaskbarFormatOperations["layout"]>[2]),
  (node: BinaryXmlNode, name: string) =>
    node.attributes.find(item => item.name === name)?.value,
) as typeof loadTaskbarAssets;

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}
function string(value: string): Uint8Array {
  return concat(u32(value.length), new Uint8Array(Buffer.from(value, "utf16le")));
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function node(name: string, attrs: Record<string, string> = {}, children: Uint8Array[] = []): Uint8Array {
  return concat(string(name), string(""), u32(Object.keys(attrs).length),
    ...Object.entries(attrs).flatMap(([key, value]) => [string(key), string(value)]),
    u32(children.length), ...children);
}

class FakeCanvas {
  width = 0;
  height = 0;
  getContext() { return { putImageData() {} }; }
}
class FakeImageData {
  constructor(readonly pixels: Uint8ClampedArray, readonly width: number,
    readonly height: number) {}
}

test("official tray asset lookup, four-frame variants and labels match release loader", async () => {
  const previousDocument = globalThis.document;
  const previousParser = globalThis.DOMParser;
  const previousImageData = globalThis.ImageData;
  globalThis.document = { createElement: () => new FakeCanvas() } as unknown as Document;
  globalThis.ImageData = FakeImageData as unknown as typeof ImageData;
  globalThis.DOMParser = class {
    parseFromString() {
      const keys = [
        ["option", "设置"], ["kartPass", "通行证"],
      ];
      return { querySelectorAll: () => keys.map(([name, value]) => ({
        getAttribute: (attribute: string) => attribute === "n" ? name : null,
        querySelector: () => ({ getAttribute: (attribute: string) =>
          attribute === "v" ? value : null }),
      })) };
    }
  } as unknown as typeof DOMParser;

  const definition = node("Tray", { image: "background@zz", windowSize: "fullwidth 66" }, [
    node("ImageButton", { name: "설정", autoLoadImage: "settings@zz",
      altText: "#sb(option)", x: "20" }),
    node("ImageButton", { name: "singleplay", autoLoadImage: "solo", x: "75" }),
    node("Skip", {}, [node("ImageButton", { name: "hidden", autoLoadImage: "hidden" })]),
  ]);
  const files = new Map<string, TaskbarAssetEntry>();
  const add = (path: string, bytes: Uint8Array, sourceName = "gui_window.rho") =>
    files.set(path.toLowerCase(), { sourceKind: "rho", sourceName, virtualPath: path,
      bytes: async () => bytes, text: async () => "<StringBag/>" });
  add("gui_/window/menu/tray@cn.bml", definition);
  add("etc_/baseStringBag.xml", new Uint8Array(), "etc.rho");
  add("gui_/window/menu/background@cn.png", new Uint8Array([9]));
  for (const frame of [1, 2, 3, 4]) {
    add(`gui_/window/menu/settings${frame}@cn.png`, new Uint8Array([frame + 4]));
    add(`gui_/window/menu/solo${frame}.png`, new Uint8Array([frame + 8]));
  }
  const library = { canonicalCandidates: (path: string) => {
    const file = files.get(path.toLowerCase());
    return file ? [file] : [];
  } };
  try {
    assert.deepEqual(await loadTaskbarAssets(library, formats), await Original(library));
  } finally {
    globalThis.document = previousDocument;
    globalThis.DOMParser = previousParser;
    globalThis.ImageData = previousImageData;
  }
});
