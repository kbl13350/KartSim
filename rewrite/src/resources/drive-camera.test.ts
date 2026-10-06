import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { CameraHeightFollower, DriveCameraController, type CameraFrame, type CameraMotion,
  type CameraTarget, type DriveCameraMath } from "./drive-camera";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

interface ReleaseCamera {
  update(input: CameraMotion): CameraFrame;
  reset(variant?: number): void;
  configureP3528ResolutionMode(mode?: number): void;
  apply(camera: CameraTarget, frame: CameraFrame): void;
  [name: string]: unknown;
}
function releaseCamera(source: string): {
  Original: new (process?: { followHeight(a: number, b: number, c: number, d: boolean): number }) => ReleaseCamera;
  Process: new () => { followHeight(a: number, b: number, c: number, d: boolean): number };
  math: DriveCameraMath;
} {
  const start = source.indexOf("function we(");
  const end = source.indexOf("\nclass tw {", start);
  assert.ok(start >= 0 && end > start);
  const factory = new Function(`${source.slice(start, end)}
    return { Original: Ol, Process: Cj, math: {
      f32: n0, floatWord: g1, bodyBasis: kB, clientVector: g4,
      column: Qt, setColumn: zl, normalize: Np, cross: Op, scale: Kc, add: Hb,
      alignMotorcycle: Ej, orientation: LB, orientationDot: da,
      scaleOrientation: ew, smoothOrientation: O6, speed: Ul,
      smoothScalar: qc, clampRatio: bs, basisFromOrientation: PB,
      tiltBasis: _j, outputVector: v8, clientDot: Ou, horizontalFov: we,
      resolutionFov: z6, parseRoadNumber: y8, emptyVector: Bj,
      baseFov: DB, activeFov: VB, altActiveFov: NB, boostFov: OB,
      specialFovLimit: bj, p3528SpecialFovLimit: Mj, near: xj, far: Sj,
    } };`);
  return factory() as ReturnType<typeof releaseCamera>;
}

function motion(timestampMs: number, changes: Partial<CameraMotion> = {}): CameraMotion {
  return {
    timestampMs,
    motionMode: 0,
    body: {
      right: { x: 1, y: 0, z: 0 },
      forward: { x: 0, y: 1, z: 0 },
      up: { x: 0, y: 0, z: 1 },
      position: { x: 10, y: 20, z: 30 },
      linearVelocity: { x: 4, y: 0, z: 0 },
    },
    wheelContact: true, motorcycleType: false,
    mrContact: false, hwContact: false,
    averageWheelHitNormal: { x: 0, y: 0, z: 1 },
    effectiveReverseScalar: 0, stateCode: 0, action8: false,
    eventScaleSecondary: { x: 1, y: 1, z: 1 }, routeSurface: "road",
    ...changes,
  };
}

function cameraSnapshot(camera: ReleaseCamera | DriveCameraController) {
  return {
    initialized: camera.initialized,
    variant: camera.variant,
    previousTimestamp: camera.previousTimestamp,
    smoothedOrientation: camera.smoothedOrientation,
    smoothedSpeed: camera.smoothedSpeed,
    smoothedPosition: camera.smoothedPosition,
    smoothedFov: camera.smoothedFov,
    specialBack: camera.specialBack,
    specialFov: camera.specialFov,
    specialPitch: camera.specialPitch,
    motorcycleAirAnchor: camera.motorcycleAirAnchor,
    motorcycleContactAnchor: camera.motorcycleContactAnchor,
    baseFov: camera.baseFov,
    activeFov: camera.activeFov,
    altActiveFov: camera.altActiveFov,
    boostFov: camera.boostFov,
    specialFovLimit: camera.specialFovLimit,
  };
}

function fakeTarget() {
  const events: unknown[][] = [];
  const target = {
    position: { set: (...values: number[]) => events.push(["position", ...values]) },
    up: { set: (...values: number[]) => events.push(["up", ...values]) },
    matrixAutoUpdate: true, matrixWorldNeedsUpdate: false,
    matrixWorldInverse: { set: (...values: number[]) => events.push(["inverse", ...values]) },
    matrix: { copy: (matrix: unknown) => {
      events.push(["copy", matrix === target.matrixWorldInverse]);
      return { invert: () => events.push(["invert"]) };
    } },
    aspect: 16 / 9, fov: 0, near: 0, far: 0,
    updateProjectionMatrix: () => events.push(["projection"]),
  } as CameraTarget;
  return { target, events };
}

test("跟车相机平滑、路面特效、摩托车落地和相机矩阵与发行版一致", async () => {
  const { Original, Process, math } = releaseCamera(await readFile(releaseFile, "utf8"));
  for (const useProcess of [false, true]) {
    const oldProcess = useProcess ? new Process() : undefined;
    const newProcess = useProcess ? new CameraHeightFollower(math) : undefined;
    const original = new Original(oldProcess);
    const rewritten = new DriveCameraController(newProcess, math);
    const samples = [
      motion(1000),
      motion(1016, { stateCode: 13, eventScaleSecondary: { x: 1, y: 0.8, z: 1.3 } }),
      motion(1032, { motionMode: 2, stateCode: 3, action8: true }),
      motion(1048, { motorcycleType: true, wheelContact: false }),
      motion(1064, { motorcycleType: true, wheelContact: true }),
      motion(1080, { mrContact: true, routeSurface: "road" }),
      motion(1096, { hwContact: true, effectiveReverseScalar: 1,
        routeSurface: "zoomOut08_040" }),
      motion(1112, { routeSurface: "zoomIn04_020" }),
      motion(1128, { routeSurface: undefined }),
    ];
    for (const [index, input] of samples.entries()) {
      const expected = original.update(input);
      const actual = rewritten.update(input);
      assert.deepEqual(actual, expected, `frame ${index}, process=${useProcess}`);
      assert.deepEqual(cameraSnapshot(rewritten), cameraSnapshot(original),
        `state ${index}, process=${useProcess}`);
      if (oldProcess && newProcess)
        assert.equal(newProcess.heightFollowing,
          (oldProcess as typeof oldProcess & { heightFollowing: boolean }).heightFollowing);
      const targetOriginal = fakeTarget(), targetRewrite = fakeTarget();
      original.apply(targetOriginal.target, expected);
      rewritten.apply(targetRewrite.target, actual);
      assert.deepEqual(targetRewrite.events, targetOriginal.events,
        `camera matrix ${index}, process=${useProcess}`);
      assert.deepEqual({ fov: targetRewrite.target.fov, near: targetRewrite.target.near,
        far: targetRewrite.target.far,
        auto: targetRewrite.target.matrixAutoUpdate },
      { fov: targetOriginal.target.fov, near: targetOriginal.target.near,
        far: targetOriginal.target.far,
        auto: targetOriginal.target.matrixAutoUpdate });
    }
    original.configureP3528ResolutionMode(2);
    rewritten.configureP3528ResolutionMode(2);
    original.reset(1);
    rewritten.reset(1);
    assert.deepEqual(cameraSnapshot(rewritten), cameraSnapshot(original));
    assert.deepEqual(rewritten.update(motion(1200, { routeSurface: "road" })),
      original.update(motion(1200, { routeSurface: "road" })));
  }
});

test("相机高度追随器的锁定和普通插值与发行版一致", async () => {
  const { Process, math } = releaseCamera(await readFile(releaseFile, "utf8"));
  const original = new Process();
  const rewritten = new CameraHeightFollower(math);
  for (const [previous, target, elapsed, contact] of [
    [0, 20, 10, false], [2, 20, 16, true], [4, 20, 250, true],
    [20, 50, 1, true], [20, 50, 50, false],
  ] as Array<[number, number, number, boolean]>) {
    assert.equal(rewritten.followHeight(previous, target, elapsed, contact),
      original.followHeight(previous, target, elapsed, contact));
    assert.equal(rewritten.heightFollowing,
      (original as typeof original & { heightFollowing: boolean }).heightFollowing);
  }
});

test("跟车相机连续转向、速度和 uint32 时间回绕与发行版一致", async () => {
  const { Original, Process, math } = releaseCamera(await readFile(releaseFile, "utf8"));
  const original = new Original(new Process());
  const rewritten = new DriveCameraController(new CameraHeightFollower(math), math);
  for (let index = 0; index < 96; index++) {
    const yaw = index * 0.071;
    const cosine = Math.cos(yaw), sine = Math.sin(yaw);
    const input = motion((0xffffff00 + index * 17) >>> 0, {
      body: {
        right: { x: cosine, y: sine, z: 0 },
        forward: { x: -sine, y: cosine, z: 0 },
        up: { x: 0, y: 0, z: 1 },
        position: { x: index * 0.3, y: -index * 0.2, z: 5 + index * 0.01 },
        linearVelocity: { x: index % 9 - 4, y: index * 0.07, z: 0 },
      },
      motionMode: index % 4,
      wheelContact: index % 7 !== 0,
      motorcycleType: index % 5 === 0,
      mrContact: index % 11 === 0,
      hwContact: index % 13 === 0,
      effectiveReverseScalar: index % 3 === 0 ? 1 : 0,
      stateCode: index % 17,
      action8: index % 9 === 0,
      routeSurface: index % 19 === 0 ? "zoomOut08_040"
        : index % 23 === 0 ? "zoomIn04_020" : "road",
      eventScaleSecondary: { x: 1, y: 0.5 + (index % 5) * 0.1,
        z: 0.7 + (index % 7) * 0.13 },
    });
    assert.deepEqual(rewritten.update(input), original.update(input), `frame ${index}`);
    assert.deepEqual(cameraSnapshot(rewritten), cameraSnapshot(original), `state ${index}`);
  }
});
