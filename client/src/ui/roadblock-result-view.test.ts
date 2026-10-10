import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { RoadblockResultView } from "./roadblock-result-view";
import type { RoadblockDependencies, RoadblockRace } from "./roadblock-result-view";
import type { ResultNode } from "./multiplayer-result-view";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Bo {");
const end = release.indexOf("const PR =", start);
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

function fixtures() {
  const time = node("timeUi", { windowRect: "0 0 1600 900" }, [
    node("lapText", { windowRect: "0 30 100 60", leftTopTex: "10 20" }, [
      node("runnerHandicap"),
    ]),
    node("lapinfo", { windowRect: "0 10 100 20" }),
  ]);
  const stage = node("stage", {}, [node("gameResult", {}, [
    node("gameResultTitle"), node("finishTime"), node("runnerRetire"),
  ])]);
  return new Map<string, ResultNode>([
    ["scoreUi", node("scoreUi")], ["timeUi", time],
    ["rankBoard", node("rankBoard", {}, [node("roleText")])],
    ["timeInfo@cn", node("timeInfo", {}, [
      node("lapinfo", { windowRect: "0 50 100 70" }),
    ])],
    ["stage_window@zz", stage],
    ["default_page2@zz", node("page", { leftTopWH: "0 0 400 300" }, [
      node("resultList", { listMargin: "10 20 0 0" }), node("runnerHeader"),
    ])],
    ["default_page2_line@cn", node("line", { windowRect: "0 0 300 40" }, [
      node("upperCont", {}, [node("id")]), node("bg"),
    ])],
    ["default_page2_nullLine@cn", node("blank", { windowRect: "0 0 300 10" })],
    ["default_page2_leaveRunner@cn", node("leftRunner", { windowRect: "0 0 300 40" })],
  ]);
}

function harness() {
  const bml = fixtures();
  const events: string[] = [];
  let options: Parameters<RoadblockDependencies["loadView"]>[0] | undefined;
  const view = {
    element: { style: { pointerEvents: "auto" } },
    show: () => { events.push("show"); },
    hide: () => { events.push("hide"); },
    render: () => { events.push("render"); },
    dispose: () => { events.push("dispose"); },
  };
  const loadBml = async (_library: unknown, _folder: string, name: string) => {
    const asset = bml.get(name);
    assert.ok(asset, `Missing ${name}`);
    return asset;
  };
  const rectangle: RoadblockDependencies["rectangle"] = (value) => {
    const [x, y, right, bottom] = attribute(value, "windowRect")!.split(" ").map(Number);
    return { x: x!, y: y!, width: right! - x!, height: bottom! - y! };
  };
  const numberTokens: RoadblockDependencies["numberTokens"] = (value, count) => {
    const numbers = value!.split(" ").map(Number);
    assert.equal(numbers.length, count);
    return numbers;
  };
  const loadView: RoadblockDependencies["loadView"] = async value => {
    options = value;
    return view;
  };
  const deps: RoadblockDependencies = {
    loadBml, attribute, cloneNode, rectangle, numberTokens, loadView,
    projectTexture: () => {},
  };
  const Original = new Function("F9", "T", "V0", "j2", "h2", "te", "fQ",
    `${release.slice(start, end)}\nreturn Bo;`)(
    loadBml, attribute, rectangle, numberTokens, cloneNode,
    { load: loadView }, deps.projectTexture,
  ) as typeof RoadblockResultView;
  return { Original, deps, events, view, get options() { return options; } };
}

const race: RoadblockRace = {
  roadblock: { limitMs: 125000, runnerId: "runner", noRunnerManualReset: true },
  roster: [
    { playerId: "blocker", team: null, slot: 1, name: "Blocker" },
    { playerId: "runner", team: null, slot: 0, name: "Runner" },
  ],
  startAt: 1000,
};

test("roadblock HUD construction and clock state match the release", async () => {
  for (const localPlayerId of ["runner", "blocker"]) {
    const original = harness();
    const readable = harness();
    const expected = await original.Original.loadHud({}, {}, race, localPlayerId, original.deps);
    const actual = await RoadblockResultView.loadHud({}, {}, race, localPlayerId, readable.deps);
    assert.deepEqual(readable.options?.definition, original.options?.definition);
    assert.equal(readable.options?.label, original.options?.label);
    assert.deepEqual(readable.options?.roots, original.options?.roots);
    assert.equal(readable.view.element.style.pointerEvents, original.view.element.style.pointerEvents);
    actual.setRemaining(63542);
    expected.setRemaining(63542);
    actual.setRunnerLaps(5, 3);
    expected.setRunnerLaps(5, 3);
    for (const name of ["min", "sec", "mil", "myLap", "totalLap", "other"])
      assert.deepEqual(readable.options!.state(node(name)), original.options!.state(node(name)));
    actual.hide(); expected.hide();
    actual.dispose(); expected.dispose();
    assert.deepEqual(readable.events, original.events);
  }
});

test("roadblock result roster, outcome state and deadline match the release", async () => {
  const original = harness();
  const readable = harness();
  const expected = await original.Original.loadResult({}, {}, race, original.deps);
  const actual = await RoadblockResultView.loadResult({}, {}, race, readable.deps);
  assert.deepEqual(readable.options?.definition, original.options?.definition);
  assert.deepEqual(actual.resultRoster, expected.resultRoster);
  const settled: RoadblockRace = { ...race,
    roadblockOutcome: { runnerWon: true, reason: "finish", endAt: 4689 },
  };
  actual.show([], 10000, settled);
  expected.show([], 10000, settled);
  for (const name of ["roadblockName0", "roadblockName1", "roadblockRow0",
    "roadblockRunnerLeft", "runnerWin", "runnerLose", "limitTime", "finishTime",
    "runnerRetire", "other"])
    assert.deepEqual(readable.options!.state(node(name)), original.options!.state(node(name)), name);
  for (const time of [10000, 15000, 16000])
    assert.equal(actual.update(time), expected.update(time));
  actual.dispose(); expected.dispose();
  assert.deepEqual(readable.events, original.events);
});
