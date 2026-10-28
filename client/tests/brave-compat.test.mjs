import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { parse } from "@babel/parser";
import { applyBraveCompatibility } from "../tools/brave-compat.mjs";
import { BraveSignals, noteBraveKartContact } from "../src/multiplayer/brave-signals.ts";

const read = relative => readFileSync(new URL(relative, import.meta.url), "utf8");
const filenames = ["formats.js", "library.js", "vehicle.js", "world.js"];
const generated = Object.fromEntries(filenames.map(name => [name, read(`../src/generated/${name}`)]));

// Read the shipped modules, so these checks also work without recovered/ inputs.
function declarations(source) {
  const nodes = parse(source, { sourceType: "module" }).program.body;
  return name => {
    const node = nodes.find(item => item.id?.name === name ||
      item.declarations?.some(part => part.id.name === name));
    assert.ok(node, `missing declaration ${name}`);
    return source.slice(node.start, node.end);
  };
}

for (const filename of filenames) {
  test(`brave compatibility is installed and idempotent in ${filename}`, () => {
    const once = applyBraveCompatibility(filename, generated[filename]);
    assert.equal(once, generated[filename]);
    assert.equal(applyBraveCompatibility(filename, once), once);
  });

  test(`brave compatibility rejects missing seams in ${filename}`, () => {
    assert.throws(() => applyBraveCompatibility(filename, "// changed upstream module\n"),
      new RegExp(`Brave compatibility seam missing or ambiguous in ${filename.replace(".", "\\.")}`));
  });
}

const collisionResponse = "      n.applyKartPairResponse(dE(f.linear), dE(f.angular), f.strength);";
const contactHook = "\n      noteBraveKartContact(n, l); // brave: actual kart impulse, never a wall/proximity guess";
const worldBeforeContactHook = generated["world.js"].replace(collisionResponse + contactHook, collisionResponse);

test("brave compatibility installs a missing kart contact seam and rejects an ambiguous one", () => {
  assert.notEqual(worldBeforeContactHook, generated["world.js"]);
  assert.equal(applyBraveCompatibility("world.js", worldBeforeContactHook), generated["world.js"]);
  const ambiguous = worldBeforeContactHook.replace(collisionResponse,
    `${collisionResponse}\n${collisionResponse}`);
  assert.throws(() => applyBraveCompatibility("world.js", ambiguous), /missing or ambiguous in world\.js/);
  assert.equal(applyBraveCompatibility("unrelated.js", "const untouched = true;"), "const untouched = true;");
});

test("normal generator writes run brave compatibility after localization", async () => {
  const source = read("../tools/generate-modules.mjs");
  const ast = parse(source, { sourceType: "module" }).program.body;
  assert.ok(ast.some(node => node.type === "ImportDeclaration" &&
    node.source.value === "./brave-compat.mjs" && node.specifiers.some(specifier =>
      specifier.imported?.name === "applyBraveCompatibility" &&
      specifier.local.name === "applyBraveCompatibility")));

  const calls = [];
  let disk = worldBeforeContactHook;
  const writeIfChanged = new Function("localizeGeneratedModule", "applyBraveCompatibility", "path",
    "outputDir", "readFile", "writeFile", `${declarations(source)("writeIfChanged")}\nreturn writeIfChanged;`)(
    (filename, contents) => { calls.push(["localize", filename]); return contents; },
    (filename, contents) => { calls.push(["brave", filename]); return applyBraveCompatibility(filename, contents); },
    path, "/memory/generated",
    async filename => { calls.push(["read", filename]); return disk; },
    async (filename, contents) => { calls.push(["write", filename]); disk = contents; },
  );
  await writeIfChanged("world.js", worldBeforeContactHook);
  assert.equal(disk, generated["world.js"]);
  assert.deepEqual(calls, [["localize", "world.js"], ["brave", "world.js"],
    ["read", "/memory/generated/world.js"], ["write", "/memory/generated/world.js"]]);
  calls.length = 0;
  await writeIfChanged("world.js", worldBeforeContactHook);
  assert.deepEqual(calls.map(call => call[0]), ["localize", "brave", "read"]);
});

test("released lobby admission and SX feed the frozen brave mode returned by vI", async () => {
  // The release's module-preload probe is the only DOM operation at import time.
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) };
  let formats, library;
  try {
    [formats, library] = await Promise.all([
      import("../src/generated/formats.js"), import("../src/generated/library.js"),
    ]);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
  const room = { gameplay: "brave", channelName: "speedTeamCombine", resourceVersion: "p3553" };
  assert.equal(formats.cw(room.gameplay), true);
  assert.doesNotThrow(() => library.MI(room.gameplay));
  assert.equal(formats.To(room.gameplay, room.channelName, room.resourceVersion), true);
  for (const channel of ["speedIndiCombine", "speedTeamInfinit", "itemTeamCombine"])
    assert.equal(formats.To("brave", channel, "p3553"), false);
  assert.equal(formats.To("brave", "speedTeamCombine", "p948"), false);
  assert.throws(() => formats.SX({ ...room, channelName: "speedIndiCombine" }), /玩法与类别不匹配/);

  const mode = library.vI(formats.SX(room));
  assert.deepEqual({ modeId: mode.modeId, kind: mode.kind, team: mode.team },
    { modeId: 31, kind: "brave", team: true });
  assert.equal(Object.isFrozen(mode), true);
  assert.doesNotThrow(() => library.Q00(mode));
  assert.throws(() => library.Q00({ ...mode }), /冻结/);
  assert.throws(() => library.Q00(Object.freeze({ ...mode, team: false })), /身份不一致/);
  assert.throws(() => library.Q00(Object.freeze({ modeId: 31, kind: "brave", team: true })), /冻结/);
});

// Execute the actual released pair solver, including overlap/closing-velocity
// checks, and its real Di0 caller. Collision detection and notice filtering are real.
const worldDeclaration = declarations(generated["world.js"]);
const collide = new Function("noteBraveKartContact",
  ["Y0", "RL", "b9", "Li0", "m2", "uE", "hE", "Pi0", "Nd", "Di0"]
    .map(worldDeclaration).join("\n") + "\nreturn Di0;")(noteBraveKartContact);

function collisionFixture(options = {}) {
  const { distance = 1, velocity = 10, active = true } = options;
  const target = Object.hasOwn(options, "target") ? options.target : "enemy";
  const impulses = [], sent = [];
  const zero = () => ({ x: 0, y: 0, z: 0 });
  const physics = {
    speedRaceMode: { kind: "brave" },
    networkCollisionState: () => ({ active, scaleX: 1, scaleY: 1 }),
    timeAttackTachometerCharger: () => ({ active: false }),
    body: { position: zero(), right: { x: 1, y: 0, z: 0 },
      forward: { x: 0, y: 0, z: 1 }, up: { x: 0, y: 1, z: 0 },
      linearVelocity: { x: velocity, y: 0, z: 0 }, angularVelocity: zero() },
    tuning: { mass: 100 }, collisionShape: { rawHalfWidth: 1, rawHalfLength: 2 },
    applyKartPairResponse: (...args) => impulses.push(args),
  };
  const signals = new BraveSignals(physics, "self", [
    { playerId: "self", team: 1 }, { playerId: "teammate", team: 1 },
    { playerId: "enemy", team: 2 }, { playerId: "enemy2", team: 2 },
  ], {
    async sendBraveCollision(id) { sent.push(id); },
    subscribeBraveCollision: () => () => {},
  }, () => 1000);
  signals.setActive(true);
  const fleet = {
    giant: () => undefined,
    forEachCollisionBody: (_now, contact) => contact({
      position: { x: distance, y: 0, z: 0 },
      rotation: [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }],
      velocity: zero(), angularVelocity: zero(), mass: 100,
      halfWidth: 1, halfLength: 2, scaleX: 1, scaleY: 1,
    }, 1, target),
  };
  return { impulses, sent, signals,
    run: () => collide(physics, fleet, { ordinary: 1, charger: 1 }, 1000) };
}

test("actual enemy kart impact produces an impulse and brave notice", () => {
  const fixture = collisionFixture();
  try {
    fixture.run();
    assert.equal(fixture.impulses.length, 1);
    assert.ok(fixture.impulses[0][2] > 0);
    assert.deepEqual(fixture.sent, ["enemy"]);
    assert.equal(fixture.signals.selfHitAt, 1000);
  } finally { fixture.signals.dispose(); }
});

test("actual teammate or unidentified contact keeps its impulse without a brave notice", () => {
  for (const target of ["teammate", undefined, null, "unknown"]) {
    const fixture = collisionFixture({ target });
    try {
      fixture.run();
      assert.equal(fixture.impulses.length, 1, String(target));
      assert.deepEqual(fixture.sent, [], String(target));
      assert.equal(fixture.signals.selfHitAt, -Infinity);
    } finally { fixture.signals.dispose(); }
  }
});

test("nearby, separating and inactive enemies cannot produce impact notices", () => {
  for (const options of [{ distance: 5 }, { velocity: -10 }, { velocity: 0 }, { active: false }]) {
    const fixture = collisionFixture(options);
    try {
      fixture.run();
      assert.deepEqual(fixture.impulses, [], JSON.stringify(options));
      assert.deepEqual(fixture.sent, [], JSON.stringify(options));
      assert.equal(fixture.signals.selfHitAt, -Infinity);
    } finally { fixture.signals.dispose(); }
  }
});

test("generated world only reports brave contact from its kart-pair path", () => {
  // Wall/surface collision paths must never dispatch a brave kart contact.
  const calls = [];
  const walk = (node, owner) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "FunctionDeclaration") owner = node.id?.name;
    if (node.type === "CallExpression" && node.callee?.name === "noteBraveKartContact") calls.push(owner);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(child => walk(child, owner));
      else if (value && typeof value === "object") walk(value, owner);
    }
  };
  walk(parse(generated["world.js"], { sourceType: "module" }));
  assert.deepEqual(calls, ["Di0"]);
});
