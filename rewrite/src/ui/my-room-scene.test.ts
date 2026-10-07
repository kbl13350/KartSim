import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { y9 } from "../generated/formats.js";
import { FI } from "../generated/library.js";
import { ag } from "../generated/vehicle.js";
import { BoxGeometry, Group, Mesh, Vector3 } from "three";
import { findMyRoomSceneAssets, myRoomFacingYaw, myRoomSceneAnchors,
  myRoomSceneFrame, myRoomVisibleBounds } from "./my-room-scene";

const defaultRoom = {
  id: 16, resourceName: "tomb_M01", title: "墓地小屋背景", isDefault: true,
};

test("My Room selects both original 3D assets from the same archive folder", () => {
  const file = (virtualPath: string, sourceName = "myRoom.rho") => ({
    virtualPath, sourceName, bytes: async () => new Uint8Array(),
  });
  const library = { files: [
    file("myRoom_/tomb_M01/track.1s"),
    file("myRoom_/tomb_M01/skydome.1s"),
    file("other_/tomb_M01/track.1s", "track_tomb_M01.rho"),
  ] };
  const assets = findMyRoomSceneAssets(library, defaultRoom);
  assert.equal(assets.track.virtualPath, "myRoom_/tomb_M01/track.1s");
  assert.equal(assets.skydome.virtualPath, "myRoom_/tomb_M01/skydome.1s");
  assert.throws(() => findMyRoomSceneAssets({ files: library.files.slice(0, 1) },
    defaultRoom), /skydome\.1s/);
});

test("ordinary character front turns toward all walking directions", () => {
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1]] as Array<[number, number]>) {
    const expected = new Vector3(dx, 0, dz).normalize();
    const facing = new Vector3(0, 0, 1).applyAxisAngle(
      new Vector3(0, 1, 0), myRoomFacingYaw(dx, dz));
    assert.ok(facing.distanceTo(expected) < 0.00001,
      `facing ${facing.toArray()} should match movement ${expected.toArray()}`);
  }
});

test("parked kart grounding ignores hidden effect meshes", () => {
  const kart = new Group();
  kart.position.set(0, 20.88, 0);
  const body = new Mesh(new BoxGeometry(2, 1, 3));
  body.position.y = 0.5;
  // Hidden kart effects sit far below the body and must not lift the floor offset.
  const effect = new Mesh(new BoxGeometry(112, 112, 49));
  effect.visible = false;
  kart.add(body, effect);
  const bounds = myRoomVisibleBounds(kart);
  assert.ok(Math.abs(bounds.min.y - 20.88) < 1e-6);
  assert.ok(Math.abs(bounds.max.y - 21.88) < 1e-6);
});

test("the shipped default 3D room has original rider and kart anchors", async () => {
  const mirror = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../mirror");
  const index = JSON.parse(inflateSync(await readFile(path.join(mirror,
    "__p3553/archive-index"))).toString("utf8")) as {
      rho: Array<{ name: string; files: Array<{ path: string; dataIndex: number }>;
        blocks: Array<{ index: number; offset: number; storedSize: number;
          processingFlags: number }> }>;
    };
  const archive = index.rho.find(item => item.name === "myRoom.rho")!;
  const file = archive.files.find(item => item.path === "tomb_M01/track.1s")!;
  const block = archive.blocks.find(item => item.index === file.dataIndex)!;
  assert.equal(block.processingFlags, 2);
  const source = await readFile(path.join(mirror, "p3553/myRoom.rho"));
  const model = y9(inflateSync(source.subarray(block.offset,
    block.offset + block.storedSize)));
  assert.equal(model.root.kind, "track");
  const objects = model.root.trackObjects as Array<{ kind: string; name: string }>;
  assert.equal(objects.filter(object => /^rider\d\d$/.test(object.name)).length, 8);
  assert.equal(objects.filter(object => /^parking\d\d$/.test(object.name)).length, 10);
  const frame = myRoomSceneFrame(model);
  assert.ok(frame.target.toArray().every(Number.isFinite));
  assert.ok(frame.distance >= 24);
  const anchors = myRoomSceneAnchors(model);
  assert.ok(Math.abs(anchors.rider.x - 85.11465) < 0.001);
  assert.ok(Math.abs(anchors.parking.x - 78.5838) < 0.001);
  assert.ok(Math.abs(anchors.rider.y - anchors.parking.y) < 0.001);
  assert.ok(anchors.minX < anchors.parking.x && anchors.maxX > anchors.rider.x);
  assert.ok(anchors.minZ < anchors.parking.z && anchors.maxZ > anchors.rider.z);
});

test("ordinary Dao standing and common walking motions alternate steps", async () => {
  const mirror = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../mirror");
  const index = JSON.parse(inflateSync(await readFile(path.join(mirror,
    "__p3553/archive-index"))).toString("utf8")) as {
      rho: Array<{ name: string; files: Array<{ path: string; dataIndex: number }>;
        blocks: Array<{ index: number; offset: number; storedSize: number;
          processingFlags: number }> }>;
    };
  const clip = async (archiveName: string, name: string) => {
    const archive = index.rho.find(item => item.name === archiveName)!;
    const file = archive.files.find(item => item.path === name)!;
    const block = archive.blocks.find(item => item.index === file.dataIndex)!;
    assert.equal(block.processingFlags, 2);
    const source = await readFile(path.join(mirror, `p3553/${archiveName}`));
    return FI(inflateSync(source.subarray(block.offset,
      block.offset + block.storedSize)));
  };
  const [idle, walk] = await Promise.all([
    clip("character_dao.rho", "f10.1s"),
    clip("character_common.rho", "f11.1s"),
  ]);
  const faceMap = (clip: typeof idle): number[] =>
    (clip.root.value as { map: number[] }).map;
  assert.deepEqual(faceMap(idle), [0, 8]);
  assert.deepEqual(faceMap(walk), [0]);
  const motion = new ag(idle, { 3: idle, 4: walk, 5: walk, 8: idle, 9: idle,
    10: idle, 11: idle, 14: idle });
  motion.update(0);
  motion.submitMotion(4);
  for (let time = 100; time <= 700; time += 100) motion.update(time);
  const stepA = motion.update(800);
  const leftA = stepA[16]![0]!;
  const rightA = stepA[20]![0]!;
  motion.update(1000);
  const stepB = motion.update(1200);
  const leftB = stepB[16]![0]!;
  const rightB = stepB[20]![0]!;
  assert.ok((leftA - rightA) * (leftB - rightB) < 0,
    "left and right hips should trade lead positions");
  motion.submitMotion(3);
  motion.update(1400);
  const standing = motion.update(1800);
  assert.ok(Math.abs(standing[18]![0]! - standing[22]![0]!) < 0.01);
});
