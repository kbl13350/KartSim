import assert from "node:assert/strict";
import test from "node:test";
import { formatMyRoomString, myRoomHudColor, myRoomHudTextRender,
  readMyRoomStringBag, type MyRoomHudNode } from "./my-room-hud";

const element = (name: string, attributes: Record<string, string>,
  children: MyRoomHudNode[] = []): MyRoomHudNode => ({
  name, children,
  attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value })),
});

test("release My Room strings use the Chinese entry and fill placeholders", () => {
  const bag = element("stringBag", {}, [
    element("k", { n: "riderList" }, [
      element("m", { c: "kr", v: "%s의 마이룸" }), element("m", { c: "cn", v: "%s的小屋" }),
    ]),
    element("k", { n: "riderCount" }, [element("m", { c: "cn", v: "目前有%d名车手在小屋中" })]),
    element("k", { n: "koreanOnly" }, [element("m", { c: "kr", v: "전용" })]),
  ]);
  const strings = readMyRoomStringBag(bag);
  assert.equal(formatMyRoomString(strings.get("riderList")!, "tester"), "tester的小屋");
  assert.equal(formatMyRoomString(strings.get("riderCount")!, 1), "目前有1名车手在小屋中");
  assert.equal(strings.has("koreanOnly"), false);
});

test("release label colours and text renders map to canvas styles", () => {
  assert.equal(myRoomHudColor("255 255 249 231"), "rgba(255,249,231,1)");
  assert.equal(myRoomHudColor("white"), "white");
  assert.equal(myRoomHudColor(undefined, "black"), "black");
  assert.deepEqual(myRoomHudTextRender("outline14"), { size: 14, stroke: 1 });
  assert.deepEqual(myRoomHudTextRender("bold16"), { size: 16, stroke: 0 });
});
