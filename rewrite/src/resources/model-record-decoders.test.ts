import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ModelBinaryCursor } from "./model-binary-cursor";
import {
  createModelRecordDecoders, isModelElement, readAlphaProperty,
  readAuxiliaryGeometry, readControllerBase, readModelElement, readModelKeys,
  readPathController, readRigidGeometry, readSkinnedGeometry,
  readZBufferProperty, validateModelIndex,
} from "./model-record-decoders";
import { ModelObjectReader, modelClassStamps } from "./model-object-reader";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("function M4(");
const end = release.indexOf("class a7 {", start);
assert.ok(start > 0 && end > start);
const original = new Function("PI", "mh", "Z20", "L6",
  `${release.slice(start, end)}\nreturn { M4, e90, t90, n90, i90, r90, s90, o90,
    a90, c90, l90, o7, u90, h90, d90, f90, p90, g90, Ve, Wx, Kn };`)(
  200_000, 2_000_000, 4_000_000, () => ({}),
) as Record<string, (...args: never[]) => unknown>;
const originalReaderStart = release.indexOf("class s7 {");
assert.ok(originalReaderStart > 0 && originalReaderStart < start);
const OriginalReader = new Function("H20", "q20", "K20", "j20", "oe", "PI", "X20",
  "mh", "Z20", "L6",
  `${release.slice(originalReaderStart, end)}\nreturn s7;`)(
    18346, 18363, 10154, 10171, modelClassStamps, 200_000, 256,
    2_000_000, 4_000_000, () => ({}),
  ) as new () => ModelObjectReader;

class Writer {
  readonly data: number[] = [];
  u8(value: number) { this.data.push(value & 255); return this; }
  u16(value: number) { return this.u8(value).u8(value >>> 8); }
  u32(value: number) { return this.u16(value).u16(value >>> 16); }
  f32(value: number) {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setFloat32(0, value, true);
    this.data.push(...new Uint8Array(buffer));
    return this;
  }
  vec3(x = 0, y = 0, z = 0) { return this.f32(x).f32(y).f32(z); }
  bounds() { return this.vec3(-1, -2, -3).vec3(1, 2, 3); }
  string(value: string) {
    this.u32(value.length);
    for (const character of value) this.u16(character.charCodeAt(0));
    return this;
  }
  bytes() { return new Uint8Array(this.data); }
}

function compare(name: string, readable: (...args: never[]) => unknown,
  data: Uint8Array, reader?: ModelObjectReader, ...args: unknown[]) {
  const old = new ModelBinaryCursor(data);
  const current = new ModelBinaryCursor(data);
  let expected: unknown;
  let actual: unknown;
  const inputs = name === "Ve" ? args : [reader, ...args];
  try { expected = original[name]!(old as never, ...inputs as never[]); }
  catch (error) { expected = error; }
  try { actual = readable(current as never, ...inputs as never[]); }
  catch (error) { actual = error; }
  if (expected instanceof Error) {
    assert.ok(actual instanceof Error);
    assert.equal(actual.message, expected.message);
  } else assert.deepEqual(actual, expected);
  assert.equal(current.position, old.position, name);
}

const emptyReader = {
  readObject: () => ({ value: { className: "Relement" } }),
  readTyped: () => ({ encoding: "new", id: 1, value: {} }),
} as unknown as ModelObjectReader;

function emptyElementBytes() {
  const writer = new Writer().string("root").u32(0);
  for (let i = 0; i < 5; i++) writer.vec3(i, i + 1, i + 2);
  writer.bounds().u8(0).u32(3).bounds().f32(1.5).u8(1);
  for (let i = 0; i < 11; i++) writer.u8(0);
  writer.u8(0);
  return writer;
}

test("model element and property payloads match release", () => {
  const element = emptyElementBytes().bytes();
  compare("M4", (cursor: ModelBinaryCursor, reader: ModelObjectReader, name: string) =>
    readModelElement(cursor, reader, name, () => ({})), element, emptyReader, "Relement");
  const decoders = createModelRecordDecoders(() => ({}));
  compare("e90", decoders.decodeKart as (...args: never[]) => unknown,
    new Writer().string("root").u32(0)
      .vec3().vec3().vec3().vec3().vec3().bounds().u8(0).u32(3)
      .bounds().f32(1.5).u8(1)
      .u8(0).u8(0).u8(0).u8(0).u8(0).u8(0).u8(0).u8(0).u8(0).u8(0).u8(0)
      .u8(0).f32(0.2).bounds().f32(1).f32(2).f32(3).f32(4).bytes(), emptyReader);
  compare("c90", readAlphaProperty as (...args: never[]) => unknown,
    new Writer().u8(1).u32(2).u32(3).u8(4).u32(5).u8(6).bytes());
  compare("l90", readZBufferProperty as (...args: never[]) => unknown,
    new Writer().u32(4).u8(1).bytes());
  compare("o7", readControllerBase as (...args: never[]) => unknown,
    new Writer().u32(1).u32(2).u32(3).u32(4).f32(0.5)
      .u32(6).u32(7).u32(8).bytes());
});

test("rigid, skin and auxiliary geometry validation matches release", () => {
  compare("o90", readRigidGeometry as (...args: never[]) => unknown,
    new Writer().u32(0).u32(0).u32(0).u32(0).bytes());
  compare("s90", readSkinnedGeometry as (...args: never[]) => unknown,
    new Writer().u32(0).u32(0).u32(0).u32(0).bytes());
  compare("a90", readAuxiliaryGeometry as (...args: never[]) => unknown,
    new Writer().u16(0).u8(0).u8(0).u8(0).u16(0).u8(0).u16(0).bytes(), emptyReader);
  compare("o90", readRigidGeometry as (...args: never[]) => unknown,
    new Writer().u32(0).u32(0).u32(1).u16(0).u16(1).f32(0).f32(0).u32(0).bytes());
  assert.equal(isModelElement({ className: "ReKart" }), original.Wx!({ className: "ReKart" } as never));
  assert.equal(isModelElement({ className: "Other" }), original.Wx!({ className: "Other" } as never));
  assert.throws(() => validateModelIndex(5, 2, "slot"), /slot索引 5 越界/);
});

test("fixed and composite key records match release", () => {
  const fixed = new Writer().u32(1).u32(1)
    .u8(1).u8(2).u8(3).u8(4).u8(5).u8(6).u8(7).u8(8).bytes();
  compare("Ve", readModelKeys as (...args: never[]) => unknown,
    fixed, undefined, "float");
  const composite = new Writer().u32(5).u32(0).u32(1).u32(2).u32(3).u32(4);
  for (let channel = 0; channel < 3; channel++)
    composite.u32(1).u32(1).u8(1).u8(2).u8(3).u8(4).u8(5).u8(6).u8(7).u8(8);
  compare("Ve", readModelKeys as (...args: never[]) => unknown,
    composite.bytes(), undefined, "vec3");
  compare("Ve", readModelKeys as (...args: never[]) => unknown,
    new Writer().u32(99).u32(0).bytes(), undefined, "rotation");
});

test("path controller tail and absent channels match release", () => {
  const writer = new Writer().u32(1).u32(2).u32(3).u32(4).f32(0.5)
    .u32(6).u32(7).u32(8).u8(0).u8(0)
    .u32(11).u32(12).u16(13).u32(14).u16(15)
    .u8(1).u8(2).u8(3).u8(4).u8(5);
  compare("g90", readPathController as (...args: never[]) => unknown,
    writer.bytes(), emptyReader);
});

test("Object47 root uses the migrated reader and record decoders together", () => {
  const data = new Writer().u16(18346).u32(modelClassStamps.Relement).u16(7);
  data.data.push(...emptyElementBytes().bytes());
  const bytes = data.bytes();
  const expectedCursor = new ModelBinaryCursor(bytes);
  const actualCursor = new ModelBinaryCursor(bytes);
  const expected = new OriginalReader().readObject(expectedCursor);
  const actual = new ModelObjectReader(createModelRecordDecoders(() => ({})))
    .readObject(actualCursor);
  assert.deepEqual(actual, expected);
  assert.equal(actualCursor.remaining, expectedCursor.remaining);
});
