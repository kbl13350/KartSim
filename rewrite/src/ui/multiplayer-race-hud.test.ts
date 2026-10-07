import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MultiplayerRaceHud, type MultiplayerHudDependencies } from
  "./multiplayer-race-hud";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Dw {");
const end = release.indexOf("\nconst k00 =", start);
assert.ok(start > 0 && end > start);

function exercise(readable: boolean, anonymous: boolean, competition: boolean) {
  const events: unknown[] = [];
  const normalizeRank = (rank: unknown, namespace?: string) => {
    events.push(["normalize-rank", rank, namespace]);
    return { normalized: rank, namespace };
  };
  class Gap {
    constructor() { events.push(["new-gap"]); }
    update(...args: unknown[]) { events.push(["gap-update", ...args]); return ["gap"]; }
  }
  const ui = {
    update: (state: unknown, time: number, width: number, height: number) =>
      events.push(["ui-update", state, time, width, height]),
    boostGaugeFullActive: () => { events.push(["full-active"]); return true; },
    startTeamBoostGaugeFull: () => events.push(["team-full"]),
    startBoostGaugeFull: () => events.push(["boost-full"]),
    render: (_renderer: unknown, width: number, height: number) =>
      events.push(["ui-render", width, height]),
    dispose: () => events.push(["ui-dispose"]),
  };
  const deps = { createGap: () => new Gap(), normalizeRank,
    racingState: "racing", viewportWidth: 1600, viewportHeight: 900,
  } as unknown as MultiplayerHudDependencies;
  const Original = new Function("DQ", "XM", "X2", "H2", "$2",
    `${release.slice(start, end)}\nreturn Dw;`)(
      Gap, normalizeRank, { Racing: "racing" }, 1600, 900,
    ) as new (...args: unknown[]) => MultiplayerRaceHud;
  const tints = new Map<unknown, number | undefined>([["p1", 0x123456], ["p2", 0xabcdef]]);
  const hud = readable ? new MultiplayerRaceHud(ui, tints, anonymous,
    competition, "p2", deps) : new Original(ui, tints, anonymous, competition, "p2");
  const giant = {
    update: (time: number) => events.push(["giant-update", time]),
    updateBoost: (time: number, full: boolean, ratio: number) =>
      events.push(["giant-boost", time, full, ratio]),
    requestBoostFull: () => events.push(["giant-request"]),
    stage: (cells: number, time: number) => events.push(["giant-stage", cells, time]),
    renderBefore: (_renderer: unknown, width: number, height: number, full: boolean) =>
      events.push(["giant-before", width, height, full]),
    renderBoost: (_renderer: unknown, width: number, height: number) =>
      events.push(["giant-render-boost", width, height]),
    renderAfter: (_renderer: unknown, width: number, height: number, full: boolean) =>
      events.push(["giant-after", width, height, full]),
    renderPanels: (_renderer: unknown, width: number, height: number) =>
      events.push(["giant-panels", width, height]),
    dispose: () => events.push(["giant-dispose"]),
  };
  hud.giant = giant;
  hud.gapView = {
    update: (...args: unknown[]) => events.push(["gap-view", ...args]),
    dispose: () => events.push(["gap-dispose"]),
  };
  const race = {
    elapsedMs: (time: number) => time - 25,
    lifecycle: { state: "racing" },
    physics: { body: { linearVelocity: [1, 2, 3] },
      timeAttackTachometerGauges: () => ({ mainRatio: 0.4,
        teamRatio: 0.7, teamBooster: true }),
      timeAttackSpeedSlots: () => [1, 2],
      timeAttackSpeedSlotDisabled: () => false,
      timeAttackSpeedSlotWindowStartMs: () => 50 },
    track: { data: { lapTarget: 3 },
      getRouteState: () => ({ lap: 2 }) },
    lapTiming: { bestLapMs: 2000 },
  };
  const ghosts = [
    { playerId: "p1", pose: { x: 10 } },
    { playerId: "p2", pose: { x: 20 } },
  ];
  const renderer = {};
  hud.updateTimeGap(race, 750, "before", "after");
  hud.update(race, 750, ghosts, { rank: 2 });
  hud.hideTimeGap();
  hud.startTeamBoostGaugeFull();
  hud.startBoostGaugeFull();
  hud.giantStage(5, 800);
  hud.render(renderer);
  const tintSnapshot = [...hud.markerTints()];
  const timeGapEnabled = hud.timeGapEnabled;
  hud.dispose();
  hud.dispose();
  hud.update(race, 850, ghosts, { rank: 1 });
  hud.render(renderer);
  return { events, tintSnapshot, timeGapEnabled,
    enabledAfterDispose: hud.timeGapEnabled, disposed: hud.disposed };
}

test("multiplayer HUD state, minimap tint, Giant Boost and rendering match release", () => {
  for (const [anonymous, competition] of [[false, false], [true, false],
    [false, true]] as const)
    assert.deepEqual(exercise(true, anonymous, competition),
      exercise(false, anonymous, competition));
});

async function exerciseLoad(readable: boolean, mode: string) {
  const events: unknown[] = [];
  class Gap { update() { return []; } }
  const gapView = { update() {}, dispose() {} };
  const loadTimeGap = async (_library: unknown, target: unknown) => {
    events.push(["load-gap", target]); return gapView;
  };
  const resolveDye = async (_library: unknown, id: number, category: number) => {
    events.push(["dye", id, category]); return { primary: 0xff000000 | id };
  };
  const rank = { rank: { id: "rank" }, suffix: { id: "suffix" },
    riderCount: { id: "count" }, tree: { children: [] as unknown[] } };
  rank.tree.children = [{ node: rank.rank }, { node: rank.suffix },
    { node: rank.riderCount }, { node: { id: "diagonal", attributes: {
      texture: "diagonal" } } }, { node: { id: "keep" } }];
  const loadHudAssets = async (_library: unknown, selection: unknown,
    slot: number, grade: number) => {
    events.push(["hud-assets", selection, slot, grade]); return { rank };
  };
  const attribute = (node: { attributes?: Record<string, string> }, name: string) =>
    node.attributes?.[name];
  const minimap = {
    setLocalRunnerFlag: (flag: boolean) => events.push(["runner-flag", flag]),
    dispose: () => events.push(["minimap-dispose"]),
  };
  const loadMinimap = async (_library: unknown, ...args: unknown[]) => {
    events.push(["minimap", ...args]); return minimap;
  };
  const ui = {
    loadClassicBoost: async (_library: unknown, team: boolean) =>
      events.push(["classic", team]),
    enableUiSmoothing: () => events.push(["smooth"]),
    setTimeInfoVisible: (visible: boolean) => events.push(["time-visible", visible]),
    setLocalMarkerTint: (tint: unknown) => events.push(["local-tint", tint]),
    dispose: () => events.push(["ui-dispose"]),
  };
  const createHud = (assets: { rank: { tree: { children: unknown[] } } },
    map: unknown) => {
    assert.equal(map, minimap);
    events.push(["new-hud", assets.rank.tree.children.length]);
    return ui;
  };
  const giant = { dispose: () => events.push(["giant-dispose"]) };
  const loadGiant = async (_library: unknown) => {
    events.push(["load-giant"]); return giant;
  };
  const deps = { createGap: () => new Gap(), loadTimeGap,
    resolveDye, loadHudAssets, attribute, loadMinimap, createHud,
    loadGiant, normalizeRank: (value: unknown) => value,
    racingState: "racing", viewportWidth: 1600, viewportHeight: 900,
  } as unknown as MultiplayerHudDependencies;
  const Original = new Function("DQ", "Bw", "We", "eI", "T", "oI",
    "tI", "Fw", "XM", "X2", "H2", "$2",
    `${release.slice(start, end)}\nreturn Dw;`)(
      Gap, { load: loadTimeGap }, resolveDye, loadHudAssets, attribute,
      loadMinimap, function Ui() { return createHud(arguments[0], arguments[1]); },
      { load: loadGiant }, (value: unknown) => value,
      { Racing: "racing" }, 1600, 900,
    ) as { load(library: unknown, race: unknown, playerId: unknown): Promise<MultiplayerRaceHud> };
  const local = { playerId: "local", characterDyeId: 8,
    profile: { equipment: { itemIds: { 70: 0 } } },
    vehicle: { tachometerSelection: "meter", kartItem: { engineGrade: 3 },
      classicHud: true } };
  const remote = { playerId: "remote", profile: {
    equipment: { itemIds: { 70: 0 } },
  } };
  const race = { participants: [local, remote],
    drivingMode: { kind: mode }, mode: "team", anonymous: true,
    competition: false, roadblockRunnerId: mode === "roadblock" ? "local" : undefined,
    map: { path: "track", metadata: "meta", minimap: "minimap",
      environment: "environment", stageBinding: "stage" },
  };
  const library = {};
  const hud = readable ? await MultiplayerRaceHud.load(library, race, "local", deps,
    (view, tints, anonymous, competition, runnerId) =>
      new MultiplayerRaceHud(view, tints, anonymous, competition, runnerId, deps))
    : await Original.load(library, race, "local");
  await hud.loadTimeGap(library, "gap-target");
  const snapshot = { events, tints: [...hud.tints], giant: hud.giant === giant,
    runnerId: hud.runnerId, timeGapEnabled: hud.timeGapEnabled };
  hud.dispose();
  return { ...snapshot, events };
}

test("multiplayer HUD asset construction and mode variants match release", async () => {
  for (const mode of ["normal", "roadblock", "giant"])
    assert.deepEqual(await exerciseLoad(true, mode), await exerciseLoad(false, mode));
});
