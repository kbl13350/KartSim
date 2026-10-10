import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { VehicleSpecCatalog } from "./catalog";
import { createBodyParamSpec } from "./body-param";
import { speedBaseline, speedTypeEntry } from "./speed-baseline";
import { parseKartSpecCsv } from "./csv";

const data = (file: string) => readFileSync(new URL(`./data/${file}`, import.meta.url), "utf8");
const captured = data("vehicle-physics-h10.csv");
const supplemental = data("vehicle-physics-d10.csv");
const overrides = JSON.parse(data("vehicle-physics-overrides.json"));

// The current generated module may use the handwritten overrides. Isolate the
// original functions from the immutable downloaded release for the oracle.
(globalThis as unknown as { document: unknown }).document = {
  createElement: () => ({ relList: { supports: () => true } }),
};
const { AS } = await import("../generated/vehicle.js");
const { r7: runtimeSpeedTypeEntry, EI, i3 } = await import("../generated/library.js");
const { j0, x1 } = await import("../generated/formats.js");
const { hn } = await import("../generated/data.js");
const releaseSource = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const speedStart = releaseSource.indexOf("const I20 =");
const speedEnd = releaseSource.indexOf("const z20 =", speedStart);
assert.ok(speedStart > 0 && speedEnd > speedStart, "release SpeedType group is present");
const releaseSpeedTypeEntry = new Function("i3",
  `${releaseSource.slice(speedStart, speedEnd)}\nreturn r7;`)(i3) as
    (version: string, speed: number) => ReturnType<typeof speedTypeEntry>;
const originalStart = releaseSource.indexOf("function f10(");
const originalEnd = releaseSource.indexOf("const AS =", originalStart);
assert.ok(originalStart > 0 && originalEnd > originalStart, "release vehicle function group is present");
const original = new Function("hn", "h10", "d10", "r7", "j0", "qn", "EI",
  `${releaseSource.slice(originalStart, originalEnd)}\nreturn {
    parseTimeAttackKartSpecCsv: qw,
    createLocalTimeAttackParameters: ek,
    createVehicleTimeAttackParameters: JI,
    createBodyParamSpec: pS,
  };`)(hn, captured, supplemental, releaseSpeedTypeEntry, j0, 2_000_000, EI) as {
  parseTimeAttackKartSpecCsv: (csv: string) => Map<string, unknown>;
  createLocalTimeAttackParameters: (id: number, speed: number, version?: string) => unknown;
  createVehicleTimeAttackParameters: (vehicle: { itemId: number; systemKey?: string },
    speed: number, body?: unknown, version?: string) => unknown;
  createBodyParamSpec: (body: unknown, speed: number, version: string) => unknown;
};

test("captured CSV parser matches downloaded parser", () => {
  for (const csv of [captured, supplemental]) {
    const expected = original.parseTimeAttackKartSpecCsv(csv);
    const actual = parseKartSpecCsv(csv);
    assert.equal(actual.size, expected.size);
    for (const [key, value] of actual) assert.deepEqual(value, expected.get(key), key);
  }
});

test("complete SpeedType entries match isolated downloaded r7", () => {
  for (const version of ["国服", "国服复古", "韩服复古"] as const) {
    const speeds = version === "国服" ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [0, 1, 2, 3, 4, 5];
    for (const speed of speeds) {
      const expected = releaseSpeedTypeEntry(version, speed);
      assert.deepEqual(speedBaseline(version, speed), expected.fields, `${version}:${speed}:fields`);
      assert.deepEqual(speedTypeEntry(version, speed), expected, `${version}:${speed}:entry`);
      assert.deepEqual(runtimeSpeedTypeEntry(version, speed), expected,
        `${version}:${speed}:generated-seam`);
    }
  }
});

test("BodyParam combination matches the release pS across speed versions", () => {
  const samples = [
    {},
    { ForwardAccelForce: "31.5", DriftMaxGauge: "500", NormalBoosterTime: "42",
      TeamBoosterTime: "100", StartForwardAccelFactorItem: "1.65",
      StartForwardAccelFactorSpeed: "2.1", UseTransformBooster: "true",
      BikeRearWheel: "false", instAccelGaugeLength: "1.25",
      instAccelGaugeMinUsable: "0.2", wallCollGaugeMaxVelLoss: "75" },
  ];
  for (const version of ["国服", "国服复古", "韩服复古"] as const) {
    const speeds = version === "国服" ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [0, 1, 2, 3, 4, 5];
    for (const speed of speeds) for (const attributes of samples) {
      const body = { body: { attributes: Object.entries(attributes).map(([name, value]) => ({ name, value })) } };
      const expected = original.createBodyParamSpec(body, speed, version);
      assert.deepEqual(createBodyParamSpec(body, speed, version), expected, `${version}:${speed}`);
    }
  }
});

test("generated qw/ek seam resolves to the handwritten implementation", () => {
  assert.deepEqual(AS.parseTimeAttackKartSpecCsv(captured), parseKartSpecCsv(captured));
  for (const [id, speed] of [[1, 4], [1402, 7], [1466, 4], [1629, 7]] as const) {
    assert.deepEqual(AS.createLocalTimeAttackParameters(id, speed),
      original.createLocalTimeAttackParameters(id, speed), `${id}:${speed}`);
  }
});

test("vehicle lookup matches downloaded ek for all captured 4/7 combinations", () => {
  const catalog = new VehicleSpecCatalog(captured, supplemental, overrides);
  const keys = new Set([...catalog.captured.keys(), ...catalog.supplemental.keys()]);
  let available = 0;
  for (const key of keys) {
    const [id, speed] = key.split(":").map(Number);
    let expected: unknown;
    try { expected = original.createLocalTimeAttackParameters(id!, speed!); }
    catch { assert.throws(() => catalog.lookup(id!, speed!)); continue; }
    assert.deepEqual(catalog.lookup(id!, speed!), expected, key);
    available++;
  }
  assert.ok(available > 3000);
});

test("fallback and version validation match downloaded ek", () => {
  const catalog = new VehicleSpecCatalog(captured, supplemental, overrides);
  for (const id of [1, 1402, 1466, 1518, 1629, 1631]) {
    for (const [version, speed] of [["国服", 0], ["国服", 3],
      ["国服复古", 4], ["韩服复古", 5]] as const) {
      assert.deepEqual(catalog.lookup(id, speed, version),
        original.createLocalTimeAttackParameters(id, speed, version),
        `${id}:${version}:${speed}`);
    }
  }
});

test("system vehicle BodyParam path matches downloaded JI", () => {
  const catalog = new VehicleSpecCatalog(captured, supplemental, overrides);
  const cases = [
    { key: "legacyPractice", attributes: {} },
    { key: "practiceKart", attributes: {} },
    { key: "legacyPracticeX", attributes: {
      ForwardAccelForce: "31.5", DragFactor: "-0.01", DriftMaxGauge: "500",
      StartForwardAccelFactorItem: "1.65", StartForwardAccelFactorSpeed: "1.8",
      UseTransformBooster: "true", BikeRearWheel: "false", PartsEngineLock: "true",
      instAccelGaugeLength: "1.25", instAccelGaugeMinUsable: "0.2",
      chargerSystemboosterUseCount: "3", wallCollGaugeMaxVelLoss: "75",
    } },
    { key: "legacyPracticeBlackline", attributes: {
      Mass: "5", TeamBoosterTime: "200", DriftEscapeForce: "99",
      boostAccelFactorOnlyItem: "1.7", motorcycleType: "true",
    } },
  ];
  for (const { key, attributes } of cases) {
    const body = { body: { attributes: Object.entries(attributes).map(([name, value]) => ({ name, value })) } };
    const vehicle = { itemId: 0, systemKey: key };
    for (const speed of [4, 7]) {
      assert.deepEqual(catalog.createVehicleParameters(vehicle, speed, body),
        original.createVehicleTimeAttackParameters(vehicle, speed, body), `${key}:${speed}`);
    }
  }
  assert.deepEqual(createBodyParamSpec({}, 7),
    catalog.createVehicleParameters({ itemId: 0, systemKey: "legacyPractice" }, 7).spec);
});

test("p3553 real BodyParam XML matches downloaded pS and JI", () => {
  for (const [resource, key] of [["practiceX", "legacyPracticeX"],
    ["practiceblack0", "legacyPracticeBlackline"]] as const) {
    const xml = readFileSync(new URL(`../../../recovered/data-full/DataPack2/kart_/${resource}/param.xml`,
      import.meta.url), "utf8");
    // The extractor normalized XML to UTF-8; restore the release parser's UTF-16 input.
    const releaseXml = xml.replace("encoding='UTF-8'", "encoding='UTF-16'");
    const bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(releaseXml, "utf16le")]);
    const document = x1(bytes);
    assert.equal(document.root.name, "BodyParam");
    const body = { document, body: document.root };
    for (const speed of [4, 7]) {
      const actual = createBodyParamSpec(body, speed, "国服");
      assert.deepEqual(actual, original.createBodyParamSpec(body, speed, "国服"),
        `${resource}:${speed}:pS`);
      const vehicle = { itemId: 0, systemKey: key };
      const expected = original.createVehicleTimeAttackParameters(vehicle, speed, body);
      assert.deepEqual(new VehicleSpecCatalog(captured, supplemental, overrides)
        .createVehicleParameters(vehicle, speed, body), expected, `${resource}:${speed}:JI`);
      assert.deepEqual(AS.createVehicleTimeAttackParameters(vehicle, speed, body), expected,
        `${resource}:${speed}:JI:generated-seam`);
    }
  }
});
