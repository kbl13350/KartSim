import assert from "node:assert/strict";
import test from "node:test";

import { mirrorArchives, utf16Text } from "../resources/mirror-archives.test-support";

import {
  ITEM_CHANNELS, freezeItemRaceRules, isItemChannel, isItemRace, isItemRaceRules,
  itemChannelForMode, itemChannelMismatch, itemGameType, itemModeLabel, itemRoomLabel,
  itemTrackCardModeKey, sameItemRaceRules, teamGaugeEnabled,
} from "./lobby-item-mode";

globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) } as unknown as Document;
const formats = await import("../generated/formats.js");
const library = await import("../generated/library.js");
const { G2, He, SX, To, W6, cw, j0, rR, x1, xX } = formats as Record<string, any>;
const { MI, Q00, rg, vI } = library as Record<string, any>;

// The original UTF-16LE resources, read from the p3553 archives.
const archives = mirrorArchives();
const channelXml = await archives.read("DataPack4", "zeta_/cn/content/channel.xml");
const stringBag = utf16Text(await archives.read("DataPack1", "etc_/baseStringBag.xml"));

/** The cn value of one baseStringBag key. */
function cnString(key: string): string | undefined {
  const entry = new RegExp(`<k n=['"]${key}['"]>([\\s\\S]*?)</k>`).exec(stringBag)?.[1];
  return entry && /<m c=['"]cn['"] v=['"]([^'"]*)['"]\s*\/>/.exec(entry)?.[1];
}

test("item channels match the original channel.xml rows and the generated table", () => {
  const root = x1(channelXml).root;
  const multiplay = root.children.find((node: { name: string }) => node.name === "Multiplay");
  for (const [name, rule] of Object.entries(ITEM_CHANNELS)) {
    const row = multiplay.children.find((node: { name: string }) =>
      node.name === "Channel" && j0(node, "name") === name);
    assert.ok(row, name);
    // d40 admits a race channel only when gameType and createSpeed match He.
    assert.equal(j0(row, "gameType"), String(rule.gameType), name);
    assert.equal(j0(row, "createSpeed"), String(rule.speed), name);
    assert.equal(j0(row, "rpBonus"), "1.1", name);
    assert.equal(j0(row, "adjustCollision"), "true", name);
    assert.deepEqual(He[name], { mode: rule.mode, speed: rule.speed, gameType: rule.gameType });
    assert.equal(W6(name, rule.mode, rule.speed), true);
    assert.equal(W6(name, rule.mode === "team" ? "individual" : "team", 7), false);
  }
  assert.equal(itemChannelForMode("individual"), "itemIndiCombine");
  assert.equal(itemChannelForMode("team"), "itemTeamCombine");
  assert.equal(isItemChannel("itemTeamCombine"), true);
  assert.equal(isItemChannel("speedTeamCombine"), false);
  assert.equal(isItemChannel("toString"), false);
});

test("item gameplay and item channels only go together", () => {
  assert.equal(itemChannelMismatch("item", "itemIndiCombine"), false);
  assert.equal(itemChannelMismatch("item", "speedIndiCombine"), true);
  assert.equal(itemChannelMismatch(undefined, "itemTeamCombine"), true);
  assert.equal(itemChannelMismatch("ordinary", "speedTeamCombine"), false);
  assert.equal(cw("item"), true);
  assert.equal(xX.item, "道具赛");
  assert.equal(rg("item"), true);
  assert.doesNotThrow(() => MI("item"));
  assert.equal(G2({ gameplay: "item" }), "item");
  for (const channel of ["itemIndiCombine", "itemTeamCombine"]) {
    assert.equal(To("item", channel, "p3553"), true, channel);
    assert.equal(To("item", channel), true, channel);
    assert.equal(To("item", channel, "p3528"), false, channel);
    for (const gameplay of [undefined, "ordinary", "grip", "shadow", "roadblock", "lte", "giant", "rp"]) {
      assert.equal(To(gameplay, channel, "p3553"), false, `${gameplay}/${channel}`);
    }
  }
  for (const channel of ["speedIndiCombine", "speedTeamCombine", "speedIndiInfinit", "speedTeamInfinit"]) {
    assert.equal(To("item", channel, "p3553"), false, channel);
  }
  // The other gameplays keep their release channel rules.
  assert.equal(To(undefined, "speedTeamInfinit", "p3528"), true);
  assert.equal(To("giant", "speedIndiCombine", "p3553"), true);
  assert.equal(To("grip", "speedIndiInfinit", "p3553"), false);
});

test("item rooms carry the original game types 2 and 4 into a frozen driving mode", () => {
  assert.equal(SX({ gameplay: "item", channelName: "itemIndiCombine" }), 2);
  assert.equal(SX({ gameplay: "item", channelName: "itemTeamCombine" }), 4);
  assert.throws(() => SX({ gameplay: "item", channelName: "speedIndiCombine" }), /不匹配/);
  assert.equal(itemGameType(false), 2);
  assert.equal(itemGameType(true), 4);
  for (const modeId of [2, 4]) {
    const mode = vI(modeId);
    assert.equal(Object.isFrozen(mode), true);
    assert.deepEqual([mode.modeId, mode.kind, mode.team], [modeId, "item", modeId === 4]);
    assert.doesNotThrow(() => Q00(mode));
    assert.throws(() => Q00({ ...mode }), /冻结/);
    assert.equal(isItemRace(mode), true);
  }
  assert.equal(isItemRace(vI(3)), false);
  assert.throws(() => vI(6), /尚未准入/);
});

test("item labels are the original string bag values", () => {
  assert.equal(itemModeLabel(false), cnString("itemIndiCombine"));
  assert.equal(itemModeLabel(true), cnString("itemTeamCombine"));
  assert.equal(itemModeLabel(false), cnString("ItemIndi"));
  assert.equal(itemModeLabel(true), cnString("ItemTeam"));
  assert.equal(itemTrackCardModeKey(false), "ItemIndi");
  assert.equal(itemTrackCardModeKey(true), "ItemTeam");
  assert.equal(itemRoomLabel("itemTeamCombine"), "组队道具赛");
  assert.equal(rR({ name: "一起玩", gameplay: "item", channelName: "itemIndiCombine" }),
    "一起玩（个人道具赛）");
  assert.equal(rR({ name: "一起玩", gameplay: "item", channelName: "itemTeamCombine" }),
    "一起玩（组队道具赛）");
  assert.equal(rR({ name: "一起玩", channelName: "speedTeamCombine" }), "一起玩（组队标准）");
});

test("race.item is validated, frozen and compared by ruleset and table", () => {
  const indi = { ruleset: "web-item-v1", table: "indi" };
  const team = { ruleset: "web-item-v1", table: "team" };
  assert.equal(isItemRaceRules(indi), true);
  assert.equal(isItemRaceRules(indi, false), true);
  assert.equal(isItemRaceRules(indi, true), false);
  assert.equal(isItemRaceRules(team, true), true);
  for (const invalid of [undefined, null, [], "web-item-v1", { ruleset: "web-item-v2", table: "indi" },
    { ruleset: "web-item-v1", table: "duo" }, { table: "indi" }]) {
    assert.equal(isItemRaceRules(invalid), false, JSON.stringify(invalid));
  }
  const frozen = freezeItemRaceRules({ ...team, extra: 1 });
  assert.deepEqual(frozen, team);
  assert.equal(Object.isFrozen(frozen), true);
  assert.equal(freezeItemRaceRules(undefined), undefined);
  assert.equal(sameItemRaceRules(undefined, undefined), true);
  assert.equal(sameItemRaceRules(indi, { ...indi }), true);
  assert.equal(sameItemRaceRules(indi, team), false);
  assert.equal(sameItemRaceRules(indi, undefined), false);
  assert.equal(sameItemRaceRules(undefined, frozen), false);
  assert.equal(sameItemRaceRules({ ruleset: "x" }, { ruleset: "x" }), false);
});

test("only standard-speed non-item team races run 组队集气", () => {
  assert.equal(teamGaugeEnabled({ mode: "team", speed: 7, drivingMode: { kind: "ordinary" } }), true);
  assert.equal(teamGaugeEnabled({ mode: "team", speed: 7, drivingMode: { kind: "grip" } }), true);
  assert.equal(teamGaugeEnabled({ mode: "team", speed: 7, drivingMode: vI(4) }), false);
  assert.equal(teamGaugeEnabled({ mode: "team", speed: 4, drivingMode: vI(3) }), false);
  assert.equal(teamGaugeEnabled({ mode: "individual", speed: 7, drivingMode: vI(2) }), false);
});
