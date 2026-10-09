import assert from "node:assert/strict";
import test from "node:test";
import { formatMyRoomString, myRoomHudColor, myRoomHudTextRender, myRoomRiderRows,
  readMyRoomStringBag, wrapMyRoomChatLine, type MyRoomHudNode } from "./my-room-hud";
import { balloonLayout } from "./my-room-labels";

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

test("the rider list packs the riders in seat order without gaps", () => {
  const riders = [{ slot: 5, name: "e" }, { slot: 2, name: "b" }, { slot: 0, name: "owner" }];
  assert.deepEqual(myRoomRiderRows(riders).map(rider => rider.name), ["owner", "b", "e"]);
  assert.deepEqual(myRoomRiderRows([{ slot: 3 }, { slot: 1 }]), [{ slot: 1 }, { slot: 3 }]);
});

test("long chat lines wrap to the history box width", () => {
  const measure = (text: string) => text.length * 10;
  assert.deepEqual(wrapMyRoomChatLine("abcdefg", 30, measure), ["abc", "def", "g"]);
  assert.deepEqual(wrapMyRoomChatLine("ab cd", 30, measure), ["ab ", "cd"]);
  assert.deepEqual(wrapMyRoomChatLine("abc def", 30, measure), ["abc", "def"]);
  assert.deepEqual(wrapMyRoomChatLine("", 30, measure), [""]);
  assert.deepEqual(wrapMyRoomChatLine("你好😀", 20, measure), ["你好", "😀"]);
});

test("talk balloons grow one row per wrapped line", () => {
  const one = balloonLayout(1, 1);
  assert.deepEqual(one, { width: 140, height: 61, text: { x: 10, y: 14, width: 120, height: 19 } });
  assert.equal(balloonLayout(3, 1).height - one.height, 38);
  assert.equal(balloonLayout(2, 0.5).width, 70);
});
