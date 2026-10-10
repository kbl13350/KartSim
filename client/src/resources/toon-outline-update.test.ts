import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { BufferAttribute, BufferGeometry, Matrix4, PerspectiveCamera, Vector3 } from "three";

import { updateToonOutline, type ToonOutlineUpdateHost,
  type ToonOutlineUpdateDependencies, type ToonOverride,
  type ToonBody } from "./toon-outline-update";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseClass(profiles: {
  base: ToonOutlineUpdateDependencies["defaultProfile"];
  first: ToonOutlineUpdateDependencies["defaultProfile"];
  other: ToonOutlineUpdateDependencies["defaultProfile"];
}, override: ToonOverride | undefined) {
  const source = await readFile(releaseFile, "utf8");
  const begin = source.indexOf("class N6 {");
  const end = source.indexOf("\nfunction h8(", begin);
  assert.ok(begin >= 0 && end > begin);
  const colorFromArgb = (argb: number) => [((argb >>> 16) & 255) / 255,
    ((argb >>> 8) & 255) / 255, (argb & 255) / 255, ((argb >>> 24) & 255) / 255];
  const Original = new Function("_0", "bK", "AK", "Xm", "kp", "f8", "yb", "Mb", "$c",
    `${source.slice(begin, end)}; return N6;`)(BufferAttribute, () => override, profiles.first,
    profiles.other, profiles.base, colorFromArgb, () => 77, new Vector3(), true) as {
      prototype: ToonOutlineUpdateHost & {
        update(...args: Parameters<typeof updateToonOutline> extends
          [ToonOutlineUpdateHost, ...infer Rest] ? Rest : never): void;
      };
    };
  return { Original, colorFromArgb };
}

function hostFixture(profiles: ToonOutlineUpdateDependencies["defaultProfile"],
  projectionHit: boolean, drawOutline: boolean) {
  const events: unknown[][] = [];
  const range = { start: 0, count: 0 };
  const host = {
    drawOutline, frameProfile: profiles, frameOverride: undefined,
    centerColor: [1, 0, 0, 1], outerColor: [0, 0, 0, 1],
    originalCenterColor: [1, 0, 0, 1], originalOuterColor: [0, 0, 0, 1],
    updateSerial: 0, frameEmitted: false, frameViewportValue: undefined,
    frameSortZ: 0, frameWorldX: 0, frameWorldY: 0, frameWorldZ: 0,
    cachedBody: undefined, cachedProjection: new Float32Array(16),
    cachedPosition: undefined, cachedPositionVersion: -1, bodyIndex: undefined,
    cachedIndexVersion: -1, cachedWidth: 0, cachedHeight: 0,
    cachedProfile: undefined, cachedEnabled: false, cachedEmitted: true,
    cachedViewport: { width: 320, height: 200 },
    material: { uniforms: { viewportPx: { value: { set(width: number, height: number) {
      events.push(["viewport", width, height]);
    } } } } },
    geometry: { setDrawRange(start: number, count: number) {
      range.start = start; range.count = count; events.push(["range", start, count]);
    } },
    projectVertices(_matrix: Matrix4, _camera: PerspectiveCamera,
      _width: number, _height: number, _cache: unknown, rigid: boolean) {
      events.push(["project", rigid]); return projectionHit;
    },
    classifyFaces() { events.push(["classify"]); },
    updateBodyGeometry() { events.push(["body"]); },
    resetFrameWorkspace() { events.push(["reset"]); },
    buildLinks() { events.push(["links"]); },
    emitOpenSections() { events.push(["open"]); },
    emitClosedSections() { events.push(["closed"]); },
    emitConflicts() { events.push(["conflicts"]); },
    expandStrip() { events.push(["strip"]); },
    publishGeometry() { events.push(["publish"]); },
    rememberRigidFrame() { events.push(["remember"]); },
  };
  return { host, events, range };
}

function snapshot(host: ToonOutlineUpdateHost, events: unknown[][],
  range: { start: number; count: number }) {
  return {
    frameProfile: host.frameProfile, frameOverride: host.frameOverride,
    centerColor: host.centerColor, outerColor: host.outerColor,
    serial: host.updateSerial, emitted: host.frameEmitted,
    viewport: host.frameViewportValue, depth: host.frameSortZ,
    world: [host.frameWorldX, host.frameWorldY, host.frameWorldZ],
    cachedBody: host.cachedBody, events, range,
  };
}

test("Toon 描边更新阶段、颜色覆写、轮廓开关和刚性缓存与发行版一致", async () => {
  const profiles = {
    base: [{ x: 0, y: 0, valid: true }],
    first: [{ x: 1, y: 1, valid: true }],
    other: [{ x: 2, y: 2, valid: true }],
  };
  const camera = new PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  camera.position.set(0, 0, 10);
  camera.updateMatrixWorld();
  const body = { matrixWorld: new Matrix4().makeTranslation(2, 3, -4),
    geometry: new BufferGeometry() };
  const position = new BufferAttribute(new Float32Array(9), 3);
  body.geometry.setAttribute("position", position);
  for (const scenario of [
    { override: undefined, hit: false, draw: true, cached: false },
    { override: { selector: 1, centerArgb: 0xaaff8800, outerArgb: 0x804466ee },
      hit: false, draw: true, cached: false },
    { override: { selector: 2, centerArgb: 0x800000ff, outerArgb: 0x44ff00aa },
      hit: false, draw: false, cached: false },
    { override: undefined, hit: true, draw: true, cached: true },
  ] as Array<{ override?: ToonOverride; hit: boolean; draw: boolean; cached: boolean }>) {
    const { Original, colorFromArgb } = await releaseClass(profiles, scenario.override);
    const oldCase = hostFixture(profiles.base, scenario.hit, scenario.draw);
    const newCase = hostFixture(profiles.base, scenario.hit, scenario.draw);
    const old = Object.assign(Object.create(Original.prototype), oldCase.host) as
      ToonOutlineUpdateHost & { update(body: ToonBody, camera: PerspectiveCamera,
        width: number, height: number, progress: (phase: string) => void,
        cache: unknown): void };
    const current = newCase.host as unknown as ToonOutlineUpdateHost;
    if (scenario.cached) {
      for (const host of [old, current]) {
        host.cachedBody = body;
        host.cachedPosition = position;
        host.cachedPositionVersion = position.version;
        host.bodyIndex = body.geometry.getIndex() ?? undefined;
        host.cachedIndexVersion = -1;
        host.cachedWidth = 800;
        host.cachedHeight = 600;
        host.cachedProfile = profiles.base;
        host.cachedEnabled = true;
      }
    }
    const oldProgress = (phase: string) => oldCase.events.push(["phase", phase]);
    const newProgress = (phase: string) => newCase.events.push(["phase", phase]);
    const cache = { generation: 1, width: 800, height: 600 };
    old.update(body, camera, 800, 600, oldProgress, cache);
    const deps: ToonOutlineUpdateDependencies = {
      profileForSelector1: profiles.first, profileForOtherSelector: profiles.other,
      defaultProfile: profiles.base, enabled: true,
      overrideForObject: () => scenario.override, colorFromArgb,
      nextSerial: () => 77,
      projectedDepth: (owner, view) => new Vector3().setFromMatrixPosition(
        owner.matrixWorld).project(view).z,
    };
    updateToonOutline(current, body, camera, 800, 600, newProgress, cache, deps);
    assert.deepEqual(snapshot(current, newCase.events, newCase.range),
      snapshot(old, oldCase.events, oldCase.range));
  }
});
