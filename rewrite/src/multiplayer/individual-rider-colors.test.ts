import assert from "node:assert/strict";
import test from "node:test";

import { decorateIndividualRiders, individualRiderDye,
  individualRiderDyes } from "./individual-rider-colors";

const room = (roomId: string, mode = "individual", gameplay?: string) =>
  ({ roomId, mode, gameplay });

test("every slot of an individual room has its own basic dye", () => {
  for (const roomId of ["room-a", "room-b", "4f6c1a2e-0000-4000-8000-000000000001"]) {
    const dyes = Array.from({ length: 8 }, (_, slot) => individualRiderDye(room(roomId), slot));
    assert.deepEqual([...dyes].sort((a, b) => a! - b!), [...individualRiderDyes]);
  }
});

test("the dyes are shuffled per room and stable within a room", () => {
  const order = (roomId: string) =>
    Array.from({ length: 8 }, (_, slot) => individualRiderDye(room(roomId), slot));
  assert.deepEqual(order("room-a"), order("room-a"));
  const orders = new Set(Array.from({ length: 20 }, (_, index) =>
    order(`room-${index}`).join(",")));
  assert.ok(orders.size > 10, `only ${orders.size} distinct orders`);
});

test("team and roadblock rooms keep their own dyes", () => {
  assert.equal(individualRiderDye(room("r", "team"), 0), undefined);
  assert.equal(individualRiderDye(room("r", "individual", "roadblock"), 0), undefined);
  assert.notEqual(individualRiderDye(room("r", "individual", "grip"), 0), undefined);
  assert.equal(individualRiderDye(room("r"), 8), undefined);
  assert.equal(individualRiderDye(room("r"), -1), undefined);
  assert.equal(individualRiderDye({ mode: "individual" }, 0), undefined);
});

test("lobby previews dress individual members in their slot's dye", () => {
  const equipment = (dye: number) => ({ itemIds: { 1: 2, 70: dye }, kartSerial: 7 });
  const members = [
    { playerId: "a", slot: 0, equipment: equipment(6) },
    { playerId: "b", slot: 3, equipment: equipment(6) },
    { playerId: "c", slot: 5 },
  ];
  const decorated = decorateIndividualRiders({ ...room("r"), members });
  assert.equal(decorated.members[0]!.equipment!.itemIds[70], individualRiderDye(room("r"), 0));
  assert.equal(decorated.members[1]!.equipment!.itemIds[70], individualRiderDye(room("r"), 3));
  assert.equal(decorated.members[0]!.equipment!.itemIds[1], 2);
  assert.equal(decorated.members[0]!.equipment!.kartSerial, 7);
  assert.equal(decorated.members[2], members[2]);
  assert.equal(members[0]!.equipment!.itemIds[70], 6);

  const team = { ...room("r", "team"), members };
  assert.equal(decorateIndividualRiders(team), team);
});
