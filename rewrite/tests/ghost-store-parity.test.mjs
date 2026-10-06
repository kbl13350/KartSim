import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import { encodeGhostFrames, decodeGhostFrames } from "../src/game/ghost/frame-codec.ts";
import {
  GhostRecordStore,
  persistGhostRecord,
  persistRawGhostRecord,
  restoreGhostRecord,
} from "../src/game/ghost/record-store.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const names = new Set(["SD", "ED", "TD", "_D", "Ah0", "bh0", "Pc", "L_", "_h0", "Df", "Th0"]);
const declarations = parse(source, { sourceType: "module" }).program.body
  .filter(node => ["FunctionDeclaration", "ClassDeclaration"].includes(node.type) && names.has(node.id?.name))
  .map(node => source.slice(node.start, node.end));
assert.equal(declarations.length, names.size, "all released frame and store declarations were found");

function fakeIndexedDb(initial = [], oldVersion = 0) {
  const rows = new Map(initial);
  let version = oldVersion;
  const cursorRequest = () => {
    const keys = [...rows.keys()].sort();
    let index = 0;
    const request = { result: null, error: null, onsuccess: null, onerror: null };
    const advance = () => queueMicrotask(() => {
      const key = keys[index++];
      request.result = key === undefined ? null : {
        key,
        value: rows.get(key),
        update(value) { rows.set(key, value); },
        continue: advance,
      };
      request.onsuccess?.();
    });
    advance();
    return request;
  };
  const db = {
    objectStoreNames: { contains: name => name === "ghosts" },
    createObjectStore(name) { assert.equal(name, "ghosts"); return store(); },
    transaction(name, mode) {
      assert.equal(name, "ghosts");
      const transaction = {
        error: null, oncomplete: null, onabort: null, onerror: null,
        objectStore(storeName) { assert.equal(storeName, name); return store(transaction, mode); },
      };
      return transaction;
    },
  };
  function store(transaction, mode) {
    return {
      get(key) {
        const request = { result: undefined, error: null, onsuccess: null, onerror: null };
        queueMicrotask(() => { request.result = rows.get(key); request.onsuccess?.(); });
        return request;
      },
      openCursor: cursorRequest,
      put(value, key) {
        assert.equal(mode, "readwrite");
        queueMicrotask(() => { rows.set(key, value); transaction.oncomplete?.(); });
      },
      delete(key) {
        assert.equal(mode, "readwrite");
        queueMicrotask(() => { rows.delete(key); transaction.oncomplete?.(); });
      },
    };
  }
  return {
    rows,
    factory: {
      open(name, wantedVersion) {
        assert.equal(name, "kartrider-web:p3528");
        assert.equal(wantedVersion, 3);
        const request = {
          result: db, transaction: db.transaction("ghosts", "versionchange"),
          error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null,
        };
        queueMicrotask(() => {
          if (version < wantedVersion) request.onupgradeneeded?.({ oldVersion: version });
          version = wantedVersion;
          setTimeout(() => request.onsuccess?.(), 0);
        });
        return request;
      },
    },
  };
}

function referenceRuntime(indexedDB) {
  const context = { indexedDB, Uint8Array, ArrayBuffer, DataView, queueMicrotask, setTimeout };
  runInNewContext(`
    const mD = 1500, Ch0 = "kartrider-web:p3528", _e = "ghosts", Eh0 = 3;
    ${declarations.join("\n")}
    globalThis.reference = { Ah0, bh0, Pc, L_, Th0 };
  `, context);
  return context.reference;
}

function normalize(value) {
  if (value instanceof ArrayBuffer) return [...new Uint8Array(value)];
  if (value instanceof Uint8Array) return [...value];
  if (Array.isArray(value)) return Array.from(value, normalize);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value;
}

const frames = [
  { time: 0, x: 0, y: 0, z: 0, w: 0, qx: 0, qy: 0, qz: 0, status: 0 },
  { time: 32767, x: -32768, y: -301, z: 49820, w: -1, qx: 1234, qy: -5678, qz: 9999, status: 65535 },
  { time: 70000, x: 8.9, y: -2.4, z: -3020, w: 13, qx: 14, qy: 15, qz: 16, status: 131071 },
];
const sample = { stamps: frames };

test("frame payload matches release bytes for both z widths and coercion edges", () => {
  const reference = referenceRuntime(fakeIndexedDb().factory);
  for (const zCeiling of [0, 1500, 3000]) {
    for (const record of [{ stamps: [] }, sample]) {
      const actual = encodeGhostFrames(record, zCeiling);
      const expected = reference.Ah0(record, zCeiling);
      assert.deepEqual([...actual], [...expected]);
      assert.deepEqual(normalize(decodeGhostFrames(actual, zCeiling)), normalize(reference.bh0(expected, zCeiling)));
    }
  }
});

test("frame payload retains released invalid-record errors", () => {
  const reference = referenceRuntime(fakeIndexedDb().factory);
  for (const bytes of [
    new Uint8Array(),
    Uint8Array.of(255, 255, 255, 255),
    Uint8Array.of(1, 0, 0, 0),
    Uint8Array.of(0, 0, 0, 0, 42),
    encodeGhostFrames(sample, 3000).subarray(0, 8),
  ]) {
    for (const zCeiling of [1500, 3000]) {
      let actual, expected;
      try { decodeGhostFrames(bytes, zCeiling); } catch (error) { actual = error.message; }
      try { reference.bh0(bytes, zCeiling); } catch (error) { expected = error.message; }
      assert.equal(actual, expected);
    }
  }
});

test("persisted v2/v3 rows and raw recordings match the release", async () => {
  const refDb = fakeIndexedDb();
  const actualDb = fakeIndexedDb();
  const reference = referenceRuntime(refDb.factory);
  globalThis.indexedDB = actualDb.factory;
  const original = new reference.Th0();
  const rewritten = new GhostRecordStore();
  const cases = [
    ["plain", { zCeiling: 1500, timeBase: "countdown", participants: [{ equipment: { kart: "A" }, record: sample }] }],
    ["source", { zCeiling: 3000, participants: [{ equipment: { kart: "B" }, record: sample, rawRecording: { frames: [1, 2] } }], originalKsvBytes: Uint8Array.of(3, 4, 5) }],
  ];
  try {
    for (const [key, record] of cases) {
      await original.put(key, record);
      await rewritten.put(key, record);
      assert.deepEqual(normalize(actualDb.rows.get(key)), normalize(refDb.rows.get(key)));
      assert.deepEqual(normalize(await rewritten.get(key)), normalize(await original.get(key)));
      assert.deepEqual(normalize(persistGhostRecord(record)), normalize(refDb.rows.get(key)));
      assert.deepEqual(normalize(restoreGhostRecord(refDb.rows.get(key))), normalize(await original.get(key)));
    }
    const raw = { metadata: { timeBase: "countdown", equipment: { kart: "C" } }, frames: [{ x: 4 }] };
    await original.putRaw("raw", raw, Uint8Array.of(9, 8));
    await rewritten.putRaw("raw", raw, Uint8Array.of(9, 8));
    assert.deepEqual(normalize(actualDb.rows.get("raw")), normalize(refDb.rows.get("raw")));
    assert.deepEqual(normalize(persistRawGhostRecord(raw, Uint8Array.of(9, 8))), normalize(refDb.rows.get("raw")));
    assert.deepEqual(normalize(await rewritten.list()), normalize(await original.list()));
    await original.delete("plain");
    await rewritten.delete("plain");
    assert.deepEqual(normalize(actualDb.rows.get("plain")), normalize(refDb.rows.get("plain")));
  } finally {
    delete globalThis.indexedDB;
  }
});

test("schema v1 rows migrate to v2 on database upgrade", async () => {
  const legacy = ["old", { zCeiling: 1500, equipment: { kart: 42 }, frames: encodeGhostFrames(sample, 1500).buffer }];
  const refDb = fakeIndexedDb([legacy], 1);
  const actualDb = fakeIndexedDb([legacy], 1);
  const reference = referenceRuntime(refDb.factory);
  globalThis.indexedDB = actualDb.factory;
  try {
    const original = new reference.Th0();
    const rewritten = new GhostRecordStore();
    assert.deepEqual(normalize(await rewritten.get("old")), normalize(await original.get("old")));
    assert.deepEqual(normalize(actualDb.rows.get("old")), normalize(refDb.rows.get("old")));
    assert.equal(actualDb.rows.get("old").schemaVersion, 2);
  } finally {
    delete globalThis.indexedDB;
  }
});
