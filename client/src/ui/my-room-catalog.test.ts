import assert from "node:assert/strict";
import test from "node:test";
import type { BinaryXmlNode } from "../codecs/binary-xml";
import { loadMyRoomCatalog, parseMyRoomCatalog } from "./my-room-catalog";

const child = (attributes: Record<string, string>): BinaryXmlNode => ({
  name: "myRoom", text: "", children: [],
  attributes: Object.entries(attributes).map(([name, value]) => ({ name, value })),
});
const list = (...children: BinaryXmlNode[]): BinaryXmlNode => ({
  name: "myRoomList", text: "", attributes: [], children,
});

function bml(root: BinaryXmlNode): Uint8Array {
  const bytes: number[] = [];
  const number = (value: number) => {
    bytes.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
  };
  const string = (value: string) => {
    number(value.length);
    for (const char of value) bytes.push(char.charCodeAt(0) & 255, char.charCodeAt(0) >>> 8);
  };
  const write = (node: BinaryXmlNode) => {
    string(node.name);
    string(node.text);
    number(node.attributes.length);
    for (const item of node.attributes) { string(item.name); string(item.value); }
    number(node.children.length);
    node.children.forEach(write);
  };
  write(root);
  return Uint8Array.from(bytes);
}

test("My Room uses locale titles only for scenes with a backing model", async () => {
  const names = list(child({ id: "16", name: "tomb_M01" }),
    child({ id: "30", name: "nemo_M01" }), child({ id: "63", name: "village_M19" }));
  const locale = list(child({ id: "16", title: "墓地小屋背景", default: "true" }),
    child({ id: "30", title: "像素小屋" }), child({ id: "63", title: "VIP 小屋背景" }));
  const entries = [
    { virtualPath: "myRoom_/common/myRoom.bml", sourceName: "myRoom.rho",
      bytes: async () => bml(names) },
    { virtualPath: "myRoom_/common/myRoomLocale@cn.bml", sourceName: "myRoom.rho",
      bytes: async () => bml(locale) },
    { virtualPath: "myRoom_/tomb_M01/track.1s", sourceName: "myRoom.rho",
      bytes: async () => new Uint8Array() },
    { virtualPath: "myRoom_/nemo_M01/track.1s", sourceName: "myRoom.rho",
      bytes: async () => new Uint8Array() },
  ];
  assert.deepEqual((await loadMyRoomCatalog({ files: entries })).map(item => item.id), [16, 30]);
  assert.equal((await loadMyRoomCatalog({ files: entries }))[0]?.title, "墓地小屋背景");
});

test("My Room rejects duplicate IDs and a missing default scene", () => {
  assert.throws(() => parseMyRoomCatalog(
    list(child({ id: "16", name: "tomb_M01" }), child({ id: "16", name: "ice_M01" })),
    list(child({ id: "16", title: "墓地", default: "true" }))), /重复 ID/);
  assert.throws(() => parseMyRoomCatalog(
    list(child({ id: "2", name: "desert_M01" })),
    list(child({ id: "2", title: "沙漠" }))), /默认中文场景/);
});

test("My Room keeps the original kart display scale and locale BGM metadata", () => {
  const rooms = parseMyRoomCatalog(
    list(child({ id: "16", name: "tomb_M01" }),
      child({ id: "33", name: "village_M14", scaleUpOnKart: "2.0" })),
    list(child({ id: "16", title: "墓地", default: "true" }),
      child({ id: "33", title: "X 引擎小屋", bgm: "room_music", bgmTheme: "xmas" })),
  );
  assert.equal(rooms[1]?.scaleUpOnKart, 2);
  assert.equal(rooms[1]?.bgm, "room_music");
  assert.equal(rooms[1]?.bgmTheme, "xmas");
  assert.throws(() => parseMyRoomCatalog(
    list(child({ id: "16", name: "tomb_M01", scaleUpOnKart: "0" })),
    list(child({ id: "16", title: "墓地", default: "true" }))), /显示比例/);
});
