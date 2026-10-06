import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { loadMultiplayerWindowAssets, type MultiplayerWindowAssetHost,
  type WindowNode } from "./multiplayer-window-assets";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

interface FixtureNode extends WindowNode { attributes: Record<string, string> }
function node(name: string, attributes: Record<string, string> = {},
  children: WindowNode[] = []): FixtureNode {
  return { name, attributes, children };
}

test("多人窗口图片、调色、字体与字符串资源和发行版一致", async () => {
  const release = await readFile(releaseFile, "utf8");
  const start = release.indexOf("class te {");
  const end = release.indexOf("\nfunction OM(", start);
  assert.ok(start >= 0 && end > start);

  const previousDocument = globalThis.document;
  const previousParser = globalThis.DOMParser;
  const previousImageData = globalThis.ImageData;
  class Canvas {
    width = 0;
    height = 0;
    pixels = new Uint8ClampedArray(4);
    getContext() {
      return {
        putImageData: (image: { data: Uint8ClampedArray }) => {
          this.pixels = new Uint8ClampedArray(image.data);
        },
        drawImage: (image: Canvas) => {
          this.pixels = new Uint8ClampedArray(image.pixels);
        },
        getImageData: () => ({ data: new Uint8ClampedArray(this.pixels) }),
      };
    }
  }
  try {
    globalThis.document = { createElement: () => new Canvas() } as unknown as Document;
    globalThis.ImageData = class {
      data: Uint8ClampedArray;
      constructor(data: Uint8ClampedArray) { this.data = data; }
    } as unknown as typeof ImageData;
    globalThis.DOMParser = class {
      parseFromString() {
        return { querySelectorAll: () => [{
          getAttribute: (key: string) => key === "n" ? "base" : undefined,
          querySelector: () => ({ getAttribute: () => "简体中文" }),
        }] };
      }
    } as unknown as typeof DOMParser;

    const attribute = (entry: WindowNode, key: string) =>
      (entry as FixtureNode).attributes[key];
    const frameTree = node("frame", {}, [node("DefaultEdit", {}, [
      node("Normal", { texture: "frameTex" }),
    ])]);
    const configTree = node("config");
    const localStringBag = node("bag", {}, [node("k", { n: "local" }, [
      node("m", { c: "cn", v: "本地" }),
    ])]);
    const resource = {
      bytes: async () => Uint8Array.of(1, 2, 3),
      text: async () => "<bag/>",
    };
    const library = { canonicalCandidates: (candidate: string) =>
      candidate.endsWith("stage_stringBag.bml") ? [resource] : [] };
    const image = node("Image", {
      texture: "car", color: "255 255 128 64", textureOp: "modulate",
    });
    const series = node("ImageButton", { autoLoadImage: "button@zz" });
    const button = node("TextButton", { frame: "DefaultEdit" });
    const definition = node("Container", {}, [image, series, button]);
    const loadBml = async (_library: unknown, _root: string, name: string) =>
      name === "frame" ? frameTree : configTree;
    const findResource = () => resource;
    const decodeTexture = async () => ({
      width: 1, height: 1, pixels: Uint8Array.of(100, 80, 60, 255),
    });
    const frame = (entry: WindowNode) => ({ texture: attribute(entry, "texture") });
    const buttonStyle = () => ({ states: [{ frame: { texture: "buttonFrame" } }] });
    const parseBml = () => localStringBag;
    const loadFont = async (family: string, bytes: Uint8Array) =>
      ({ family, size: bytes.length });
    const original = new Function("F9", "U1", "p2", "Ft", "T", "m4", "s2",
      "f5", "Sn", `${release.slice(start, end)}\nreturn te;`)(
      loadBml, findResource, decodeTexture, frame, attribute, buttonStyle,
      parseBml, loadFont, "Window Font",
    ) as { prototype: { loadAssets(this: MultiplayerWindowAssetHost): Promise<void> } };
    const makeHost = (): MultiplayerWindowAssetHost => ({
      options: { library, roots: ["stage_/main"], definition,
        modulateTextures: true },
      frames: new Map(), textures: new Map(), styles: new Map(),
      images: new Map(), strings: new Map(),
    });
    const baseline = makeHost();
    const rewritten = makeHost();
    await original.prototype.loadAssets.call(baseline);
    await loadMultiplayerWindowAssets(rewritten, {
      loadBml, findResource, decodeTexture, frame, attribute, buttonStyle,
      parseBml, loadFont, fontFamily: "Window Font",
    });
    const sprite = (value: { image: HTMLCanvasElement; width: number; height: number }) => ({
      width: value.width, height: value.height,
      pixels: [...(value.image as unknown as Canvas).pixels],
    });
    const summary = (host: MultiplayerWindowAssetHost) => ({
      frames: [...host.frames].map(([key, value]) => [key, value]),
      textures: [...host.textures].map(([key, value]) =>
        [key.name, value.map(sprite)]),
      images: [...host.images].map(([key, value]) => [key, sprite(value)]),
      strings: [...host.strings], font: host.font,
    });
    assert.deepEqual(summary(rewritten), summary(baseline));
  } finally {
    globalThis.document = previousDocument;
    globalThis.DOMParser = previousParser;
    globalThis.ImageData = previousImageData;
  }
});
