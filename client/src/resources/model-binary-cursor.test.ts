import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ModelBinaryCursor } from "./model-binary-cursor";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class a7 {");
const end = release.indexOf("const Hx =", start);
assert.ok(start > 0 && end > start);
const Original = new Function(`${release.slice(start, end)}\nreturn a7;`)() as
  new (bytes: Uint8Array) => ModelBinaryCursor;

function compare(bytes: Uint8Array, actions: Array<[keyof ModelBinaryCursor, ...unknown[]]>) {
  const old = new Original(bytes);
  const current = new ModelBinaryCursor(bytes);
  for (const [method, ...args] of actions) {
    const invoke = (reader: ModelBinaryCursor) =>
      (reader[method] as (...values: unknown[]) => unknown).apply(reader, args);
    let expected: unknown;
    let actual: unknown;
    try { expected = invoke(old); } catch (error) { expected = error; }
    try { actual = invoke(current); } catch (error) { actual = error; }
    if (expected instanceof Error) {
      assert.ok(actual instanceof Error);
      assert.equal(actual.message, expected.message);
    } else assert.deepEqual(actual, expected);
    assert.equal(current.position, old.position);
    assert.equal(current.remaining, old.remaining);
  }
}

test("model cursor scalar, vector, bounds and UTF-16 reads match release", () => {
  const data = new Uint8Array(4 + 2 + 1 + 2 + 4 + 4 + 3 * 4 + 2 * 4 + 6 * 4 + 4 + 4);
  const view = new DataView(data.buffer);
  let offset = 0;
  view.setUint32(offset, 0x12345678, true); offset += 4;
  view.setUint16(offset, 3456, true); offset += 2;
  view.setUint8(offset, 99); offset += 1;
  view.setUint16(offset, 2, true); offset += 2;
  view.setUint32(offset, 4, true); offset += 4;
  view.setFloat32(offset, 1.25, true); offset += 4;
  for (let index = 0; index < 3 + 2 + 6; index++) {
    view.setFloat32(offset, index + 0.5, true); offset += 4;
  }
  view.setUint32(offset, 2, true); offset += 4;
  view.setUint16(offset, "A".charCodeAt(0), true); offset += 2;
  view.setUint16(offset, "B".charCodeAt(0), true);
  compare(data, [
    ["uint32"], ["uint16"], ["uint8"],
    ["count16", "test", 5], ["count32", "test", 5], ["float32"],
    ["vec3"], ["vec2"], ["bounds"], ["string"],
  ]);
});

test("model cursor truncated payloads and invalid counts match release diagnostics", () => {
  compare(new Uint8Array([2, 0]), [["count16", "triangles", 1], ["bytes", 3]]);
  compare(new Uint8Array([2, 0, 0, 0]), [["count32", "bones", 1], ["uint8"]]);
  compare(new Uint8Array([1, 0, 0, 0, 0, 216]), [["string"]]);
  compare(new Uint8Array([1, 2, 3]), [["ensure", -1], ["ensure", 4], ["uint32"]]);
});
