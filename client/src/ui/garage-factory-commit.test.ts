import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  GarageFactorySession, setGarageFactory, type GarageFactoryCommitDependencies,
  type GarageFactoryCommitHost, type GarageFactoryConfiguration,
  type GarageFactoryRecord, type GarageFactoryRequest, type GarageFactoryResponse,
} from "./garage-factory-commit";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const releaseAst = parse(release, { sourceType: "module" });
const functionSa = releaseAst.program.body.find(node =>
  node.type === "FunctionDeclaration" && node.id?.name === "Sa");
const variableQt = releaseAst.program.body.find(node =>
  node.type === "VariableDeclaration" && node.declarations.some(declaration =>
    declaration.id.type === "Identifier" && declaration.id.name === "Qt"));
const sessionClass = releaseAst.program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "$a");
const viewClass = releaseAst.program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(functionSa && variableQt && sessionClass && viewClass);
const OriginalSession = new Function(
  `${release.slice(functionSa.start!, functionSa.end!)}\n` +
  `${release.slice(variableQt.start!, variableQt.end!)}\n` +
  `${release.slice(sessionClass.start!, sessionClass.end!)}\nreturn $a;`,
)() as typeof GarageFactorySession;
const viewSource = release.slice(viewClass.start!, viewClass.end!);

const key = { category: 3, itemId: 101, serial: 7 };
const initialRecord: GarageFactoryRecord = {
  ...key, status: 1, reserved: 12, slots: [1, 2],
  protectionSlots: [65535, 65535], protectionCounts: [0, 0],
};
const changedRecord: GarageFactoryRecord = {
  ...key, status: 0, reserved: 0, slots: [4, 5],
  protectionSlots: [65535, 65535], protectionCounts: [0, 0],
};

function sessionFixture(released: boolean) {
  const sends: GarageFactoryRequest[] = [];
  const pending: Array<{
    resolve(response: GarageFactoryResponse): void;
    reject(reason: unknown): void;
  }> = [];
  const Session = released ? OriginalSession : GarageFactorySession;
  const source = [structuredClone(initialRecord)];
  const session = new Session(source, request => {
    sends.push(structuredClone(request));
    return new Promise((resolve, reject) => { pending.push({ resolve, reject }); });
  });
  const snapshot = () => ({
    records: structuredClone(session.records), current: structuredClone(session.current),
    pending: session.pending, error: session.error, sends: structuredClone(sends),
  });
  return { session, source, sends, pending, snapshot };
}

test("Factory record sessions match release cloning, selection and successful writes", async () => {
  const run = async (released: boolean) => {
    const f = sessionFixture(released);
    const states: unknown[] = [f.snapshot()];
    f.source[0]!.slots[0] = 99;
    f.session.select(key);
    states.push(f.snapshot());
    const request = f.session.request("activate", 0, 0);
    states.push(f.snapshot());
    await assert.rejects(f.session.request("reset", 0, 0), /改装请求尚未完成/);
    f.pending[0]!.resolve({ resultCode: 0, record: structuredClone(changedRecord) });
    await request;
    states.push(f.snapshot());
    f.session.select({ ...key, itemId: 999 });
    states.push(f.snapshot());
    f.session.select(undefined);
    await assert.rejects(f.session.request("install", 0, 0), /请先选择车辆/);
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(await run(false), await run(true));
});

test("Factory session errors and stale selections match release", async () => {
  const run = async (released: boolean) => {
    const f = sessionFixture(released);
    const states: unknown[] = [];
    f.session.select(key);
    const rejected = f.session.request("activate", 0, 0);
    f.pending[0]!.resolve({ resultCode: 17, record: structuredClone(changedRecord) });
    await assert.rejects(rejected, /改装失败（17）/);
    states.push(f.snapshot());
    const mismatch = f.session.request("reset", 0, 0);
    f.pending[1]!.resolve({ resultCode: 0, record: { ...changedRecord, itemId: 999 } });
    await assert.rejects(mismatch, /改装响应与请求车辆不匹配/);
    states.push(f.snapshot());
    const obsolete = f.session.request("install", 0, 0);
    f.session.select({ ...key, itemId: 102 });
    f.pending[2]!.reject(new Error("network error"));
    await assert.rejects(obsolete, /network error/);
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(await run(false), await run(true));
});

type TestHost = GarageFactoryCommitHost & { setFactory(factory: GarageFactoryConfiguration): Promise<void> };

function commitFixture(released: boolean, oldFactory?: GarageFactoryConfiguration) {
  const events: unknown[] = [];
  const pending: Array<{ resolve(): void; reject(error: Error): void }> = [];
  const nextFactory: GarageFactoryConfiguration = { active: true, abilities: [5, 6] };
  let serial = 7;
  let nativeAllowed = true;
  let rejectValidation = false;
  let currentSession: StubSession | undefined;
  class StubSession {
    pending = false;
    current?: GarageFactoryRecord;
    private selected?: { category: number; itemId: number; serial: number };

    constructor(records: GarageFactoryRecord[], _send: (request: GarageFactoryRequest) => Promise<GarageFactoryResponse>) {
      events.push(["session", structuredClone(records)]);
      this.current = records[0];
      currentSession = this;
    }

    select(value: { category: number; itemId: number; serial: number }): void {
      events.push(["select", structuredClone(value)]);
      this.selected = value;
    }

    request(operation: string, itemCategory: number, itemIdToUse: number): Promise<void> {
      events.push(["request", operation, itemCategory, itemIdToUse]);
      this.pending = true;
      return new Promise<void>((resolve, reject) => {
        pending.push({
          resolve: () => {
            this.pending = false;
            this.current = {
              ...this.selected!, status: nextFactory.active ? 0 : 1,
              reserved: 0, slots: [...nextFactory.abilities],
              protectionSlots: [65535, 65535], protectionCounts: [0, 0],
            };
            resolve();
          },
          reject: error => { this.pending = false; reject(error); },
        });
      });
    }
  }
  const dependencies: GarageFactoryCommitDependencies = {
    currentConfiguration: (configuration, itemId, recordSerial) => {
      events.push(["read", itemId, recordSerial]);
      return (configuration as { current: Record<string, unknown> }).current;
    },
    validateConfiguration: (_base, grade, equipment, speed) => {
      events.push(["validate", grade, structuredClone(equipment), speed]);
      if (rejectValidation) throw new Error("invalid factory setup");
    },
    writeConfiguration: (_configuration, itemId, recordSerial, equipment) => {
      events.push(["write", itemId, recordSerial, structuredClone(equipment)]);
      return { current: structuredClone(equipment) };
    },
    createSession: (records, send) => new StubSession(records, send) as unknown as GarageFactorySession,
  };
  const Original = new Function("K", "te", "ie", "$a", `${viewSource}; return As;`)(
    dependencies.currentConfiguration, dependencies.validateConfiguration,
    dependencies.writeConfiguration, StubSession,
  ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  host.selected = { itemId: 101, engineGrade: 9, title: "Kart 101" };
  host.configuration = { current: { factory: oldFactory, tailLamp: 3 } };
  host.options = { speed: "fast" };
  host.factorySession = undefined;
  host.factorySessionVehicleKey = undefined;
  host.disposed = false;
  host.pageMode = "factory";
  host.status = { textContent: "initial" };
  host.serial = () => { events.push("serial"); return serial; };
  host.base = () => { events.push("base"); return { defaultExceedType: 2 }; };
  host.nativeFactoryAllowed = () => { events.push(["allowed", nativeAllowed]); return nativeAllowed; };
  host.factoryVehicleKey = vehicle => {
    events.push(["vehicle-key", vehicle.itemId]);
    return `kart:${vehicle.itemId}`;
  };
  host.publishCurrentState = () => { events.push(["publish", structuredClone(host.configuration)]); };
  host.updateControls = () => { events.push("controls"); };
  if (!released) host.setFactory = factory => setGarageFactory(host, factory, dependencies);
  const snapshot = () => ({
    events: structuredClone(events), configuration: structuredClone(host.configuration),
    status: host.status.textContent, vehicleKey: host.factorySessionVehicleKey,
    pending: currentSession?.pending,
  });
  return { host, events, pending, nextFactory, snapshot,
    setSerial: (value: number) => { serial = value; },
    setNativeAllowed: (value: boolean) => { nativeAllowed = value; },
    setRejectValidation: (value: boolean) => { rejectValidation = value; } };
}

test("Factory optimistic commit and local confirmation match As", async () => {
  const run = async (released: boolean) => {
    const f = commitFixture(released, { active: false, abilities: [1, 2] });
    const operation = f.host.setFactory(f.nextFactory);
    const states: unknown[] = [f.snapshot()];
    await f.host.setFactory({ active: false, abilities: [9, 9] });
    states.push(f.snapshot());
    f.pending[0]!.resolve();
    await operation;
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(await run(false), await run(true));
});

test("Factory install and failed confirmation rollback match As", async () => {
  const run = async (released: boolean) => {
    const f = commitFixture(released);
    const states: unknown[] = [];
    const operation = f.host.setFactory(f.nextFactory);
    states.push(f.snapshot());
    f.pending[0]!.reject(new Error("request failed"));
    await operation;
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(await run(false), await run(true));
});

test("Factory validation, stale selection and disposed completion match As", async () => {
  const run = async (released: boolean) => {
    const f = commitFixture(released, { active: true, abilities: [1, 2] });
    const states: unknown[] = [];
    f.setNativeAllowed(false);
    await f.host.setFactory(f.nextFactory);
    states.push(f.snapshot());
    f.setNativeAllowed(true);
    f.setRejectValidation(true);
    await f.host.setFactory(f.nextFactory);
    states.push(f.snapshot());
    f.setRejectValidation(false);
    const stale = f.host.setFactory(f.nextFactory);
    f.host.selected = { itemId: 202, engineGrade: 9 };
    f.pending[0]!.reject(new Error("late error"));
    await stale;
    states.push(f.snapshot());
    f.host.selected = { itemId: 101, engineGrade: 9 };
    const disposed = f.host.setFactory(f.nextFactory);
    f.host.disposed = true;
    f.pending[1]!.resolve();
    await disposed;
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(await run(false), await run(true));
});

test("generated GarageXView delegates Factory commit and retires the original session", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-factory-commit\.ts"/);
  const ast = parse(generated, { sourceType: "module" });
  const view = ast.program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const method = view.body.body.find(node => node.type === "ClassMethod" &&
    node.key.type === "Identifier" && node.key.name === "setFactory");
  assert.ok(method);
  assert.match(generated.slice(method.start!, method.end!),
    /setGarageFactory\(this, factory, garageFactoryCommitDependencies\)/);
  assert.ok(!ast.program.body.some(node =>
    node.type === "ClassDeclaration" && node.id?.name === "$a" ||
    node.type === "FunctionDeclaration" && node.id?.name === "Sa" ||
    node.type === "VariableDeclaration" && node.declarations.some(declaration =>
      declaration.id.type === "Identifier" && declaration.id.name === "Qt")));
});
