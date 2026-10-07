import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MultiplayerResultView } from "./multiplayer-result-view";
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
