import assert from "node:assert/strict";
import test from "node:test";

import type { BinaryXmlNode } from "../codecs/binary-xml";
import { themeIconEntries, themeIconImageName, trackThemeId } from "./lobby-theme-icons";

const node = (name: string, attributes: Record<string, string> = {},
  children: BinaryXmlNode[] = []): BinaryXmlNode => ({
  name, text: "", children,
  attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value })),
});

test("选赛道主题页顺序给出主题图标，收藏页不算主题", () => {
  const config = node("config", {}, [node("themeTabOrder", {}, [
    node("tab", { id: "1025", icon: "favorite" }),
    node("tab", { id: "village", icon: "themeIcon_village" }),
    node("tab", { id: "1024", icon: "themeIcon_random_" }),
    node("tab", { id: "ice" }),
  ])]);
  assert.deepEqual(themeIconEntries(config), [
    { id: "village", icon: "themeIcon_village" },
    { id: "1024", icon: "themeIcon_random_" },
    { id: "ice", icon: "ice" },
  ]);
  assert.deepEqual(themeIconEntries(node("config")), []);
  assert.equal(themeIconImageName("themeIcon_village"), "themeIcon_village_1");
  assert.equal(themeIconImageName("themeIcon_random_"), "themeIcon_random_1");
  assert.equal(themeIconImageName("icon@zz"), "icon_1@zz");
});

test("赛道主题优先取赛道目录，未知赛道按最长主题前缀", () => {
  const catalogue = new Map([["village_R01", "village"], ["ice_R02", "ice"]]);
  const themes = ["village", "ice", "forest", "fore"];
  assert.equal(trackThemeId("village_R01", catalogue, themes), "village");
  assert.equal(trackThemeId("ice_R02_rvs", catalogue, themes), "ice");
  assert.equal(trackThemeId("forest_R01", catalogue, themes), "forest");
  assert.equal(trackThemeId("unknown", catalogue, themes), undefined);
});
