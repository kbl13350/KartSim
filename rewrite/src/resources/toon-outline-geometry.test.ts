import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { BufferAttribute, BufferGeometry, DynamicDrawUsage } from "three";

import {
  appendOutlineSection, appendOutlineStrip, bridgeOutlineStrip, buildOutlineLinks,
  classifyOutlineFaces, emitClosedOutlineSections, emitOpenOutlineSections,
  emitOutlineConflicts, emitOutlineJoin, emitOutlineVertex, expandOutlineStrip,
  linkOutlineEdge, outlineDirection, outlineSectionOutgoingDirection,
  publishOutlineGeometry, requireOutlineVertexCapacity, resetOutlineWorkspace,
  selectOutlineEdge, type OutlinePoint, type ToonOutlineWorkspace,
} from "./toon-outline-geometry";
import { copyToonFrameInto, disposeToonFrame, dropToonFrame,
  prepareToonBodyIndex, rememberToonRigidFrame, setToonBatched,
  takeToonFrame, updateToonBodyGeometry, type ToonFrameHost } from "./toon-outline-frame";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

interface OriginalWorkspace extends ToonOutlineWorkspace {
  classifyFaces(): void;
  resetFrameWorkspace(): void;
  buildLinks(): void;
  emitOpenSections(): void;
  emitClosedSections(): void;
  emitConflicts(): void;
  expandStrip(): void;
  publishGeometry(): void;
}
interface OriginalFrame extends ToonFrameHost {
  setBatched(value: boolean): void;
  dropFrame(): void;
  takeFrame(after: number, through: number): boolean;
  copyFrameInto(positions: Float32Array, colors: Float32Array, indices: Uint32Array,
    vertexOffset: number, indexOffset: number, baseVertex: number): void;
  rememberRigidFrame(body: { geometry: BufferGeometry }, width: number, height: number): void;
  updateBodyGeometry(geometry: BufferGeometry): void;
  dispose(): void;
}

async function releaseWorkspace() {
  const source = await readFile(releaseFile, "utf8");
  const classStart = source.indexOf("class N6 {");
  const helperStart = source.indexOf("function h8(", classStart);
  const helperEnd = source.indexOf("\nclass on {", helperStart);
  assert.ok(classStart >= 0 && helperStart > classStart && helperEnd > helperStart);
  return new Function("_0", "r1", "yb", `${source.slice(classStart, helperStart)}
    ${source.slice(helperStart, helperEnd)}
    const $c = true;
    return { Original: N6, direction: h8 };`)(BufferAttribute, DynamicDrawUsage,
    () => 42) as {
      Original: { prototype: OriginalWorkspace };
      direction(from: OutlinePoint, to: OutlinePoint): number;
    };
}

function point(x: number, y: number): OutlinePoint {
  return { x, y, z: 0.5, rhw: 1, invalid: false };
}

function attribute<T extends Float32Array | Uint16Array>(array: T) {
  return { array, count: array.length / (array instanceof Float32Array ? 4 : 1),
    updateRanges: [] as Array<{ start: number; count: number }>,
    clearUpdateRanges() { this.updateRanges.length = 0; }, needsUpdate: false };
}

function fixture(): ToonOutlineWorkspace & { drawRange: { start: number; count: number } } {
  const projected = [point(0, 0), point(2, 0), point(1, 2),
    point(3, 2), point(-1, 1), point(4, -1)];
  const faces = [
    { positionIndices: [0, 1, 2], adjacentFaceIndices: [65535, 1, 65535], outlineOpenEdge: 1 },
    { positionIndices: [2, 1, 3], adjacentFaceIndices: [0, 65535, 65535], outlineOpenEdge: 1 },
    { positionIndices: [0, 1, 4], adjacentFaceIndices: [65535, 65535, 65535], outlineOpenEdge: 1 },
    { positionIndices: [2, 3, 5], adjacentFaceIndices: [65535, 65535, 65535], outlineOpenEdge: 1 },
  ] as ToonOutlineWorkspace["source"]["faces"];
  const drawRange = { start: 0, count: 0 };
  const host = {
    source: { faces }, projected,
    classificationFaces: faces.map((face, index) => ({
      a: projected[face.positionIndices[0]]!,
      b: projected[face.positionIndices[1]]!,
      c: projected[face.positionIndices[2]]!,
      doubleSided: index % 2 === 1,
    })),
    classes: new Uint8Array(faces.length),
    links: projected.map(() => ({ predecessor: -1, successor: -1 })),
    conflicts: new Uint32Array(faces.length * 6),
    consumed: new Uint8Array(projected.length),
    section: new Uint32Array(projected.length),
    conflictValueCount: 0, sectionCount: 0, vertexCount: 0,
    stripCount: 0, triangleCount: 0,
    frameProfile: Array.from({ length: 1024 }, (_, index) => ({
      x: (index % 7) * 0.1, y: (index % 11) * -0.04, valid: index % 9 !== 0,
    })),
    centerColor: [1, 0.5, 0.25, 1], outerColor: [0, 0, 0, 0.75],
    positionAttribute: attribute(new Float32Array(512)),
    colorAttribute: attribute(new Float32Array(512)),
    indexAttribute: attribute(new Uint16Array(768)),
    strip: new Uint16Array(256),
    geometry: { setDrawRange(start: number, count: number) {
      drawRange.start = start; drawRange.count = count;
    } },
    drawRange,
    positionUpdateRange: { start: 0, count: 0 },
    colorUpdateRange: { start: 0, count: 0 },
    indexUpdateRange: { start: 0, count: 0 },
  } as ToonOutlineWorkspace & { drawRange: { start: number; count: number } };
  return host;
}

function rewritten(host: ToonOutlineWorkspace): OriginalWorkspace {
  const methods: ThisType<OriginalWorkspace> & Partial<OriginalWorkspace> = {
    classifyFaces() { classifyOutlineFaces(this); },
    resetFrameWorkspace() { resetOutlineWorkspace(this); },
    buildLinks() { buildOutlineLinks(this); },
    edgeSelected(face: number, edge: number, faceClass: number) {
      return selectOutlineEdge(this, face, edge, faceClass);
    },
    linkOrRecordConflict(from: number, to: number) { linkOutlineEdge(this, from, to); },
    emitOpenSections() { emitOpenOutlineSections(this); },
    emitClosedSections() { emitClosedOutlineSections(this); },
    appendSection(closed: boolean) { appendOutlineSection(this, closed); },
    sectionOutgoingDirection(index: number, fallback: number, closed: boolean) {
      return outlineSectionOutgoingDirection(this, index, fallback, closed);
    },
    emitJoin(vertex: number, incoming: number, outgoing: number, bridge: boolean) {
      emitOutlineJoin(this, vertex, incoming, outgoing, bridge);
    },
    emitVertex(vertex: number, offset: ToonOutlineWorkspace["frameProfile"][number] | undefined,
      center: boolean) { emitOutlineVertex(this, vertex, offset, center); },
    emitConflicts() { emitOutlineConflicts(this); },
    requireVertexCapacity(additional: number) { requireOutlineVertexCapacity(this, additional); },
    bridge(first: number) { bridgeOutlineStrip(this, first); },
    appendStrip(index: number) { appendOutlineStrip(this, index); },
    expandStrip() { expandOutlineStrip(this); },
    publishGeometry() { publishOutlineGeometry(this); },
  };
  return Object.assign(host, methods) as OriginalWorkspace;
}

function snapshot(host: ToonOutlineWorkspace & { drawRange: { start: number; count: number } }) {
  return {
    classes: [...host.classes], links: host.links.map(link => ({ ...link })),
    conflicts: [...host.conflicts], consumed: [...host.consumed],
    section: [...host.section], conflictValueCount: host.conflictValueCount,
    sectionCount: host.sectionCount, vertexCount: host.vertexCount,
    stripCount: host.stripCount, triangleCount: host.triangleCount,
    positions: [...host.positionAttribute.array], colors: [...host.colorAttribute.array],
    indices: [...host.indexAttribute.array], strip: [...host.strip],
    drawRange: { ...host.drawRange },
    ranges: [host.positionAttribute, host.colorAttribute, host.indexAttribute]
      .map(item => ({ ranges: item.updateRanges.map(range => ({ ...range })),
        needsUpdate: item.needsUpdate })),
  };
}

test("Toon 描边方向量化含半偶数舍入与发行版一致", async () => {
  const { direction } = await releaseWorkspace();
  for (let index = -200; index <= 200; index++) {
    const from = point((index % 13) / 256, (index % 17) / 256);
    const to = point((index * 11 % 31) / 128, (index * 7 % 29) / 128);
    assert.equal(outlineDirection(from, to), direction(from, to), `direction ${index}`);
  }
});

test("Toon 描边面分类、开放/闭合轮廓、冲突边和动态 buffer 与发行版一致", async () => {
  const { Original } = await releaseWorkspace();
  for (const classes of [[0, 1, 0, 2], [0, 0, 0, 0], [1, 1, 2, 3]]) {
    const old = Object.assign(Object.create(Original.prototype), fixture()) as OriginalWorkspace &
      { drawRange: { start: number; count: number } };
    const current = rewritten(fixture()) as OriginalWorkspace &
      { drawRange: { start: number; count: number } };
    old.classifyFaces();
    current.classifyFaces();
    assert.deepEqual(snapshot(current), snapshot(old), "classification");
    old.classes.set(classes);
    current.classes.set(classes);
    for (const host of [old, current]) {
      host.resetFrameWorkspace();
      host.buildLinks();
      host.emitOpenSections();
      host.emitClosedSections();
      host.emitConflicts();
      host.expandStrip();
      host.publishGeometry();
    }
    assert.deepEqual(snapshot(current), snapshot(old), `classes ${classes.join(",")}`);
  }
});

function frameFixture() {
  const geometry = new BufferGeometry();
  const positionAttribute = new BufferAttribute(new Float32Array(32), 4);
  const colorAttribute = new BufferAttribute(new Float32Array(32), 4);
  const indexAttribute = new BufferAttribute(new Uint16Array(24), 1);
  for (let index = 0; index < 32; index++) {
    positionAttribute.array[index] = index / 10;
    colorAttribute.array[index] = index / 20;
  }
  indexAttribute.array.set([1, 2, 3, 4, 5, 6]);
  const events: string[] = [];
  const host = {
    source: { faces: new Array(4) }, classes: new Uint8Array([0, 1, 2, 3]),
    geometry, object: { visible: true },
    positionAttribute, colorAttribute, indexAttribute,
    vertexCount: 6, stripCount: 7, triangleCount: 6,
    updateSerial: 30, frameEmitted: true,
    frameViewportValue: { width: 800, height: 600 },
    cachedBody: undefined, cachedPosition: undefined,
    cachedPositionVersion: -1, cachedIndexVersion: -1,
    cachedWidth: 0, cachedHeight: 0, cachedProfile: undefined,
    cachedEnabled: false, cachedEmitted: false, cachedViewport: undefined,
    cachedProjection: new Float32Array(16), frameProfile: {},
    bodySourceIndices: undefined, bodyIndex: undefined,
    bodyIndexUpdateRange: { start: 0, count: 0 },
    batched: false,
    batchDisposer: () => events.push("batch"),
    material: { dispose: () => events.push("material") },
    prepareBodyIndex(geometry: BufferGeometry) {
      return prepareToonBodyIndex(this as unknown as ToonFrameHost, geometry);
    },
  };
  geometry.dispose = () => events.push("geometry");
  return { host, events };
}

function frameSnapshot(host: ToonFrameHost) {
  return {
    visible: host.object.visible, batched: host.batched,
    cachedBody: !!host.cachedBody,
    cachedPositionVersion: host.cachedPositionVersion,
    cachedIndexVersion: host.cachedIndexVersion,
    cachedWidth: host.cachedWidth, cachedHeight: host.cachedHeight,
    cachedProfile: host.cachedProfile,
    cachedEnabled: host.cachedEnabled, cachedEmitted: host.cachedEmitted,
    cachedViewport: host.cachedViewport,
    cachedProjection: host.cachedProjection ? [...host.cachedProjection] : undefined,
    vertexCount: host.vertexCount, stripCount: host.stripCount,
    triangleCount: host.triangleCount,
    updateSerial: host.updateSerial, frameEmitted: host.frameEmitted,
    frameViewportValue: host.frameViewportValue,
    drawRange: { ...host.geometry },
  };
}

test("Toon 描边帧缓存、批处理复制和可见车身索引与发行版一致", async () => {
  const { Original } = await releaseWorkspace();
  for (const indexed of [false, true]) {
    const oldFixture = frameFixture();
    const newFixture = frameFixture();
    const old = Object.assign(Object.create(Original.prototype), oldFixture.host) as OriginalFrame;
    const current = newFixture.host as unknown as ToonFrameHost;
    old.setBatched(true);
    setToonBatched(current, true);
    assert.equal(current.object.visible, old.object.visible);
    assert.equal(current.batched, old.batched);
    const positionOld = new Float32Array(48), colorOld = new Float32Array(48),
      indexOld = new Uint32Array(24);
    const positionNew = new Float32Array(48), colorNew = new Float32Array(48),
      indexNew = new Uint32Array(24);
    old.copyFrameInto(positionOld, colorOld, indexOld, 4, 2, 10);
    copyToonFrameInto(current, positionNew, colorNew, indexNew, 4, 2, 10);
    assert.deepEqual([positionNew, colorNew, indexNew],
      [positionOld, colorOld, indexOld]);
    assert.equal(takeToonFrame(current, 20, 35), old.takeFrame(20, 35));
    assert.equal(current.frameEmitted, old.frameEmitted);

    const bodyOld = new BufferGeometry();
    const bodyNew = new BufferGeometry();
    for (const body of [bodyOld, bodyNew]) {
      body.setAttribute("position", new BufferAttribute(new Float32Array(18), 3));
      body.setDrawRange(2, 12);
      if (indexed) body.setIndex(new BufferAttribute(
        new Uint16Array([5, 4, 3, 2, 1, 0, 6, 7, 8, 9, 10, 11]), 1));
    }
    old.classes.set([0, 1, 2, 3]);
    current.classes.set([0, 1, 2, 3]);
    old.updateBodyGeometry(bodyOld);
    updateToonBodyGeometry(current, bodyNew);
    assert.deepEqual(bodyNew.index?.array, bodyOld.index?.array);
    assert.deepEqual(bodyNew.drawRange, bodyOld.drawRange);
    assert.equal(bodyNew.index?.usage, bodyOld.index?.usage);
    assert.equal(bodyNew.index?.version, bodyOld.index?.version);
    assert.deepEqual(bodyNew.index?.updateRanges, bodyOld.index?.updateRanges);
    old.rememberRigidFrame({ geometry: bodyOld }, 800, 600);
    rememberToonRigidFrame(current, { geometry: bodyNew }, 800, 600, true);
    assert.deepEqual(frameSnapshot(current).cachedViewport,
      frameSnapshot(old).cachedViewport);
    assert.deepEqual({ version: current.cachedPositionVersion,
      index: current.cachedIndexVersion, width: current.cachedWidth,
      height: current.cachedHeight, enabled: current.cachedEnabled },
    { version: old.cachedPositionVersion, index: old.cachedIndexVersion,
      width: old.cachedWidth, height: old.cachedHeight,
      enabled: old.cachedEnabled });
    old.dropFrame();
    dropToonFrame(current, () => 42);
    assert.equal(current.updateSerial, old.updateSerial);
    assert.equal(current.vertexCount, old.vertexCount);
    assert.equal(current.frameEmitted, old.frameEmitted);
    old.dispose();
    disposeToonFrame(current);
    assert.deepEqual(newFixture.events, oldFixture.events);
  }
});

test("车身索引仅在内容改变时上传，并保留尚未提交的更新范围", () => {
  const host = frameFixture().host as unknown as ToonFrameHost;
  const body = new BufferGeometry();
  body.setAttribute("position", new BufferAttribute(new Float32Array(36), 3));
  host.classes.set([0, 1, 2, 3]);
  updateToonBodyGeometry(host, body);
  const index = body.getIndex()!;
  const firstVersion = index.version;
  assert.deepEqual([...index.array].slice(0, 6), [0, 1, 2, 3, 5, 4]);

  // A second update can happen before the renderer consumes the first range.
  updateToonBodyGeometry(host, body);
  assert.equal(index.version, firstVersion);
  assert.deepEqual(index.updateRanges, [{ start: 0, count: 6 }]);

  // Shrinking and restoring an unchanged prefix needs only a draw-range edit.
  index.clearUpdateRanges();
  host.classes.set([0, 2, 2, 3]);
  updateToonBodyGeometry(host, body);
  assert.deepEqual(body.drawRange, { start: 0, count: 3 });
  assert.equal(index.version, firstVersion);
  host.classes.set([0, 1, 2, 3]);
  updateToonBodyGeometry(host, body);
  assert.deepEqual(body.drawRange, { start: 0, count: 6 });
  assert.equal(index.version, firstVersion);
  assert.deepEqual(index.updateRanges, []);

  host.classes.set([1, 0, 2, 3]);
  updateToonBodyGeometry(host, body);
  assert.deepEqual([...index.array].slice(0, 6), [0, 2, 1, 3, 4, 5]);
  assert.equal(index.version, firstVersion + 1);
  assert.deepEqual(index.updateRanges, [{ start: 0, count: 6 }]);

  host.classes.fill(2);
  updateToonBodyGeometry(host, body);
  assert.deepEqual(body.drawRange, { start: 0, count: 0 });
  host.classes.fill(0);
  updateToonBodyGeometry(host, body);
  assert.deepEqual([...index.array], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(index.version, firstVersion + 2);
  assert.deepEqual(index.updateRanges, [{ start: 0, count: 12 }]);

  // Multiple changes before a draw must retain edits outside a later, shorter
  // range, so re-showing those faces cannot expose stale GPU indices.
  index.clearUpdateRanges();
  host.classes.set([1, 1, 2, 3]);
  updateToonBodyGeometry(host, body);
  assert.deepEqual(index.updateRanges, [{ start: 0, count: 6 }]);
  host.classes.set([0, 2, 2, 3]);
  updateToonBodyGeometry(host, body);
  assert.deepEqual(index.updateRanges, [{ start: 0, count: 6 }]);
  const pendingVersion = index.version;
  host.classes.set([0, 1, 2, 3]);
  updateToonBodyGeometry(host, body);
  assert.equal(index.version, pendingVersion);
  assert.deepEqual(index.updateRanges, [{ start: 0, count: 6 }]);
});
