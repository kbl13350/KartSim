import assert from "node:assert/strict";
import test from "node:test";

import { ContainerStore, type BundledArchiveReader } from "../resources/container-store";
import type { ResourceManifest } from "../resources/manifest";
import { cloneValue } from "./brewser-polyfills";
import { brewserArchiveReader, httpArchiveReader } from "./bundled-archives";
import { CJK_FAMILY, markCjkFontReady, matchRegisteredFont, rememberFontFace, resetFontRegistry } from "./font-matching";
import { clipRegion, elementAtPoint, HIT_TEST_IGNORE } from "./hit-test";
import { normalizeServerOrigin } from "./network-page";
import { appAssetUrl, isPackagedPath } from "./platform";
import { platformDefaultGamepadMap } from "./switch-gamepad";
import { unicodeRegExp } from "./unicode-regexp";

const MiB = 1024 * 1024;
const SHA = "a".repeat(64);

function manifest(files: { name: string; size: number }[]): ResourceManifest {
  return { version: "p3553", revision: SHA, files: files.map(file => ({ ...file, mtimeMs: 0, sha256: SHA })) };
}

/** A container of `size` bytes whose byte at offset i is i % 251. */
function patternReader(log: [string, number, number][]): BundledArchiveReader {
  return {
    async read(name, start, end) {
      log.push([name, start, end]);
      return Uint8Array.from({ length: end - start }, (_, index) => (start + index) % 251).buffer;
    },
  };
}

test("bundled containers read from the reader without OPFS or downloads", async () => {
  const log: [string, number, number][] = [];
  const store = new ContainerStore({
    manifest: manifest([{ name: "stuff.rho", size: 8 * MiB }, { name: "aaa.pk", size: 1000 }]),
    bundled: patternReader(log),
    fetcher: () => { throw new Error("no network"); },
  });
  assert.equal(store.isBundled, true);
  assert.deepEqual([...await store.cachedNames()].sort(), ["aaa.pk", "stuff.rho"]);
  assert.equal(await store.remove("stuff.rho"), false);
  await store.preload(["stuff.rho"]);
  assert.deepEqual(log, []);

  // Small reads of one moment share the block planner: one read of the card.
  const source = store.source("stuff.rho");
  const [first, second] = await Promise.all([
    source.slice(100, 200).arrayBuffer(), source.slice(70_000, 70_010).arrayBuffer(),
  ]);
  assert.deepEqual([...new Uint8Array(first)].slice(0, 3), [100 % 251, 101 % 251, 102 % 251]);
  assert.equal(new Uint8Array(second)[0], 70_000 % 251);
  assert.equal(log.length, 1);
  assert.equal(log[0]![1], 0);

  // Cached blocks answer again; a large read goes straight to the card.
  await source.slice(150, 160).arrayBuffer();
  assert.equal(log.length, 1);
  const whole = new Uint8Array(await source.slice(MiB, 3 * MiB).arrayBuffer());
  assert.equal(whole.length, 2 * MiB);
  assert.equal(whole[0], MiB % 251);
  assert.deepEqual(log.at(-1), ["stuff.rho", MiB, 3 * MiB]);

  // ensure() hands back a lazy Blob-like object instead of downloading.
  const blob = await store.ensure("aaa.pk");
  assert.equal(blob.size, 1000);
  assert.equal(new Uint8Array(await blob.slice(10, 20).arrayBuffer())[0], 10);
  assert.equal(new Uint8Array(await store.readRange("aaa.pk", 5, 5)).length, 0);
});

test("a short bundled read is an error that names the SD card", async () => {
  const store = new ContainerStore({
    manifest: manifest([{ name: "track_a.rho", size: 4 * MiB }]),
    bundled: { read: async () => new ArrayBuffer(3) },
  });
  await assert.rejects(store.readRange("track_a.rho", 0, 2 * MiB), /SD 卡/);
});

test("Brewser reads use exclusive ends and report missing files", async () => {
  const calls: unknown[] = [];
  const reader = brewserArchiveReader({
    async readFile(path, options) {
      calls.push([path, options]);
      return path.endsWith("missing.rho") ? null : new ArrayBuffer((options?.end ?? 0) - (options?.start ?? 0));
    },
  }, "p3553");
  assert.equal((await reader.read("aaa.pk", 10, 20)).byteLength, 10);
  assert.deepEqual(calls, [["p3553/aaa.pk", { start: 10, end: 20 }]]);
  // end: 0 means "to the end of the file" in Brewser, so empty ranges never reach it.
  assert.equal((await reader.read("aaa.pk", 0, 0)).byteLength, 0);
  assert.equal(calls.length, 1);
  await assert.rejects(reader.read("missing.rho", 0, 4), /p3553\/missing\.rho/);
});

test("the browser fallback reads packaged containers by Range", async () => {
  const requests: [string, string][] = [];
  const reader = httpArchiveReader("./p3553", async (url, init) => {
    requests.push([url, String((init?.headers as Record<string, string>).Range)]);
    return url.includes("bad") ? new Response("whole", { status: 200 }) : new Response(new Uint8Array(4), { status: 206 });
  });
  assert.equal((await reader.read("DataPack1_00000.rho5", 4, 8)).byteLength, 4);
  assert.deepEqual(requests[0], ["./p3553/DataPack1_00000.rho5", "bytes=4-7"]);
  await assert.rejects(reader.read("bad.rho", 0, 4), /Range/);
});

test("packaged paths stay root-relative on the web build", () => {
  assert.equal(isPackagedPath("/ui/multiplayer/a.png"), true);
  assert.equal(isPackagedPath("/__p3553/resources"), true);
  assert.equal(isPackagedPath("/multiplayer/auth/config"), false);
  assert.equal(isPackagedPath("/uix/a.png"), false);
  assert.equal(appAssetUrl("/ui/a.png"), "/ui/a.png");
});

test("canvas fonts ask for a registered weight, generic families the Chinese face", () => {
  resetFontRegistry();
  rememberFontFace("P3528 Source Han Sans CN Ready", "normal", "normal");
  assert.equal(matchRegisteredFont("bold 16px P3528 Source Han Sans CN Ready"),
    '16px "P3528 Source Han Sans CN Ready"');
  assert.equal(matchRegisteredFont('bold italic 40px "P3528 Source Han Sans CN Ready", sans-serif'),
    '40px "P3528 Source Han Sans CN Ready"');
  rememberFontFace("KartSim Shop SourceHanSansCN", "700", "normal");
  assert.equal(matchRegisteredFont("700 14px 'KartSim Shop SourceHanSansCN'"), '700 14px "KartSim Shop SourceHanSansCN"');
  assert.equal(matchRegisteredFont("12px 'KartSim Shop SourceHanSansCN'"), '700 12px "KartSim Shop SourceHanSansCN"');
  assert.equal(matchRegisteredFont("bold 14px sans-serif"), "bold 14px sans-serif");
  markCjkFontReady();
  rememberFontFace(CJK_FAMILY, "normal", "normal");
  rememberFontFace(CJK_FAMILY, "bold", "normal");
  assert.equal(matchRegisteredFont("bold 14px sans-serif"), `bold 14px "${CJK_FAMILY}"`);
  assert.equal(matchRegisteredFont('16px/1.2 "Microsoft YaHei", sans-serif'), `16px/1.2 "${CJK_FAMILY}"`);
  assert.equal(matchRegisteredFont("10px Unknown"), "10px Unknown");
  assert.equal(matchRegisteredFont("caption"), "caption");
  resetFontRegistry();
});

test("letter patterns work with and without Unicode property escapes", () => {
  const name = unicodeRegExp("^[{L}_:][{L}{N}_.:-]*$");
  for (const value of ["kart", "跑跑卡丁车", "카트", "item_01", "ns:attr"]) assert.equal(name.test(value), true, value);
  for (const value of ["1kart", "a b", "<x>"]) assert.equal(name.test(value), false, value);
  // Brewser's V8 has no ICU: the same pattern from the fallback ranges.
  const NativeRegExp = RegExp;
  const fallback = (() => {
    globalThis.RegExp = function (source: string, flags?: string) {
      if (source.includes("\\p{")) throw new SyntaxError("Invalid property name");
      return new NativeRegExp(source, flags);
    } as unknown as RegExpConstructor;
    try { return unicodeRegExp("^[{L}{N}_@-]+$"); } finally { globalThis.RegExp = NativeRegExp; }
  })();
  for (const value of ["village_B04", "森林", "카트", "Ice-2"]) assert.equal(fallback.test(value), true, value);
  assert.equal(fallback.test("a/b"), false);
});

/** A minimal element tree for the hit test (Node has no DOM). */
interface FakeElement {
  tagName: string; attributes: Set<string>; style: Record<string, string>;
  rect: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  children: FakeElement[]; parentElement: FakeElement | null;
  hasAttribute(name: string): boolean;
  getBoundingClientRect(): FakeElement["rect"];
  readonly firstElementChild: FakeElement | null;
  readonly nextElementSibling: FakeElement | null;
}

function element(tagName: string, [left, top, width, height]: number[],
  style: Record<string, string> = {}, children: FakeElement[] = [], attributes: string[] = []): FakeElement {
  const node: FakeElement = {
    tagName, attributes: new Set(attributes), style, children, parentElement: null,
    rect: { left: left!, top: top!, width: width!, height: height!, right: left! + width!, bottom: top! + height! },
    hasAttribute(name) { return this.attributes.has(name); },
    getBoundingClientRect() { return this.rect; },
    get firstElementChild() { return this.children[0] ?? null; },
    get nextElementSibling() {
      const siblings = this.parentElement?.children ?? [];
      return siblings[siblings.indexOf(this) + 1] ?? null;
    },
  };
  for (const child of children) child.parentElement = node;
  return node;
}

test("the hit test picks the top element under the point", () => {
  const button = element("BUTTON", [100, 100, 80, 30]);
  const dialog = element("DIV", [0, 0, 400, 300], { position: "absolute", zIndex: "3" }, [button]);
  const canvas = element("CANVAS", [0, 0, 1280, 720]);
  const hud = element("DIV", [0, 0, 1280, 720], { position: "absolute", zIndex: "5", pointerEvents: "none" },
    [element("SPAN", [600, 10, 50, 20], { pointerEvents: "auto" }), element("SPAN", [700, 10, 50, 20])]);
  const cursor = element("CANVAS", [100, 100, 32, 32], { position: "fixed", zIndex: "2147483647" }, [], [HIT_TEST_IGNORE]);
  const hidden = element("DIV", [0, 0, 1280, 720], { position: "absolute", zIndex: "9" }, [], ["hidden"]);
  const root = element("BODY", [0, 0, 1280, 720], {}, [canvas, dialog, hud, cursor, hidden]);
  const at = (x: number, y: number) => elementAtPoint(x, y, root as unknown as Element) as unknown as FakeElement;
  assert.equal(at(110, 110), button);
  assert.equal(at(300, 200), dialog);
  assert.equal(at(800, 600), canvas);
  // pointer-events: none on the HUD layer is inherited; a child that sets auto is a hit again.
  assert.equal(at(610, 15), hud.children[0]);
  assert.equal(at(710, 15), canvas);
  // A later sibling without z-index stays below the z-indexed dialog.
  const late = element("DIV", [0, 0, 400, 300]);
  root.children.push(late);
  late.parentElement = root;
  assert.equal(at(110, 110), button);
  assert.equal(at(-5, 10), null);
  // A full-stage window clipped to its bubble lets the point through elsewhere.
  const bubble = element("DIV", [0, 0, 1280, 720], { position: "absolute", zIndex: "8", clipPath: "inset(0 50% 50% 0)" },
    [element("CANVAS", [0, 0, 1280, 720])]);
  root.children.push(bubble);
  bubble.parentElement = root;
  assert.equal(at(110, 110), bubble.children[0]);
  assert.equal(at(800, 600), canvas);
});

test("clip-path inset and polygon regions (windows that pass pointers through)", () => {
  const rect = { left: 80, top: 0, width: 1120, height: 630 };
  // ui/bml-kit.ts clipToStage of the 迷你提示窗 bubble.
  const inset = clipRegion("inset(72% 79.375% 7.55556% 3.25%)", rect)!;
  assert.equal(inset(200, 500), true);
  assert.equal(inset(494, 605), false);
  assert.equal(clipRegion("inset(10px)", { left: 0, top: 0, width: 100, height: 100 })!(5, 50), false);
  assert.equal(clipRegion("none", rect), undefined);
  const twoRects = clipRegion("polygon(nonzero, 0% 0%, 10% 10%, 20% 10%, 20% 20%, 10% 20%, 10% 10%, " +
    "0% 0%, 50% 50%, 60% 50%, 60% 60%, 50% 60%, 50% 50%, 0% 0%)", { left: 0, top: 0, width: 100, height: 100 })!;
  assert.equal(twoRects(15, 15), true);
  assert.equal(twoRects(55, 55), true);
  assert.equal(twoRects(35, 35), false);
  assert.equal(twoRects(90, 10), false);
  const triangle = clipRegion("polygon(0 0,100% 50%,0 100%)", { left: 0, top: 0, width: 100, height: 100 })!;
  assert.equal(triangle(10, 50), true);
  assert.equal(triangle(90, 10), false);
});

test("structuredClone keeps typed arrays, maps and cycles", () => {
  const bytes = new Uint8Array([1, 2, 3, 4]).subarray(1, 3);
  const source: Record<string, unknown> = { bytes, map: new Map([["a", { n: 1 }]]), set: new Set([1, 2]),
    date: new Date(5), list: [1, "two", null] };
  source.self = source;
  const copy = cloneValue(source) as typeof source;
  assert.notEqual(copy, source);
  assert.equal(copy.self, copy);
  assert.deepEqual([...(copy.bytes as Uint8Array)], [2, 3]);
  assert.notEqual((copy.bytes as Uint8Array).buffer, bytes.buffer);
  assert.deepEqual((copy.map as Map<string, unknown>).get("a"), { n: 1 });
  assert.equal((copy.date as Date).getTime(), 5);
  assert.throws(() => cloneValue({ f() {} }), /could not be cloned/);
});

test("server addresses are http(s) origins", () => {
  assert.equal(normalizeServerOrigin("http://192.168.1.10:8787/"), "http://192.168.1.10:8787");
  assert.equal(normalizeServerOrigin(" https://kart.example.com "), "https://kart.example.com");
  assert.equal(normalizeServerOrigin("http://host/path"), undefined);
  assert.equal(normalizeServerOrigin("ws://host"), undefined);
  assert.equal(normalizeServerOrigin(""), undefined);
  assert.equal(normalizeServerOrigin(null), undefined);
});

test("the web build keeps the release gamepad defaults", () => {
  const bindings = [{ index: 0 }, { index: 2 }, { index: 7 }];
  assert.deepEqual(platformDefaultGamepadMap(bindings, binding => binding.index * 10), { 0: 0, 2: 20, 7: 70 });
});
