import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { deflateSync, inflateSync } from "node:zlib";
import { parse } from "@babel/parser";
import {
  decodeKrData,
  decodeKsvBody,
  decodeKsvFile,
  encodeKrData,
  encodeKsvBody,
  encodeKsvFile,
  ksvAdler32,
  ksvVersionHash,
  xorKrData,
} from "../src/game/ghost/ksv-codec.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const names = new Set([
  "SD", "ED", "CD", "_y", "Gy", "uh0", "hh0", "yD", "AD", "bD", "k_",
  "dh0", "MD", "Ff", "ph0", "gh0", "mh0", "wh0", "vh0", "yh0",
  "TD", "_D", "Mh0", "xh0", "Sh0",
]);
const declarations = parse(source, { sourceType: "module" }).program.body
  .filter(node => ["FunctionDeclaration", "ClassDeclaration"].includes(node.type) && names.has(node.id?.name))
  .map(node => source.slice(node.start, node.end));
assert.equal(declarations.length, names.size, "all released KSV declarations were found");
const adlerNode = parse(source, { sourceType: "module" }).program.body
  .find(node => node.type === "FunctionDeclaration" && node.id?.name === "Dt");
assert.ok(adlerNode);

const compression = {
  deflate(bytes, options) { return deflateSync(bytes, options); },
  inflate(bytes) { return inflateSync(bytes); },
};
const context = { Uint8Array, DataView, TextEncoder, compression };
runInNewContext(`
  const ah0 = 12, ch0 = 12, pD = [8, 9, 11, 12], gD = 83,
    I_ = 912888630, mD = 1500;
  const fD = compression;
  ${source.slice(adlerNode.start, adlerNode.end)}
  ${declarations.join("\n")}
  globalThis.reference = { Dt, _y, Gy, dh0, MD, Ff, ph0, gh0, mh0, wh0, Mh0 };
`, context);
const reference = context.reference;

function plain(value) {
  if (value instanceof Uint8Array) return [...value];
  if (Array.isArray(value)) return Array.from(value, plain);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  }
  return value;
}

const baseEquipment = {
  character: 11, kart: -23, plate: 34, goggle: 45, balloon: 56,
  equ2: 67, headband: 78, replay: 89, cane: 90, equ3: 12,
  apparel: 23, equ4: 34, plateText: "中A🎮", startSlot: 3,
  unknownPlayerFlag: 0, equ5: 45, equ6: 56, equ7: 67,
  equ8: 78, equ9: 89, equ10: 90,
};

function equipment(version, kart) {
  return version <= 9
    ? { ...baseEquipment, kart, paint: 104 }
    : { ...baseEquipment, kart, kartPaint: 105, characterColor: 106, equ11: 101, equ12: 102 };
}

function recording(version) {
  const one = { time: 0, x: 100, y: -200, z: 3500, w: 10000, qx: -5, qy: 6, qz: 7, status: 65535 };
  const two = { time: 104, x: -32768, y: 32767, z: -22000, w: -10000, qx: 4, qy: -3, qz: 2, status: 16 };
  return {
    headerVersion: version,
    recordTitle: "记录🎮",
    regionCode: -13,
    unknown1_1: 255,
    contestType: 9,
    playerNameHash: 0,
    unknown1_2: 0x12345678,
    recorderAccount: "账号-A",
    recorderName: "车手甲",
    recordingDateDays: 241,
    recordingDateTime: 1240,
    recordChecksum: 0,
    isOfficial: true,
    description: "计时赛\0说明",
    trackName: "transformer_r02",
    unknown3: -400,
    bestTimeMs: 34567,
    contestImg: "赛道.png",
    opaqueBlob: version >= 12 ? Uint8Array.of(0, 1, 2, 3, 4) : Uint8Array.of(0, 1, 2, 3, 4, 5, 6, 7),
    unknown6: 7,
    speed: version >= 9 ? 7 : undefined,
    unknown7: 11,
    players: [
      { playerName: "玩家甲", clubName: "俱乐部", equipment: equipment(version, 42) },
      { playerName: "B🎮", clubName: "", equipment: equipment(version, 43) },
    ],
    recordVersion: version,
    records: [{ stamps: [one, two] }, { stamps: [two, one] }],
  };
}

test("release KSV checksums, version hashes and XOR stream match", () => {
  for (const bytes of [new Uint8Array(), Uint8Array.of(1, 2, 3), Uint8Array.from({ length: 140 }, (_, i) => i)]) {
    assert.equal(ksvAdler32(bytes), reference.Dt(bytes));
    for (const seed of [0, 1, 912888630, 0xffffffff]) {
      assert.deepEqual([...xorKrData(bytes, seed)], [...reference.MD(bytes, seed)]);
    }
  }
  for (const version of [0, 8, 9, 10, 11, 12, 20]) {
    assert.equal(ksvVersionHash(version, "header"), reference._y(version));
    assert.equal(ksvVersionHash(version, "record"), reference.Gy(version));
  }
});

test("v8/v9/v11/v12 body, equipment and frames match release bytes", () => {
  for (const version of [8, 9, 11, 12]) {
    for (const zCeiling of [1500, 3000]) {
      const fixture = recording(version);
      const expected = reference.Mh0(fixture, zCeiling);
      const actual = encodeKsvBody(fixture, zCeiling);
      assert.deepEqual([...actual], [...expected], `version ${version}, ceiling ${zCeiling}`);
      assert.deepEqual(plain(decodeKsvBody(actual, zCeiling)), plain(reference.wh0(expected, zCeiling)));
      const file = encodeKsvFile(fixture, zCeiling, compression);
      assert.deepEqual([...file], [...reference.ph0(fixture, zCeiling)]);
      assert.deepEqual(plain(decodeKsvFile(file, zCeiling, compression)), plain(reference.Ff(file, zCeiling)));
    }
  }
});

test("all KRData compression and encryption flags decode like release", () => {
  const body = encodeKsvBody(recording(12), 3000);
  for (const flags of [0, 1, 2, 3]) {
    const payload = (flags & 1) ? deflateSync(body, { level: 9 }) : body;
    const seed = 0x12345678;
    const encrypted = (flags & 2) ? reference.MD(payload, seed) : payload;
    const envelope = new Uint8Array(6 + ((flags & 2) ? 4 : 0) + ((flags & 1) ? 4 : 0) + encrypted.length);
    const view = new DataView(envelope.buffer);
    envelope[0] = 83;
    envelope[1] = flags;
    view.setUint32(2, reference.Dt(body), true);
    let offset = 6;
    if (flags & 2) { view.setUint32(offset, seed, true); offset += 4; }
    if (flags & 1) { view.setInt32(offset, body.length, true); offset += 4; }
    envelope.set(encrypted, offset);
    assert.deepEqual([...decodeKrData(envelope, compression)], [...reference.gh0(envelope)]);
  }
  assert.deepEqual([...encodeKrData(body, compression)], [...reference.mh0(body)]);
});

test("released validation errors remain unchanged", () => {
  const valid = recording(12);
  const cases = [
    () => ({ ...valid, opaqueBlob: Uint8Array.of(1, 2), headerVersion: 8, recordVersion: 8, speed: undefined, players: valid.players.map(p => ({ ...p, equipment: equipment(8, 42) })) }),
    () => ({ ...valid, speed: undefined }),
    () => ({ ...valid, headerVersion: 8, recordVersion: 8, speed: 7, opaqueBlob: new Uint8Array(8), players: valid.players.map(p => ({ ...p, equipment: equipment(8, 42) })) }),
    () => ({ ...valid, headerVersion: 8, recordVersion: 8, speed: undefined, opaqueBlob: new Uint8Array(8) }),
  ];
  for (const make of cases) {
    const fixture = make();
    let actual, expected;
    try { encodeKsvBody(fixture, 1500); } catch (error) { actual = error.message; }
    try { reference.Mh0(fixture, 1500); } catch (error) { expected = error.message; }
    assert.equal(actual, expected);
  }
  const validFile = encodeKsvFile(valid, 3000, compression);
  for (const file of [
    new Uint8Array(),
    Uint8Array.of(1, 2, 3, 4),
    Uint8Array.of(2, 0, 0, 0, 83, 0),
    Uint8Array.from(validFile, (value, index) => index === 9 ? value ^ 1 : value),
  ]) {
    let actual, expected;
    try { decodeKsvFile(file, 3000, compression); } catch (error) { actual = error.message; }
    try { reference.Ff(file, 3000); } catch (error) { expected = error.message; }
    assert.equal(actual, expected);
  }
});

test("unsupported versions, mismatched versions and malformed frame counts match release", () => {
  const base = recording(12);
  const body = encodeKsvBody(base, 3000);
  const unknownHeader = Uint8Array.from(body);
  new DataView(unknownHeader.buffer).setUint32(0, ksvVersionHash(10, "header"), true);
  const mismatchedRecord = encodeKsvBody({ ...base, recordVersion: 11 }, 3000);
  const unknownRecord = encodeKsvBody({ ...base, recordVersion: 10 }, 3000);
  const emptyRecords = encodeKsvBody({ ...base, records: [] }, 3000);
  const negativeRecordCount = Uint8Array.from(emptyRecords);
  new DataView(negativeRecordCount.buffer).setInt32(negativeRecordCount.length - 4, -1, true);
  const oneEmptyRecord = encodeKsvBody({ ...base, records: [{ stamps: [] }] }, 3000);
  const negativeFrameCount = Uint8Array.from(oneEmptyRecord);
  new DataView(negativeFrameCount.buffer).setInt32(negativeFrameCount.length - 4, -1, true);
  const trailingByte = Uint8Array.from([...body, 255]);
  for (const bytes of [
    new Uint8Array(), body.subarray(0, 6), unknownHeader,
    mismatchedRecord, unknownRecord, negativeRecordCount,
    negativeFrameCount, trailingByte,
  ]) {
    let actual, expected;
    try { decodeKsvBody(bytes, 3000); } catch (error) { actual = error.message; }
    try { reference.wh0(bytes, 3000); } catch (error) { expected = error.message; }
    assert.equal(actual, expected);
  }
});
