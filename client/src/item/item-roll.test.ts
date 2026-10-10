import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { fnv1a32, itemRoll, itemRollKey, itemRollSucceeds } from "./item-roll";

interface Vector {
  raceId: string; useId: number; hazardId: number; victimId: string; kind: string;
  key: string; hash: number; roll: number;
}

const fixture = JSON.parse(readFileSync(new URL("./item-roll-vectors.json", import.meta.url), "utf8")) as
  { vectors: Vector[] };

test("the shared roll vectors (TS and Go) hold", () => {
  assert.ok(fixture.vectors.length >= 5);
  // The five inputs the phase-3 contract names for both sides.
  assert.deepEqual(fixture.vectors.slice(0, 5).map(vector => vector.key), [
    "r1|1|0|p1|rocket", "race-uuid|42|0|victim|devil", "x|0|7|v|banana", "abc|9|0|def|headband",
    "r|3|0|a|balloon",
  ]);
  for (const vector of fixture.vectors) {
    assert.equal(itemRollKey(vector), vector.key);
    assert.equal(fnv1a32(vector.key), vector.hash, vector.key);
    assert.equal(itemRoll(vector), vector.roll, vector.key);
  }
});

test("FNV-1a hashes UTF-8 bytes; missing ids are 0; success is roll < p", () => {
  assert.equal(fnv1a32(""), 0x811c9dc5);
  assert.equal(fnv1a32("a"), 0xe40c292c);
  assert.equal(fnv1a32("foobar"), 0xbf9cf968);
  // UTF-8, not UTF-16 code units.
  assert.equal(fnv1a32("车"), (() => {
    let hash = 0x811c9dc5;
    for (const byte of [0xe8, 0xbd, 0xa6]) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
    return hash;
  })());
  assert.equal(itemRollKey({ raceId: "r", victimId: "v", kind: "mine" }), "r|0|0|v|mine");
  const input = { raceId: "r1", useId: 1, victimId: "p1", kind: "rocket" };
  assert.equal(itemRoll(input), 6);
  assert.equal(itemRollSucceeds(input, 7), true);
  assert.equal(itemRollSucceeds(input, 6), false);
  assert.equal(itemRollSucceeds(input, 0), false);
  assert.equal(itemRollSucceeds({ ...input, kind: "devil" }, 100), true);
});
