import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ModelBinaryCursor } from "./model-binary-cursor";
import { ModelObjectReader, modelClassStamps } from "./model-object-reader";
import type { ModelObjectDecoders } from "./model-object-reader";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const constants = release.slice(release.indexOf("const H20 ="),
  release.indexOf("function Q20(", release.indexOf("const H20 =")));
const body = release.slice(release.indexOf("class s7 {"),
  release.indexOf("function M4(", release.indexOf("class s7 {")));
assert.ok(constants.includes("const H20") && body.includes("class s7"));

const decode = (tag: string) => (reader: ModelBinaryCursor) => ({ className: tag, byte: reader.uint8() });
const stubs = {
  M4: (_reader: ModelBinaryCursor, _owner: ModelObjectReader, name: string) => ({ className: name }),
  e90: decode("ReKart"), n90: decode("ReToonRigid"), i90: decode("ReTriList"),
  r90: decode("ReToonSkinned"), t90: decode("ReCharacter"),
  c90: decode("AlphaProperty"), l90: decode("ZBufProperty"),
  d90: decode("PrsTontroller"), p90: decode("VisTontroller"),
  g90: decode("PathTontroller"), u90: decode("KartSequence"),
  h90: decode("CharSequence"), f90: decode("IntTontroller"),
};
const Original = new Function(...Object.keys(stubs),
  `${constants}\n${body}\nreturn { Reader: s7, stamps: oe };`)(...Object.values(stubs)) as {
  Reader: new () => ModelObjectReader;
  stamps: Record<string, number>;
};
const decoders: ModelObjectDecoders = {
  readElement: stubs.M4, decodeKart: stubs.e90, decodeRigid: stubs.n90,
  decodeTriangles: stubs.i90, decodeSkinned: stubs.r90,
  decodeCharacter: stubs.t90, decodeAlpha: stubs.c90,
  decodeZBuffer: stubs.l90, decodePrs: stubs.d90,
  decodeVisibility: stubs.p90, decodePath: stubs.g90,
  decodeKartSequence: stubs.u90, decodeCharacterSequence: stubs.h90,
  decodeInteger: stubs.f90,
};

function bytes(...parts: Array<["u16" | "u32" | "u8" | "f32", number]>): Uint8Array {
  const total = parts.reduce((length, [type]) => length +
    (type === "u8" ? 1 : type === "u16" ? 2 : 4), 0);
  const output = new Uint8Array(total);
  const view = new DataView(output.buffer);
  let offset = 0;
  for (const [type, value] of parts) {
    if (type === "u8") { view.setUint8(offset, value); offset += 1; }
    else if (type === "u16") { view.setUint16(offset, value, true); offset += 2; }
    else if (type === "u32") { view.setUint32(offset, value, true); offset += 4; }
    else { view.setFloat32(offset, value, true); offset += 4; }
  }
  return output;
}

function compare(bytes: Uint8Array, operations: Array<"object" | "typed">) {
  const old = new Original.Reader();
  const current = new ModelObjectReader(decoders);
  const oldCursor = new ModelBinaryCursor(bytes);
  const newCursor = new ModelBinaryCursor(bytes);
  for (const operation of operations) {
    const invoke = (reader: ModelObjectReader, cursor: ModelBinaryCursor) =>
      operation === "object" ? reader.readObject(cursor)
        : reader.readTyped(cursor, c => ({ value: c.uint8() }));
    let expected: unknown;
    let actual: unknown;
    try { expected = invoke(old, oldCursor); } catch (error) { expected = error; }
    try { actual = invoke(current, newCursor); } catch (error) { actual = error; }
    if (expected instanceof Error) {
      assert.ok(actual instanceof Error);
      assert.equal(actual.message, expected.message);
    } else assert.deepEqual(actual, expected);
    assert.equal(newCursor.position, oldCursor.position);
    assert.deepEqual(current.objects, old.objects);
    assert.deepEqual(current.typed, old.typed);
    assert.deepEqual(current.objectIds, old.objectIds);
    assert.deepEqual(current.typedIds, old.typedIds);
  }
}

test("Object47 and Typed27 new/reference records match release", () => {
  assert.deepEqual({ ...modelClassStamps, RePet2: undefined, PetSequence: undefined },
    { ...Original.stamps, RePet2: undefined, PetSequence: undefined });
  compare(bytes(
    ["u16", 18346], ["u32", modelClassStamps.AlphaProperty], ["u16", 7], ["u8", 23],
    ["u16", 18363], ["u16", 7],
    ["u16", 10154], ["u16", 9], ["u8", 42],
    ["u16", 10171], ["u16", 9],
  ), ["object", "object", "typed", "typed"]);
  compare(bytes(
    ["u16", 18346], ["u32", modelClassStamps.RePet2], ["u16", 3],
    ["f32", 0.75],
  ), ["object"]);
});

test("model object reader diagnostics and reference accounting match release", () => {
  compare(bytes(["u16", 18363], ["u16", 99]), ["object"]);
  compare(bytes(["u16", 10171], ["u16", 99]), ["typed"]);
  compare(bytes(["u16", 1234]), ["object"]);
  compare(bytes(["u16", 18346], ["u32", 0xdeadbeef], ["u16", 2]), ["object"]);
  compare(bytes(
    ["u16", 18346], ["u32", modelClassStamps.AlphaProperty], ["u16", 7], ["u8", 23],
    ["u16", 18346], ["u32", modelClassStamps.AlphaProperty], ["u16", 7], ["u8", 24],
  ), ["object", "object"]);
});
