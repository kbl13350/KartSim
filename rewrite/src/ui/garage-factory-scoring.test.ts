import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  canonicalGarageFactoryVehicle, garageFactoryVehicleKey, garageKartSerialFor,
  updateGarageFactoryScores,
  type FactoryVehicle, type GarageFactoryScoringDependencies,
  type GarageFactoryScoringHost,
} from "./garage-factory-scoring";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const classNode = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(classNode);
const classSource = release.slice(classNode.start!, classNode.end!);

type TestHost = GarageFactoryScoringHost & {
  updateFactoryScores(): void;
  canonicalFactoryVehicle(vehicle: FactoryVehicle): FactoryVehicle;
};
const first: FactoryVehicle = { kind: "kart", itemId: 101, path: "Kart\\Alpha", engineGrade: 9 };
const canonical: FactoryVehicle = { kind: "kart", itemId: 101, path: "kart/alpha", engineGrade: 9 };
const second: FactoryVehicle = { kind: "kart", itemId: 102, path: "kart/beta", engineGrade: 8 };

function fixture(released: boolean) {
  const events: unknown[] = [];
  const pending: Array<{ resolve(value: unknown): void; reject(reason: unknown): void }> = [];
  let throwBase = false;
  const dependencies: GarageFactoryScoringDependencies = {
    currentConfiguration: (_configuration, id, serial) => {
      events.push(["config", id, serial]);
      return { equipped: id, serial };
    },
    scoreFamily: (_vehicle, grade) => grade === 9 ? "xun" : grade === 8 ? "v1" : undefined,
    loadScoreSource: (library, path, kind) => {
      events.push(["load", library, path, kind]);
      return new Promise((resolve, reject) => { pending.push({ resolve, reject }); });
    },
    calculateScores: (source, vehicle, grade, configuration, parts) => {
      events.push(["calculate", source, vehicle, grade, configuration, parts]);
      return { source, grade, configuration };
    },
  };
  const Original = new Function("K", "vt", "cs", "Me",
    `${classSource}; return As;`)(
      dependencies.currentConfiguration, dependencies.scoreFamily,
      dependencies.loadScoreSource, dependencies.calculateScores,
    ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  host.selected = first;
  host.options = {
    catalog: { karts: [canonical, second] },
    profile: { equipment: { itemIds: { 3: 101 }, kartSerial: 77 } },
    library: "library",
  };
  host.assets = { parts: "parts" };
  host.configuration = { garage: true };
  host.scoreSources = new Map();
  host.factoryScoreRevision = 0;
  host.factoryPanel = { updateScores: (scores, error) => {
    events.push(["scores", scores, error]);
  } };
  host.pageMode = "factory";
  host.disposed = false;
  host.nativeFactoryAllowed = vehicle => vehicle.itemId !== 0;
  host.base = () => {
    events.push("base");
    if (throwBase) throw new Error("vehicle unavailable");
    return { id: host.selected.itemId };
  };
  host.serial = () => { events.push("serial"); return 77; };
  if (!released) {
    host.serialFor = vehicle => garageKartSerialFor(host, vehicle);
    host.factoryVehicleKey = vehicle => garageFactoryVehicleKey(host, vehicle);
    host.canonicalFactoryVehicle = vehicle => canonicalGarageFactoryVehicle(host, vehicle);
    host.updateFactoryScores = () => updateGarageFactoryScores(host, dependencies);
  }
  const snapshot = () => ({
    events: structuredClone(events),
    revision: host.factoryScoreRevision,
    selected: host.selected.itemId,
    sourceKeys: [...host.scoreSources.keys()],
  });
  return { host, events, pending, snapshot, setThrowBase: (value: boolean) => { throwBase = value; } };
}

const flush = async () => { await new Promise<void>(resolve => setImmediate(resolve)); };

test("factory identity, path normalization and owned serial match As", () => {
  const run = (released: boolean) => {
    const { host } = fixture(released);
    return {
      firstKey: host.factoryVehicleKey(first),
      secondKey: host.factoryVehicleKey(second),
      canonicalIsCatalogObject: host.canonicalFactoryVehicle(first) === canonical,
      missingReturnsSame: host.canonicalFactoryVehicle({ ...first, path: "missing" }).path,
      currentSerial: host.serialFor(first), otherSerial: host.serialFor(second),
    };
  };
  assert.deepEqual(run(false), run(true));
});

test("unsupported, missing source, and base failure display the same Factory error", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.factoryPanel = undefined;
    f.host.updateFactoryScores();
    states.push(f.snapshot());
    f.host.factoryPanel = { updateScores: (scores, error) => {
      f.events.push(["scores", scores, error]);
    } };
    f.host.selected = { ...first, itemId: 0 };
    f.host.updateFactoryScores();
    states.push(f.snapshot());
    f.host.selected = first;
    f.setThrowBase(true);
    f.host.updateFactoryScores();
    states.push(f.snapshot());
    f.setThrowBase(false);
    f.host.selected = { ...first, engineGrade: 6 };
    f.host.updateFactoryScores();
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("score source caching, stale page guard, failure eviction and disposal match As", async () => {
  const run = async (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.updateFactoryScores();
    states.push(f.snapshot());
    assert.equal(f.pending.length, 1);
    f.pending[0]!.resolve({ marker: "alpha" });
    await flush();
    states.push(f.snapshot());
    f.host.updateFactoryScores();
    await flush();
    states.push(f.snapshot());
    assert.equal(f.pending.length, 1, "resolved Factory score source stays cached");
    f.host.selected = second;
    f.host.updateFactoryScores();
    f.host.pageMode = "parts";
    f.pending[1]!.resolve({ marker: "beta" });
    await flush();
    states.push(f.snapshot());
    f.host.pageMode = "factory";
    f.host.selected = { ...first, path: "kart/gamma" };
    f.host.updateFactoryScores();
    f.pending[2]!.reject(new Error("score archive failed"));
    await flush();
    states.push(f.snapshot());
    f.host.disposed = true;
    f.host.updateFactoryScores();
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(await run(false), await run(true));
});

test("generated GarageXView delegates native Factory scoring methods", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-factory-scoring\.ts"/);
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const methods = new Map(view.body.body.flatMap(node =>
    node.type === "ClassMethod" && node.key.type === "Identifier"
      ? [[node.key.name, generated.slice(node.start!, node.end!)] as const] : []));
  for (const [name, delegate] of [
    ["updateFactoryScores", "updateGarageFactoryScores"],
    ["factoryVehicleKey", "garageFactoryVehicleKey"],
    ["canonicalFactoryVehicle", "canonicalGarageFactoryVehicle"],
    ["serialFor", "garageKartSerialFor"],
  ] as const) assert.match(methods.get(name) ?? "", new RegExp(`${delegate}\\(this,`));
});
