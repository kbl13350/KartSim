import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { TrackBinaryCursor, TrackObjectRegistry } from "./track-binary-reader";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseClasses() {
  const source = await readFile(releaseFile, "utf8");
  const registryStart = source.indexOf("class YH {");
  const cursorStart = source.indexOf("let ZH = class {", registryStart);
  const end = source.indexOf("\nconst YG =", cursorStart);
  assert.ok(registryStart >= 0 && cursorStart > registryStart && end > cursorStart);
  return new Function("HW", "qW", "KW", "jW",
    `${source.slice(registryStart, end)}\nreturn { Registry:YH, Cursor:ZH };`)(
      18346, 18363, 10154, 10171) as {
    Registry: typeof TrackObjectRegistry; Cursor: typeof TrackBinaryCursor;
  };
}

function u16(value: number): number[] { return [value & 255, value >>> 8 & 255]; }
function u32(value: number): number[] {
  return [value & 255, value >>> 8 & 255, value >>> 16 & 255,
    value >>> 24 & 255];
}
function f32(value: number): number[] {
  const data = new ArrayBuffer(4);
  new DataView(data).setFloat32(0, value, true);
  return [...new Uint8Array(data)];
}

test("track.1s 游标的小端数值、向量和 UTF-16 字符串与发行版一致", async () => {
  const { Cursor } = await releaseClasses();
  const bytes = Uint8Array.from([9, ...u16(65534), ...u16(23456),
    ...u32(0x12345678), ...f32(1.25), ...f32(-2.5), ...f32(3.75),
    ...f32(4), ...f32(5), ...f32(6), ...u32(2),
    ...Buffer.from("赛A", "utf16le")]);
  const trace = (Reader: typeof TrackBinaryCursor) => {
    const reader = new Reader(bytes);
    const result = [reader.remaining, reader.uint8(), reader.int16(),
      reader.uint16(), reader.uint32(), reader.float32(), reader.vec2(),
      reader.vec3(), reader.string(), reader.remaining];
    return { result, position: reader.position };
  };
  assert.deepEqual(trace(TrackBinaryCursor), trace(Cursor));
});

test("track.1s 游标 lookahead、边界和无效字符串错误与发行版一致", async () => {
  const { Cursor } = await releaseClasses();
  const bytes = Uint8Array.from([...u16(18346), ...u32(0x12345678),
    ...u16(1), 255]);
  const trace = (Reader: typeof TrackBinaryCursor) => {
    const reader = new Reader(bytes);
    const output = [reader.isNewObject(), reader.peekUint32(2),
      [...reader.bytes(2)], reader.position, reader.isNewObject()];
    const capture = (run: () => unknown) => {
      try { return run(); } catch (error) { return String(error); }
    };
    output.push(capture(() => reader.skip(100)) as never,
      capture(() => reader.require(-1)) as never,
      capture(() => reader.peekUint32(99)) as never,
      reader.position as never);
    return output;
  };
  assert.deepEqual(trace(TrackBinaryCursor), trace(Cursor));
  const malformed = Uint8Array.from([...u32(1), 0, 0xd8]);
  const captureString = (Reader: typeof TrackBinaryCursor) => {
    try { return new Reader(malformed).string(); }
    catch (error) { return String(error); }
  };
  assert.equal(captureString(TrackBinaryCursor), captureString(Cursor));
});

test("track.1s 对象及字段的新建、引用和错误路径与发行版一致", async () => {
  const { Cursor, Registry } = await releaseClasses();
  const bytes = Uint8Array.from([
    ...u16(18346), ...u32(0x1234), ...u16(7), 42,
    ...u16(18363), ...u16(7),
    ...u16(10154), ...u16(2), 99,
    ...u16(10171), ...u16(2),
  ]);
  const trace = (Reader: typeof TrackBinaryCursor,
    Table: typeof TrackObjectRegistry) => {
    const cursor = new Reader(bytes);
    const registry = new Table();
    registry.register(0x1234, input => ({ value: input.uint8() }));
    const object = registry.readObjectOccurrence(cursor);
    const reference = registry.readObjectOccurrence(cursor);
    const field = registry.readFieldOccurrence(cursor, input => input.uint8());
    const fieldReference = registry.readFieldOccurrence(cursor, input => input.uint8());
    return { object, reference, field, fieldReference,
      sharedObject: object.value === reference.value,
      sharedField: field.value === fieldReference.value,
      position: cursor.position, objectIds: [...registry.objectIds],
      fieldIds: [...registry.fieldIds] };
  };
  assert.deepEqual(trace(TrackBinaryCursor, TrackObjectRegistry),
    trace(Cursor, Registry));

  const failureCases = [
    Uint8Array.from([...u16(18363), ...u16(7)]),
    Uint8Array.from([...u16(18346), ...u32(0x9999), ...u16(7)]),
    Uint8Array.from([...u16(1)]),
    Uint8Array.from([...u16(10171), ...u16(7)]),
    Uint8Array.from([...u16(8)]),
  ];
  for (const input of failureCases) {
    const capture = (Reader: typeof TrackBinaryCursor,
      Table: typeof TrackObjectRegistry) => {
      const reader = new Reader(input);
      const table = new Table();
      try {
        if (input[1] === 39 || input[1] === 0) table.readField(reader,
          cursor => cursor.uint8());
        else table.readObject(reader);
        return "success";
      } catch (error) { return String(error); }
    };
    assert.equal(capture(TrackBinaryCursor, TrackObjectRegistry),
      capture(Cursor, Registry));
  }
});
