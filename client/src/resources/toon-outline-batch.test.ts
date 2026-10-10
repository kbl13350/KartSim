import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  AddEquation, BufferAttribute, BufferGeometry, CustomBlending,
  DoubleSide, DynamicDrawUsage, LessEqualDepth, Mesh,
  OneMinusSrcAlphaFactor, RawShaderMaterial, SrcAlphaFactor, Vector2,
} from "three";

import { ToonOutlineBatch, type OutlineBatchFrame } from "./toon-outline-batch";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseBatch(serial: () => number,
  configure: (selector: number, visible: boolean) => void) {
  const source = await readFile(releaseFile, "utf8");
  const begin = source.indexOf("class wK {");
  const end = source.indexOf("\nlet Rp =", begin);
  assert.ok(begin >= 0 && end > begin);
  return new Function("t9", "Vt", "B2", "y1", "s1", "u1", "l1", "v1",
    "R9", "_0", "r1", "D2", "ie", "vK", `${source.slice(begin, end)}
    return wK;`)(BufferGeometry, RawShaderMaterial, Vector2, LessEqualDepth,
    DoubleSide, CustomBlending, SrcAlphaFactor, OneMinusSrcAlphaFactor,
    AddEquation, BufferAttribute, DynamicDrawUsage, Mesh,
    (_object: Mesh, selector: number, visible: boolean) => configure(selector, visible),
    serial) as new () => ToonOutlineBatch;
}

function fakeFrame(name: string, depth: number, events: unknown[][],
  large = false): OutlineBatchFrame {
  return {
    setBatched: value => events.push([name, "batched", value]),
    takeFrame: (after, through) => {
      events.push([name, "take", after, through]); return true;
    },
    frameSortDepth: depth,
    frameWorldX: depth, frameWorldY: depth + 1, frameWorldZ: depth + 2,
    frameVertexCount: 3, frameTriangleCount: 3,
    frameViewport: { width: 800 + depth, height: 600 + depth },
    capacityVertexCount: large ? 18000 : 10,
    capacityIndexCount: large ? 18000 : 30,
    copyFrameInto: (positions, colors, indices,
      vertexOffset, indexOffset, baseVertex) => {
      events.push([name, "copy", vertexOffset, indexOffset, baseVertex]);
      positions.set([1, 2, 3, 4], vertexOffset);
      colors.set([0.1, 0.2, 0.3, 0.4], vertexOffset);
      indices.set([baseVertex, baseVertex + 1, baseVertex + 2], indexOffset);
    },
  };
}

function snapshot(batch: ToonOutlineBatch, events: unknown[][]) {
  return {
    material: { name: batch.material.name,
      vertexShader: batch.material.vertexShader,
      fragmentShader: batch.material.fragmentShader,
      viewport: batch.material.uniforms.viewportPx?.value.toArray(),
      transparent: batch.material.transparent,
      depthTest: batch.material.depthTest,
      depthWrite: batch.material.depthWrite,
      depthFunc: batch.material.depthFunc,
      side: batch.material.side,
      blending: batch.material.blending,
      blendSrc: batch.material.blendSrc,
      blendDst: batch.material.blendDst,
      blendEquation: batch.material.blendEquation,
      toneMapped: batch.material.toneMapped,
      forceSinglePass: batch.material.forceSinglePass },
    object: { position: batch.object.position.toArray(),
      frustumCulled: batch.object.frustumCulled,
      renderOrder: batch.object.renderOrder },
    capacities: [batch.positions.length, batch.colors.length,
      batch.indices.length],
    samples: [batch.positions.slice(0, 20), batch.colors.slice(0, 20),
      batch.indices.slice(0, 10)],
    attributeUsage: [batch.positionAttribute.usage,
      batch.colorAttribute.usage, batch.indexAttribute.usage],
    attributeRanges: [batch.positionAttribute.updateRanges,
      batch.colorAttribute.updateRanges, batch.indexAttribute.updateRanges],
    drawRange: { ...batch.geometry.drawRange },
    registered: batch.registered.size,
    watermark: batch.lastFlushWatermark,
    events,
  };
}

test("Toon 描边合批材质、容量增长、深度排序和 buffer 发布与发行版一致", async () => {
  const oldEvents: unknown[][] = [], newEvents: unknown[][] = [];
  let serial = 11;
  const Original = await releaseBatch(() => serial,
    (selector, visible) => oldEvents.push(["configure", selector, visible]));
  const old = new Original();
  const current = new ToonOutlineBatch({ currentSerial: () => serial,
    configureObject: (_object, selector, visible) =>
      newEvents.push(["configure", selector, visible]) });
  assert.deepEqual(snapshot(current, newEvents), snapshot(old, oldEvents), "constructor");
  const oldLow = fakeFrame("low", 1, oldEvents, true);
  const oldHigh = fakeFrame("high", 9, oldEvents);
  const newLow = fakeFrame("low", 1, newEvents, true);
  const newHigh = fakeFrame("high", 9, newEvents);
  old.register(oldLow); old.register(oldHigh); old.register(oldHigh);
  current.register(newLow); current.register(newHigh); current.register(newHigh);
  assert.deepEqual(snapshot(current, newEvents), snapshot(old, oldEvents), "register and expand");
  old.flush(); current.flush();
  assert.deepEqual(snapshot(current, newEvents), snapshot(old, oldEvents), "flush");
  serial = 12;
  old.unregister(oldHigh); current.unregister(newHigh);
  old.flush(); current.flush();
  assert.deepEqual(snapshot(current, newEvents), snapshot(old, oldEvents), "unregister and flush");
  old.dispose(); current.dispose();
  assert.deepEqual(snapshot(current, newEvents), snapshot(old, oldEvents), "dispose");
});
