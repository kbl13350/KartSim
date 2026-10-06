import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { y9 } from "../generated/formats.js";
import { findMyRoomSceneAssets, myRoomSceneFrame } from "./my-room-scene";

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
});
