import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ITEM_RESULT_TITLES, ITEM_RESULT_TITLE_TICK_MS, MultiplayerResultView } from "./multiplayer-result-view";
import type { ResultNode, ResultViewDependencies } from "./multiplayer-result-view";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Tw {");
const end = release.indexOf("const dQ =", start);
assert.ok(start > 0 && end > start);

function node(name: string, attributes: Record<string, string> = {}, children: ResultNode[] = []): ResultNode {
  return { name, text: "", attributes: [
    { name: "name", value: name },
    ...Object.entries(attributes).map(([key, value]) => ({ name: key, value })),
  ], children };
}

function attribute(value: ResultNode, key: string): string | undefined {
  return value.attributes.find(entry => entry.name === key)?.value;
}

function cloneNode(value: ResultNode, overrides: Record<string, string>,
  children = value.children): ResultNode {
  return { ...value, attributes: [
    ...value.attributes.filter(entry => !(entry.name in overrides)),
    ...Object.entries(overrides).map(([name, data]) => ({ name, value: data })),
  ], children };
}

function assets(): Map<string, ResultNode> {
  const row = node("rowTemplate", { windowRect: "0 0 664 44" }, [
    node("bg"), node("team"), node("colorBg", {}, [node("color")]),
    node("id"), node("rank"), node("time"), node("tp"),
  ]);
  const list = node("resultList", { leftTopWH: "0 0 700 400", listMargin: "10 20" });
  const stage = node("stage", {}, [node("resultCon")]);
  const scores = node("scorePage", { windowSize: "600 fullheight" }, [
    node("background"), node("scoreBox", {}, [
      node("score", { leftTopWH: "0 0 160 58" }, [node("board"), node("TpBoard")]),
    ]),
  ]);
  return new Map([
    ["default_page1_line@zz", row], ["speedTeam_page1_line@zz", row],
    ["default_page1@zz", list], ["speedTeam_page1@zz", list],
    ["stage_window@zz", stage], ["speedTeam_RightPage1@zz", scores],
    ["team_RightPage2@cn", node("teamFinal", {}, [
      node("resultWinteam", { windowSize: "100 40" }),
    ])],
  ]);
}

function harness() {
  const bml = assets();
  const events: string[] = [];
  let options: Parameters<ResultViewDependencies["loadView"]>[0] | undefined;
  const view = {
    show: () => { events.push("show"); },
    hide: () => { events.push("hide"); },
    render: () => { events.push("render"); },
    dispose: () => { events.push("dispose"); },
  };
  class PageClock {
    constructor(readonly anchor: number) {}
    update(time: number) { return { offset: (time - this.anchor) / 1000,
      complete: time - this.anchor >= 2000 }; }
  }
  const loadBml = async (_library: unknown, _folder: string, name: string) => {
    const value = bml.get(name);
    assert.ok(value, `Missing test asset ${name}`);
    return value;
  };
  const teams = [{ alias: "red", dyeId: 1 }, { alias: "blue", dyeId: 2 }];
  const loadView: ResultViewDependencies["loadView"] = async value => {
    options = value;
    return view;
  };
  const deps: ResultViewDependencies = {
    loadBml, attribute, cloneNode, loadTeams: async () => teams,
    loadDye: async () => 0xabcdef12,
    loadView, smoothImages: () => true, stageHeight: 900,
    formatTime: milliseconds => ({ min: "00", sec: String(milliseconds / 1000), mil: "00" }),
    newPageClock: time => new PageClock(time),
  };
  const Original = new Function("F9", "fa", "Pj", "T", "h2", "te", "Co", "Eo", "Vj", "$2",
    `${release.slice(start, end)}\nreturn Tw;`)(
    loadBml, deps.loadTeams, deps.loadDye, attribute, cloneNode,
    { load: loadView }, deps.smoothImages, deps.formatTime, PageClock, 900,
  ) as typeof MultiplayerResultView;
  return { Original, deps, events, get options() { return options; } };
}

for (const teamMode of [false, true]) {
  test(`multiplayer result page matches release in ${teamMode ? "team" : "solo"} mode`, async () => {
    const race = { roster: [
      { playerId: "local", team: teamMode ? 1 : null, name: "Alice" },
      { playerId: "peer", team: teamMode ? 2 : null, name: "Bob" },
    ] };
    const original = harness();
    const readable = harness();
    const [expected, actual] = await Promise.all([
      original.Original.load({}, {}, race, "local", teamMode, original.deps),
      MultiplayerResultView.load({}, {}, race, "local", teamMode, readable.deps),
    ]);
    assert.deepEqual(readable.options?.definition, original.options?.definition);
    assert.deepEqual(readable.options?.roots, original.options?.roots);
    assert.equal(actual.pageWidth, expected.pageWidth);

    const results = [
      { playerId: "local", points: 12, rank: 1, elapsedMs: 1234 },
      { playerId: "peer", points: 8, rank: 2, elapsedMs: null },
    ];
    actual.show(results, 1000, { teamScores: { 1: 12, 2: 8 }, winningTeam: 1 });
    expected.show(results, 1000, { teamScores: { 1: 12, 2: 8 }, winningTeam: 1 });
    const names = ["resultList", "teamRight", "teamWin1", "teamWin2", "score1/board",
      "row0/bg", "row0/team1", "row0/id", "row0/rank", "row0/time", "row0/tp",
      "row1/id", "row1/rank", "row1/time", "row1/colorBg", "riderRankCon"];
    for (const name of names) {
      const target = node(name);
      assert.deepEqual(readable.options!.state(target), original.options!.state(target), name);
    }
    for (const time of [1200, 3000]) {
      assert.equal(actual.update(time), expected.update(time));
      assert.equal(actual.pageOffset, expected.pageOffset);
    }
    actual.dispose();
    expected.dispose();
    assert.deepEqual(readable.events, original.events);
  });
}

test("account rewards from race.rewards show beside each finisher", async () => {
  for (const teamMode of [false, true]) {
    const readable = harness();
    const race = { roster: [
      { playerId: "local", team: teamMode ? 1 : null, name: "Alice" },
      { playerId: "peer", team: teamMode ? 2 : null, name: "Bob" },
    ] };
    const view = await MultiplayerResultView.load({}, {}, race, "local", teamMode,
      { ...readable.deps, showRewards: true });
    const rows = readable.options!.definition.children[1]!.children;
    const reward = rows[0]!.children.find(child => attribute(child, "name") === "row0/reward");
    assert.ok(reward, "row 0 has a reward label");
    assert.equal(attribute(reward!, "leftTopWH"), "300 15 196 30");
    assert.equal(attribute(reward!, "textAlign"), "right,vcenter");
    view.show([
      { playerId: "local", points: 10, rank: 1, elapsedMs: 81_000 },
      { playerId: "peer", points: 0, rank: 2, elapsedMs: null },
    ], 1000, { rewards: { local: { exp: 121, lucci: 180 }, peer: { exp: "x", lucci: 1 } } });
    assert.deepEqual(readable.options!.state(node("row0/reward")),
      { visible: true, text: "+121经验 +180金币" });
    assert.deepEqual(readable.options!.state(node("row1/reward")), { visible: false });
    view.dispose();
  }
});

test("组队道具赛 results keep the team rows and win icon without TP", async () => {
  const race = { roster: [
    { playerId: "local", team: 2, name: "Alice" },
    { playerId: "peer", team: 1, name: "Bob" },
  ] };
  const speed = harness();
  const item = harness();
  await MultiplayerResultView.load({}, {}, race, "local", true, speed.deps);
  const view = await MultiplayerResultView.load({}, {}, race, "local", "item-team", item.deps);
  const panels = (options: typeof item.options) => options!.definition.children
    .map(child => attribute(child, "name") ?? child.name);
  // No TP board on the right; the rows and the list are the speed team ones.
  assert.deepEqual(panels(speed.options), ["resultCon", "resultList", "teamRight"]);
  assert.deepEqual(panels(item.options), ["resultCon", "resultList"]);
  assert.deepEqual(item.options!.definition.children[1], speed.options!.definition.children[1]);
  // The first finisher's team (blue) won although red scored more points.
  view.show([
    { playerId: "local", points: 10, rank: 1, elapsedMs: 70_000 },
    { playerId: "peer", points: 8, rank: 2, elapsedMs: 71_000 },
  ], 1000, { teamScores: { 1: 18, 2: 10 }, winningTeam: 2 });
  const state = (name: string) => item.options!.state(node(name));
  assert.deepEqual(state("row0/tp"), { visible: false });
  assert.deepEqual(state("row1/tp"), { visible: false });
  assert.deepEqual(state("teamWin2"), { visible: true });
  assert.deepEqual(state("teamWin1"), { visible: false });
  assert.deepEqual(state("row0/team2"), { visible: true });
  assert.deepEqual(state("row0/rank"), { text: "1" });
  view.dispose();
});

test("item race results show the titles: icons right aligned, the name cycling every 1600 ms", async () => {
  (globalThis as { document?: unknown }).document ??= {
    createElement: () => ({ relList: { supports: () => true } }),
  };
  const formats = await import("../generated/formats.js") as unknown as {
    s2(bytes: Uint8Array): ResultNode; T(node: ResultNode, name: string): string | undefined };
  const { openMirrorLibrary } = await import("./item-hud-test-support");
  // The real namemap@zz (stage_mqGameFinal.rho title_icons) and the real row template's titleCont.
  const mirror = openMirrorLibrary(["stage_mqGameFinal.rho"]);
  const bytes = (path: string) => mirror.exactCanonicalCandidates(path)[0]!.bytes();
  const namemap = formats.s2(await bytes("stage_/mqGameFinal/title_icons/namemap@zz.bml"));
  const readable = harness();
  const row = node("rowTemplate", { windowRect: "0 0 664 44" }, [
    node("bg"), node("id"), node("rank"), node("time"),
    node("titleCont", { leftTopWH: "270 0 210 40" }, [
      node("titleFrame", { windowRect: "0 0 70 30", texture: "titleCont" }, [node("title")]),
      node("viewIcons", { leftTopWH: "0 5 90 40" }),
    ]),
  ]);
  const loadBml: ResultViewDependencies["loadBml"] = async (library, folder, name) =>
    name === "namemap@zz" ? { ...namemap, attributes: namemap.attributes } :
      name === "default_page1_line@zz" ? row : readable.deps.loadBml(library, folder, name);
  const deps = { ...readable.deps, loadBml, attribute: (value: ResultNode, key: string) =>
    value.attributes.find(entry => entry.name === key)?.value ?? formats.T(value, key) };
  const race = { gameplay: "item", channelName: "itemIndiCombine", roster: [
    { playerId: "local", team: null, name: "Alice" },
    { playerId: "peer", team: null, name: "Bob" },
  ] };
  const view = await MultiplayerResultView.load({}, {}, race, "local", false, deps);
  assert.deepEqual(view.titles!.map(title => [title.key, title.korean]), ITEM_RESULT_TITLES.map(title =>
    [title.key, title.korean]), "namemap@zz rows in order");
  const rows = readable.options!.definition.children[1]!.children;
  const icons = rows[0]!.children.find(child => attribute(child, "name") === "row0/titleCont")!.children
    .filter(child => attribute(child, "name")!.startsWith("row0/titleIcon/"));
  // 11 titles have icons (백발백중 has none), each a normal `_1` and a focused `_2`.
  assert.equal(icons.length, 22);
  const turret = icons.find(icon => attribute(icon, "name") === "row0/titleIcon/turret/1")!;
  assert.deepEqual([attribute(turret, "texture"), attribute(turret, "resourceRoot")],
    ["터렛모드_1", "stage_/mqGameFinal/title_icons"]);
  for (const icon of icons)
    assert.equal(mirror.exactCanonicalCandidates(`stage_/mqGameFinal/title_icons/${attribute(icon, "texture")}.png`)
      .length, 1, attribute(icon, "texture"));

  view.show([
    { playerId: "local", points: 10, rank: 1, elapsedMs: 70_000, titles: ["safetyFirst", "turret", "perfectAim"] },
    { playerId: "peer", points: 0, rank: 2, elapsedMs: null },
  ], 1000);
  const state = (name: string) => readable.options!.state(node(name));
  // Namemap order: 백발백중 (no icon), 터렛모드, 안전제일; the icons sit right aligned in viewIcons.
  assert.deepEqual(state("row0/titleCont"), { visible: true });
  assert.deepEqual(state("row0/title"), { visible: true, text: "百发百中" });
  assert.deepEqual(state("row0/titleIcon/turret/1"), { visible: true, offsetX: 48 });
  assert.deepEqual(state("row0/titleIcon/turret/2"), { visible: false });
  assert.deepEqual(state("row0/titleIcon/safetyFirst/1"), { visible: true, offsetX: 69 });
  assert.deepEqual(state("row0/titleIcon/speedWar/1"), { visible: false });
  assert.deepEqual(state("row0/titleFrame"), { visible: true, offsetX: 48 - 72 });
  view.update(1000 + ITEM_RESULT_TITLE_TICK_MS);
  assert.deepEqual(state("row0/title"), { visible: true, text: "炮台模式" });
  assert.deepEqual(state("row0/titleIcon/turret/1"), { visible: false });
  assert.deepEqual(state("row0/titleIcon/turret/2"), { visible: true, offsetX: 48 });
  view.update(1000 + 2 * ITEM_RESULT_TITLE_TICK_MS);
  assert.deepEqual(state("row0/title"), { visible: true, text: "安全第一" });
  // A racer without titles has none.
  assert.deepEqual(state("row1/titleCont"), { visible: false });
  assert.deepEqual(state("row1/titleIcon/turret/1"), { visible: false });
  view.dispose();
});

test("speed races keep the release result row (no title icons)", async () => {
  const readable = harness();
  const race = { gameplay: "speed", roster: [{ playerId: "local", team: null, name: "Alice" }] };
  const view = await MultiplayerResultView.load({}, {}, race, "local", false, readable.deps);
  assert.equal(view.titles, undefined);
  view.show([{ playerId: "local", points: 10, rank: 1, elapsedMs: 70_000, titles: ["turret"] }], 1000);
  assert.deepEqual(readable.options!.state(node("row0/titleCont")), { visible: false });
  view.dispose();
});
