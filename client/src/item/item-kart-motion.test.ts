import assert from "node:assert/strict";
import test from "node:test";
import { Matrix4, Quaternion, Vector3 } from "three";
import {
  KartMotion, atRest, drivenPose, fallMs, fallingMotion, kartMotionTrack, motionOffset, rigidMotion,
} from "./item-kart-motion";
import { loadMirrorLibrary, type MirrorLibrary } from "./item-test-fixtures";

let shared: Promise<{ library: MirrorLibrary; formats: any }> | undefined;
function pipeline() {
  return shared ??= (async () => ({
    library: await loadMirrorLibrary(["item.rho"]),
    formats: await import("../generated/formats.js") as any,
  }))();
}

async function track(path: string) {
  const { library, formats } = await pipeline();
  const [file] = library.exactCanonicalCandidates(path);
  assert.ok(file, path);
  return kartMotionTrack(path, formats.y9(await file!.bytes()));
}

const parts = (motion: Matrix4) => {
  const position = new Vector3();
  const rotation = new Quaternion();
  motion.decompose(position, rotation, new Vector3());
  return { position, angle: rotation.angleTo(new Quaternion()) };
};

test("the water fly's bubble lifts the kart into it and holds it there", async () => {
  const fly = (await track("item/waterFly/fired01.1s"))!;
  assert.ok(fly);
  const motion = new KartMotion(fly, 5000);
  assert.ok(parts(motion.at(5000)).position.length() < 0.01, "starts on the road");
  const lifted = parts(motion.at(5992)).position;
  assert.ok(lifted.y > 3.4 && lifted.y < 3.9, `lift ${lifted.y}`);
  assert.ok(Math.hypot(lifted.x, lifted.z) < 0.1, "straight up");
  // The common water bubble climbs to 3.65 m by 2 s.
  const bomb = new KartMotion((await track("item/common/물방울갇힘_일반.1s"))!, 1000);
  assert.ok(Math.abs(parts(bomb.at(3000)).position.y - 3.65) < 0.1);
});

test("the missile explosion throws the kart ~11 m with forward flips and lands it at 1500 ms", async () => {
  const missile = new KartMotion((await track("item/common/미사일폭발.1s"))!, 2000);
  const peak = parts(missile.at(3000));
  assert.ok(peak.position.y > 10.5 && peak.position.y < 11.5, `peak ${peak.position.y}`);
  // Flipping about the kart's right axis (nose over), not rolling.
  const flipped = rigidMotion(missile.at(2333));
  const nose = new Vector3(0, 0, 1).transformDirection(flipped);
  assert.ok(Math.abs(nose.x) < 0.05, "no sideways turn");
  assert.ok(nose.y < -0.5 || nose.z < 0, "the nose went over");
  assert.ok(atRest(missile.at(3500)), "back on the road at the end");
});

test("the banana's 당함 spins the kart in place, many turns, and ends on its heading", async () => {
  const spin = new KartMotion((await track("item/common/당함.1s"))!, 100);
  let turned = 0;
  let previous = 0;
  for (let t = 100; t <= 2100; t += 20) {
    const motion = spin.at(t);
    assert.ok(parts(motion).position.length() < 0.05, "no lift");
    const nose = new Vector3(0, 0, 1).transformDirection(motion);
    const heading = Math.atan2(nose.x, nose.z);
    let delta = heading - previous;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    turned += delta;
    previous = heading;
  }
  assert.ok(Math.abs(turned) > 6 * 2 * Math.PI, `${turned / (2 * Math.PI)} turns`);
  assert.ok(atRest(spin.at(2100)));
});

test("a static firedkart, or a model without one, never moves the kart", async () => {
  assert.equal(await track("item/common/파란방패.1s"), undefined);
  assert.equal(await track("item/waterMine/bubble.1s"), undefined);
});

test("a kart left in the air falls back; driven poses and the camera offset follow the kart frame", () => {
  const up = new Matrix4().makeTranslation(0, 3.65, 0);
  assert.equal(atRest(up), false);
  const total = fallMs(3.65);
  assert.ok(total > 800 && total <= 900);
  const half = parts(fallingMotion(up, total / 2)!).position.y;
  assert.ok(Math.abs(half - 3.65 * 0.75) < 1e-6, "falling, slow first");
  assert.equal(fallingMotion(up, total), undefined);
  // A kart facing +x: its up is world +y, its forward world +x.
  const pose = { position: { x: 10, y: 0, z: 5 }, right: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 },
    forward: { x: 1, y: 0, z: 0 } };
  const lifted = drivenPose(pose, up);
  assert.deepEqual(lifted.position, { x: 10, y: 3.65, z: 5 });
  const ahead = new Matrix4().makeTranslation(0, 0, 2);
  assert.deepEqual(motionOffset(pose, ahead), { x: 2, y: 0, z: 0 });
});
