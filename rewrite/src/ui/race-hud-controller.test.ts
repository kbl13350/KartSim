import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { RaceHudController, type RaceHudDependencies,
  type RaceHudDefinition, type RaceHudGauge, type RaceHudInput } from
  "./race-hud-controller";
import { personalBoostFrame, teamBoostFrame } from "./race-hud-boost";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as typeof import("@babel/parser");
const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function originalClassSource(): Promise<string> {
  const source = await readFile(releaseFile, "utf8");
  const node = parse(source, { sourceType: "module" }).program.body.find(
    entry => entry.type === "ClassDeclaration" && entry.id?.name === "tI");
  assert.ok(node, "发行版 HUD 类仍应存在");
  return source.slice(node.start!, node.end!);
}

function fixture(source: string, rewritten: boolean) {
  const calls: unknown[] = [];
  const gauge = (kind: string): RaceHudGauge => ({
    state: { full: false },
    requestFull() { this.state.full = true; calls.push([kind, "full"]); },
    reset() { this.state.full = false; calls.push([kind, "reset"]); },
    update(time, ratio) { calls.push([kind, "update", time, ratio]); },
    render(camera, width, height) {
      calls.push([kind, "render", camera, width, height]);
    },
    renderIcon(camera, width, height) {
      calls.push([kind, "icon", camera, width, height]);
    },
    dispose() { calls.push([kind, "dispose"]); },
  });
  class Cache {
    drawOrder(_tree: unknown, _width: number, _height: number,
      options: { visibility(node: unknown): boolean | undefined }) {
      calls.push(["draw-order", options.visibility(definition.boost.full)]);
      return [
        { node: definition.boost.gauge, kind: "panel" },
        { node: definition.boost.marker, kind: "panel" },
        { node: definition.boost.full, kind: "panel" },
      ];
    }
  }
  class Renderer {
    constructor(_textures: unknown) { calls.push(["renderer", "create"]); }
    enableUiSmoothing() { calls.push(["renderer", "smooth"]); }
    update(commands: unknown[], time: number) {
      calls.push(["renderer", "update", commands, time]);
    }
    render(camera: unknown, width: number, height: number) {
      calls.push(["renderer", "render", camera, width, height]);
    }
    dispose() { calls.push(["renderer", "dispose"]); }
  }
  class Shadow {
    constructor(texture: unknown) { calls.push(["shadow", "create", texture]); }
    render(camera: unknown, width: number, height: number) {
      calls.push(["shadow", "render", camera, width, height]);
    }
    dispose() { calls.push(["shadow", "dispose"]); }
  }
  class Rank {
    update(rows: unknown[], time: number,
      height: (row: { local: boolean }) => number) {
      calls.push(["rank", "update", time,
        rows.map(row => height(row as { local: boolean }))]);
      return rows;
    }
    reset() { calls.push(["rank", "reset"]); }
  }
  const definition: RaceHudDefinition = {
    shadow: { texture: "shadow-texture" },
    teamBoostVisible: true, boostVisible: true,
    items: "items", time: "time", teamBoost: "team-boost",
    rank: { rows: { local: { height: 21 }, other: { height: 18 } } },
    boost: { tree: "boost-tree", textures: "textures", gauge: "gauge",
      marker: "marker", full: "full" },
  };
  const minimap = {
    setLocalMarkerTint(tint: unknown) { calls.push(["minimap", "tint", tint]); },
    reset() { calls.push(["minimap", "reset"]); },
    update(time: number, body: unknown, ghosts: unknown) {
      calls.push(["minimap", "update", time, body, ghosts]);
    },
    render(camera: unknown, width: number, height: number) {
      calls.push(["minimap", "render", camera, width, height]);
    },
    dispose() { calls.push(["minimap", "dispose"]); },
  };
  const services: RaceHudDependencies = {
    createShadow: texture => new Shadow(texture),
    createRenderer: () => new Renderer(new Map()),
    createCache: () => new Cache(),
    createRankPresentation: () => new Rank(),
    createGaugePulse: () => ({ mainRatio: 0, instantRatio: 0, deadlineMs: 0 }),
    loadClassicGauge: async (_library, kind) => {
      calls.push(["gauge", "load", kind]); return gauge(kind);
    },
    validateTick: (time, label) => { calls.push(["tick", label]); return time; },
    buildSpeedSlots: (_def, slots, disabled, start, time, progress) => {
      calls.push(["slots", slots, disabled, start, time, progress]);
      return [{ kind: "slot" }];
    },
    buildTimeCommands: (_def, _input, width, height) => {
      calls.push(["time", width, height]); return [{ kind: "time" }];
    },
    buildRankCommands: (_def, rank) => {
      calls.push(["rank", "commands", rank]); return [{ kind: "rank" }];
    },
    buildTeamGaugeCommands: (_def, frame) => {
      calls.push(["team", "commands", frame]); return [{ kind: "team" }];
    },
    materializeDrawOrder: order => order as Array<{ node: unknown; kind: string }>,
    requireDrawNode: (order, node) =>
      (order as Array<{ node: unknown }>).find(command => command.node === node),
    scaleGauge: (command, ratio) =>
      ({ ...(command as object), ratio }),
    alignMarker: (scaled, marker) =>
      ({ ...(marker as object), aligned: (scaled as { ratio: number }).ratio }),
    advanceGaugePulse: (_state, time, ratio) =>
      ({ state: { time, ratio }, alpha: 64 }),
    nativeSine: Math.sin,
    reorderDurationMs: 350,
  };
  const Original = new Function("xJ", "fn", "O5", "UQ", "Jp", "jl",
    "Pw", "XJ", "jJ", "JJ", "YJ", "dt", "Xl", "Os", "nI", "jR",
    "px", `${source}\nreturn tI;`)(
    Shadow, Renderer, Cache, Rank, services.createGaugePulse,
    { load: services.loadClassicGauge }, services.validateTick,
    services.buildSpeedSlots, services.buildTimeCommands,
    services.buildRankCommands, services.buildTeamGaugeCommands,
    services.materializeDrawOrder, services.requireDrawNode,
    services.scaleGauge, services.alignMarker, services.advanceGaugePulse,
    services.reorderDurationMs,
  ) as new (definition: RaceHudDefinition,
    minimap: import("./race-hud-controller").RaceHudMinimap) =>
    RaceHudController;
  Original.prototype.boostFrame = function(time: number, ratio: number) {
    return personalBoostFrame(this, time, ratio, Math.sin);
  };
  Original.prototype.teamBoostFrame = function(time: number, ratio: number) {
    return teamBoostFrame(this, time, ratio, Math.sin);
  };
  const hud = rewritten ? new RaceHudController(definition, minimap, services)
    : new Original(definition, minimap);
  return { calls, hud };
}

function state(hud: RaceHudController) {
  return {
    classicTeamVisible: hud.classicTeamVisible, disposed: hud.disposed,
    timeInfoVisible: hud.timeInfoVisible, fullActive: hud.fullActive,
    fullAnchorMs: hud.fullAnchorMs, teamFullActive: hud.teamFullActive,
    teamFullAnchorMs: hud.teamFullAnchorMs,
    slotReorderActive: hud.slotReorderActive,
    slotReorderAnchorMs: hud.slotReorderAnchorMs,
    hasCommands: hud.hasCommands, gaugePulse: hud.gaugePulse,
    classicBoostFull: hud.classicBoost?.state.full,
    classicTeamFull: hud.classicTeamBoost?.state.full,
  };
}

test("比赛 HUD 的命令、满槽、经典仪表、渲染与释放和发行版一致", async () => {
  const source = await originalClassSource();
  const original = fixture(source, false);
  const recovered = fixture(source, true);
  const input: RaceHudInput = {
    boostRatio: 0.62, teamBoostRatio: 0.35, teamBooster: true,
    body: "body", ghosts: ["ghost"], rank: {
      rows: [{ local: true }, { local: false }], place: 2,
    }, speedSlots: [1, 2], speedSlotDisabled: false,
    speedSlotWindowStartMs: 90,
  };
  const run = async ({ hud, calls }: ReturnType<typeof fixture>) => {
    hud.enableUiSmoothing();
    hud.startSlotReorder();
    hud.startBoostGaugeFull();
    hud.startTeamBoostGaugeFull();
    hud.setLocalMarkerTint("blue");
    hud.update(input, 100, 1600, 900);
    hud.render("camera", 1600, 900);
    hud.slotReorderProgress(450);
    hud.setTimeInfoVisible(false);
    hud.update(input, 500, 1600, 900);
    await hud.loadClassicBoost("library", true);
    hud.update(input, 600, 1600, 900);
    hud.startBoostGaugeFull();
    hud.render("camera", 1600, 900);
    hud.reset();
    hud.dispose();
    hud.dispose();
    return { calls, state: state(hud) };
  };
  assert.deepEqual(await run(recovered), await run(original));
});

test("比赛 HUD 装配失效时释放已加载的经典仪表", async () => {
  const source = await originalClassSource();
  const first = fixture(source, false);
  const second = fixture(source, true);
  for (const fixture of [first, second]) {
    const loading = fixture.hud.loadClassicBoost("library", true);
    fixture.hud.dispose();
    await assert.rejects(loading, { message: "经典氮气条装配已失效。" });
  }
  assert.deepEqual(second.calls, first.calls);
});
