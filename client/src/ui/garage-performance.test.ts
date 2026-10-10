import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  renderGarageScoreRows, updateGaragePerformance,
  type GaragePerformanceDependencies, type GaragePerformanceHost,
  type GarageScoreRow,
} from "./garage-performance";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const classNode = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(classNode);
const classSource = release.slice(classNode.start!, classNode.end!);

class ElementStub {
  readonly tag: string;
  title = "";
  hidden = false;
  className = "";
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  children: ElementStub[] = [];
  style = {
    properties: new Map<string, string>(),
    backgroundImage: "",
    setProperty: (name: string, value: string) => {
      this.style.properties.set(name, value);
    },
  };
  private ownText = "";
  private classes = new Set<string>();
  classList = { toggle: (name: string, enabled: boolean) => {
    if (enabled) this.classes.add(name);
    else this.classes.delete(name);
  } };

  constructor(tag: string) { this.tag = tag; }
  get textContent(): string { return this.ownText + this.children.map(child => child.textContent).join(""); }
  set textContent(value: string) { this.ownText = value; this.children = []; }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  replaceChildren(...children: ElementStub[]): void { this.ownText = ""; this.children = children; }
  append(...children: ElementStub[]): void { this.children.push(...children); }
  snapshot(): unknown {
    return {
      tag: this.tag, title: this.title, hidden: this.hidden,
      className: this.className, classes: [...this.classes], text: this.textContent,
      dataset: { ...this.dataset }, attributes: [...this.attributes],
      style: { properties: [...this.style.properties], backgroundImage: this.style.backgroundImage },
      children: this.children.map(child => child.snapshot()),
    };
  }
}

const metrics = [
  ["加速度", "TransAccelFactor", "transAccelFactor"],
  ["弯道", "SteerConstraint", "cornerDrawFactor"],
  ["漂移", "DriftEscapeForce", "driftEscapeForce"],
  ["加速时间", "NormalBoosterTime", "normalBoosterTime"],
  ["集气速度", "DriftMaxGauge", "boosterGauge"],
] as const;

const baseScores = {
  TransAccelFactor: 100, SteerConstraint: 70, DriftEscapeForce: 50,
  NormalBoosterTime: 20, DriftMaxGauge: 90,
};

type TestHost = GaragePerformanceHost & {
  updatePerformance(): void;
  renderScoreRows(rows: GarageScoreRow[] | undefined, title: string): void;
};

function fixture(released: boolean, grade = 8) {
  const events: unknown[] = [];
  const pending: Array<{ resolve(value: unknown): void; reject(reason: unknown): void }> = [];
  const documentStub = { createElement: (tag: string) => new ElementStub(tag) };
  const dependencies: GaragePerformanceDependencies = {
    currentConfiguration: (_garage, itemId, serial) => {
      events.push(["configuration", itemId, serial]);
      return { equipment: "current" };
    },
    applyConfiguration: (_vehicle, engineGrade, configuration, speed) => {
      events.push(["physical", engineGrade, configuration, speed]);
      return {
        transAccelFactor: 1.12345, steerConstraint: 2.123, driftEscapeForce: 3,
        normalBoosterTime: 4, driftMaxGauge: 5,
      };
    },
    applySpeedVersion: (parameters, speedVersion, speed) => {
      events.push(["speedVersion", speedVersion, speed]);
      return parameters;
    },
    previewPartConfiguration: (_vehicle, engineGrade, configuration, part, speed) => {
      events.push(["previewPhysical", engineGrade, configuration, part, speed]);
      return {
        transAccelFactor: part ? 1.23456 : 1.12345,
        steerConstraint: 2.123, driftEscapeForce: part ? 4 : 3,
        normalBoosterTime: 4, driftMaxGauge: 5,
      };
    },
    vehicleFamily: (_vehicle, engineGrade) => engineGrade === 9 ? "xun" : engineGrade === 8 ? "v1" : "legacy",
    scoreFamily: (_vehicle, engineGrade) => engineGrade === 9 ? "xun" : engineGrade === 8 ? "v1" : undefined,
    loadScoreSource: (library, path, kind) => {
      events.push(["load", library, path, kind]);
      return new Promise((resolve, reject) => { pending.push({ resolve, reject }); });
    },
    calculateScores: (source, vehicle, engineGrade, configuration, parts, ignoredSlot) => {
      events.push(["scores", source, vehicle, engineGrade, configuration, parts, ignoredSlot]);
      const current = configuration as Record<string, unknown>;
      const offset = ignoredSlot ? -5 : current.engine ? 10 : current.equipment ? 0 : -20;
      return Object.fromEntries(Object.entries(baseScores).map(([field, value]) =>
        [field, value + offset]));
    },
    fallbackScoreGrade: engineGrade => {
      events.push(["fallbackGrade", engineGrade]);
      return engineGrade ?? 0;
    },
    scoreGradeForValue: (grid, engineGrade, field, value) => {
      events.push(["scoreGrade", grid, engineGrade, field, value]);
      return field === "SteerConstraint" ? undefined : 4;
    },
    performanceLayout: engineGrade => ({
      performanceRoot: engineGrade === 9 ? "textPerformList_12" : "textPerformList",
    }),
    textureToken: (node, property) => {
      events.push(["texture", node, property]);
      return `texture:${String(node)}`;
    },
  };
  const original = new Function(
    "K", "te", "Gt", "Xi", "me", "vt", "cs", "Me", "ys", "dn", "ue", "y", "wn", "ls", "document",
    `${classSource}; return As;`,
  )(
    dependencies.currentConfiguration,
    dependencies.applyConfiguration,
    dependencies.applySpeedVersion,
    dependencies.previewPartConfiguration,
    dependencies.vehicleFamily,
    dependencies.scoreFamily,
    dependencies.loadScoreSource,
    dependencies.calculateScores,
    dependencies.fallbackScoreGrade,
    dependencies.scoreGradeForValue,
    dependencies.performanceLayout,
    dependencies.textureToken,
    (before: number, after: number, baseline: number) => {
      const delta = (value: number) => `(${value - baseline >= 0 ? "+" : ""}${value - baseline})`;
      return {
        beforeValue: String(before), beforeDelta: delta(before),
        afterValue: String(after), afterDelta: delta(after),
        trend: after > before ? "increase" : "decrease",
      };
    },
    metrics,
    documentStub,
  ) as { prototype: TestHost };
  const host = Object.create(original.prototype) as TestHost;
  host.selected = { itemId: 101, path: "kart/alpha", engineGrade: grade };
  host.configuration = { garage: true };
  host.options = { speed: 7, library: "library" };
  Object.defineProperty(host, "speedVersion", { value: "modern", configurable: true });
  host.previewPart = { slot: "engine" };
  host.assets = {
    parts: "parts",
    nodes: new Map(metrics.slice(0, 4).map(([, , node]) =>
      [`/${grade === 9 ? "textPerformList_12" : "textPerformList"}/kartParam/${node}_PrewiewBg`, node])),
    imageUrls: new Map([["garage_img_compareBG2_arrow", "asset://arrow"]]),
  };
  host.scoreSources = new Map();
  host.scoreRevision = 0;
  host.pageMode = "parts";
  host.disposed = false;
  host.defaultPartGrades = { prior: 9 };
  host.info = new ElementStub("info") as unknown as HTMLElement;
  host.comparisons = [];
  host.cancelPreview = { hidden: true };
  host.base = () => { events.push("base"); return { kart: 101 }; };
  host.serial = () => { events.push("serial"); return 77; };
  host.rect = path => {
    events.push(["rect", path]);
    if (path.endsWith("transAccelFactor_PrewiewBg")) return { x: 10, y: 20, width: 130, height: 18 };
    if (path.endsWith("compareArrowBg")) return { x: 100, y: 40, width: 11, height: 9 };
    const index = metrics.findIndex(([, , node]) => path.includes(node));
    return { x: 20 + index * 3, y: 40 + index * 24, width: path.endsWith("Preview") ? 25 : 30, height: 15 };
  };
  host.place = (_element, rect) => { events.push(["place", rect]); };
  host.updateVehicleInformation = (vehicle, configuration, layout, preview) => {
    events.push(["information", vehicle, configuration, layout, preview]);
  };
  if (!released) {
    host.updatePerformance = () => updateGaragePerformance(host, dependencies);
    host.renderScoreRows = (rows, title) => renderGarageScoreRows(host, rows, title, dependencies);
    globalThis.document = documentStub as unknown as Document;
  }
  const snapshot = () => ({
    events: structuredClone(events), revision: host.scoreRevision,
    scoreSources: [...host.scoreSources.keys()],
    defaultPartGrades: host.defaultPartGrades,
    info: (host.info as unknown as ElementStub).snapshot(),
    comparisons: structuredClone(host.comparisons),
    cancelPreview: host.cancelPreview.hidden,
  });
  return { host, events, pending, snapshot };
}

const flush = async () => { await new Promise<void>(resolve => setImmediate(resolve)); };

test("physical parameter values, preview markers, and accessibility match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released, 6);
    f.host.updatePerformance();
    const first = f.snapshot();
    f.host.previewPart = undefined;
    f.host.coatingPreview = { coating: 1 };
    f.host.updatePerformance();
    return [first, f.snapshot()];
  };
  assert.deepEqual(run(false), run(true));
});

test("native score rows and Xun baseline comparisons match As", () => {
  const rows = metrics.map(([label, , node], index) => ({
    label, node, before: 100 + index, after: index === 3 ? 103 : 110 + index,
    baseline: 95 + index,
  }));
  const run = (released: boolean, grade: number) => {
    const f = fixture(released, grade);
    f.host.renderScoreRows(undefined, "正在读取原版评分数据。");
    const loading = f.snapshot();
    f.host.renderScoreRows(rows, "原版评分");
    const scored = f.snapshot();
    f.host.renderScoreRows(rows.map(row => ({ ...row, baseline: undefined })), "无基准值");
    return [loading, scored, f.snapshot()];
  };
  for (const grade of [8, 9]) assert.deepEqual(run(false, grade), run(true, grade));
});

test("score source cache, default grades, metadata update, and Xun preview match As", async () => {
  const run = async (released: boolean, grade: number) => {
    const f = fixture(released, grade);
    f.host.updatePerformance();
    const loading = f.snapshot();
    assert.equal(f.pending.length, 1);
    f.pending[0]!.resolve({ grid: { grade } });
    await flush();
    const loaded = f.snapshot();
    f.host.updatePerformance();
    await flush();
    const cached = f.snapshot();
    f.host.pageMode = "factory";
    f.host.updatePerformance();
    await flush();
    return [loading, loaded, cached, f.snapshot()];
  };
  for (const grade of [8, 9]) assert.deepEqual(await run(false, grade), await run(true, grade));
});

test("stale score results, errors, cache eviction, and disposal match As", async () => {
  const run = async (released: boolean) => {
    const f = fixture(released, 8);
    f.host.updatePerformance();
    f.host.pageMode = "factory";
    f.pending[0]!.resolve({ grid: {} });
    await flush();
    const stalePage = f.snapshot();
    f.host.pageMode = "parts";
    f.host.selected = { ...f.host.selected, path: "kart/beta" };
    f.host.updatePerformance();
    f.pending[1]!.reject(new Error("score missing"));
    await flush();
    const failed = f.snapshot();
    f.host.updatePerformance();
    assert.equal(f.pending.length, 3, "failed score sources are evicted");
    f.host.disposed = true;
    f.pending[2]!.resolve({ grid: {} });
    await flush();
    return [stalePage, failed, f.snapshot()];
  };
  assert.deepEqual(await run(false), await run(true));
});

test("generated GarageXView delegates performance and score rendering", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-performance\.ts"/);
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const methods = new Map(view.body.body.flatMap(node =>
    node.type === "ClassMethod" && node.key.type === "Identifier"
      ? [[node.key.name, generated.slice(node.start!, node.end!)] as const] : []));
  assert.match(methods.get("updatePerformance") ?? "",
    /updateGaragePerformance\(this, garagePerformanceDependencies\)/);
  assert.match(methods.get("renderScoreRows") ?? "",
    /renderGarageScoreRows\(this, rows, title, garagePerformanceDependencies\)/);
});
