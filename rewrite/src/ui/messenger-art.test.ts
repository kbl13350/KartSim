import assert from "node:assert/strict";
import test from "node:test";

import { chatRuns, colorRuns, formatString, imageSeries } from "./messenger-art";

test("release format strings fill %s, %d and %02d in order", () => {
  assert.equal(formatString("对话(%d)", 3), "对话(3)");
  assert.equal(formatString("%s (%02d:%02d)", "频道", 7, 5), "频道 (07:05)");
  assert.equal(formatString("好友%s等%d人的对话", "Bob"), "好友Bob等人的对话");
});

test("ColorLabel runs carry their ARGB colour and | breaks lines", () => {
  assert.deepEqual(colorRuns("收到来自[color:255 13 153 225]Bob[/color]的|请求"), [
    { text: "收到来自" },
    { text: "Bob", color: "rgba(13, 153, 225, 1)" },
    { text: "的\n请求" },
  ]);
});

test("autoLoadImage series name their states", () => {
  assert.deepEqual(imageSeries("msg_list_"), ["msg_list_1", "msg_list_2", "msg_list_3", "msg_list_4"]);
  assert.deepEqual(imageSeries("eraser_0"), ["eraser_01", "eraser_02", "eraser_03", "eraser_04"]);
  assert.deepEqual(imageSeries("btn_x_@zz", 2), ["btn_x_1@zz", "btn_x_2@zz"]);
  assert.equal(imageSeries("list_check_0", 5).at(-1), "list_check_05");
});

test("chat text splits into text and emoticon runs", () => {
  const smile = { id: 1, text: "/微笑/", x: 0, y: 0 };
  const cry = { id: 3, text: "/哭泣/", x: 40, y: 0 };
  assert.deepEqual(chatRuns("hi/微笑//哭泣/ a/b/", [smile, cry]), [
    { text: "hi" }, { emoticon: smile }, { emoticon: cry }, { text: " a/b/" },
  ]);
  assert.deepEqual(chatRuns("plain", undefined), [{ text: "plain" }]);
});
