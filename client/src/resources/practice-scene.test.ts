import { routeGateCrossing } from "../world/gates";
import test from "node:test";
import assert from "node:assert/strict";
import { practiceSceneRoute, preparePracticeScene } from "./practice-scene";
import { resourceTrackMetadata } from "./extra-tracks";
import { buildTrackAdmissionLedger, routeSurfaceRecord, type TrackLedgerOps } from "../vehicle/track-admission-ledger";

const ops = { descriptorUses: () => ({ descriptorUses: [] }), routeSurfaceKind: () => undefined } as unknown as TrackLedgerOps;
const occurrence = { encoding: "new", id: 1, value: { kind: "ToLucci", name: "coin" } };
const model = { root: { kind: "track", scene: {}, trackObjects: [occurrence.value], trackObjectOccurrences: [occurrence] } };
test("独立练习省略任务金币，但普通计时赛和 LTE 保留严格准入", () => {
  const reason = (options: object) => buildTrackAdmissionLedger(model, {}, "time-attack", options, ops).records[0];
  assert.equal(reason({ resourcePractice: true }).decision, "omit");
  assert.equal(reason({}).decision, "block");
  assert.equal(reason({ resourcePractice: true, lteCoins: true }).decision, "block");
});
test("仅省略独立练习脚本，不放过未知路线物理事件", () => {
  const record = (surface: string, options: object) => routeSurfaceRecord(occurrence, 0, 0, surface, "time-attack", {}, 0, options, ops);
  for (const surface of ["event:devil0", "event:driftRight", "cloud70"]) {
    assert.equal(record(surface, { resourcePractice: true }).decision, "omit");
    assert.equal(record(surface, {}).decision, "block");
  }
  assert.equal(record("unknownPhysics", { resourcePractice: true }).decision, "block");
  assert.equal(record("event:devil0", { resourcePractice: true, itemGame: true }).decision, "block");
});
test("自由探索只给指定场景的真实地面添加碰撞，不改变其他场景", () => {
  const node: any = { name: "Plane3391@s1", slots: [{ kind: "texture", name: "grass" }], slotOccurrences: [{}], children: [] };
  const model = { root: { kind: "track", scene: node } };
  preparePracticeScene(model, "pirate_R01");
  assert.equal(node.slots[0].property, undefined);
  preparePracticeScene(model, "pirate_P01");
  assert.equal(node.slots[0].property.children[0].name, "road");
  const route = practiceSceneRoute([{ a: {x:0,y:2,z:0}, b: {x:100,y:2,z:0}, c: {x:0,y:2,z:100},
    normal: {x:0,y:1,z:0}, origin: { mesh: { node } } } as any]);
  assert.equal(route.start.position.y, 2);
  assert.ok(route.sections[0]!.length > 0);
  assert.equal(route.sections[0]!.outgoing[0]!.gate.final, false);
  assert.equal(routeGateCrossing(route.sections[0]!.outgoing[0]!.gate as any,
    { x: 0, y: 2, z: 0 }, { x: 100, y: 2, z: 100 }), 0);
  assert.throws(() => practiceSceneRoute([]), /原始地面/);
  const metadata = resourceTrackMetadata({ id: "pirate_P01", folder: "pirate_P01", variant: "", reverse: false, model: {} as any });
  assert.match(metadata.cnTitle!, /自由探索/);
  assert.equal(metadata.laps, 99999);
});
