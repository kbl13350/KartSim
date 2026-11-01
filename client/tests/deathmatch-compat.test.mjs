import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import { applyBraveCompatibility } from "../tools/brave-compat.mjs";
import { applyDeathmatchCompatibility } from "../tools/deathmatch-compat.mjs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const names = ["formats.js", "library.js", "vehicle.js", "world.js"];
const generated = Object.fromEntries(names.map(name => [name, read(`../src/generated/${name}`)]));

for (const name of names) test(`Deathmatch compatibility survives regeneration and repeated Brave application: ${name}`, () => {
  const source = generated[name];
  assert.equal(applyDeathmatchCompatibility(name, source), source);
  assert.equal(applyBraveCompatibility(name, source), source);
  assert.equal(applyDeathmatchCompatibility(name, applyBraveCompatibility(name, source)), source);
  assert.throws(() => applyDeathmatchCompatibility(name, "// upstream changed\n"), /missing or ambiguous/);
});

test("the shipped gameplay admission freezes original team mode 58 only on the P3553 team channel", async () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) };
  let formats, library;
  try {
    [formats, library] = await Promise.all([import("../src/generated/formats.js"), import("../src/generated/library.js")]);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
  const room = { gameplay: "deathmatch", channelName: "speedTeamCombine", resourceVersion: "p3553" };
  assert.equal(formats.cw("deathmatch"), true);
  assert.equal(formats.G2(room), "deathmatch");
  assert.equal(formats.To("deathmatch", room.channelName, room.resourceVersion), true);
  for (const channel of ["speedIndiCombine", "speedTeamInfinit", "itemTeamCombine"])
    assert.equal(formats.To("deathmatch", channel, "p3553"), false);
  assert.equal(formats.To("deathmatch", room.channelName, "p948"), false);
  assert.doesNotThrow(() => library.MI("deathmatch"));
  assert.equal(formats.SX(room), 58);
  const mode = library.vI(formats.SX(room));
  assert.deepEqual({ modeId: mode.modeId, kind: mode.kind, team: mode.team },
    { modeId: 58, kind: "deathmatch", team: true });
  assert.ok(Object.isFrozen(mode));
  assert.doesNotThrow(() => library.Q00(mode));
  assert.throws(() => library.Q00(Object.freeze({ ...mode, team: false })), /身份不一致/);
  assert.equal(library.vI(31).kind, "brave");
});

test("generated map wrappers forward frozen arena state separately from Brave direction", () => {
  const source = generated["vehicle.js"];
  const declaration = parse(source, { sourceType: "module" }).program.body.find(node => node.id?.name === "ul");
  assert.ok(declaration);
  const calls = [];
  const Owner = new Function("loadMultiplayerMap", "loadTrackMap", "Bt", "Vw", "Z30", "trackMapOps",
    `${source.slice(declaration.start, declaration.end)}\nreturn ul;`)(
    (...args) => calls.push(["multiplayer", ...args]), (...args) => calls.push(["track", ...args]),
    "version", "lte-track", "admit", "ops");
  const owner = new Owner({});
  const state = { ruleset: "web-deathmatch-v1" };
  owner.loadMultiplayerMap("track_/ice_D01/track.1s", "ice_D01", "deathmatch", undefined, state);
  assert.deepEqual(calls[0], ["multiplayer", owner, "track_/ice_D01/track.1s", "ice_D01", "deathmatch",
    "version", "lte-track", "admit", undefined, state]);
  owner.loadMap("arena", "ice_D01", "speed-individual", "admit", false, false, undefined, state);
  assert.deepEqual(calls[1], ["track", owner, "arena", "ice_D01", "speed-individual", "admit", false,
    "ops", false, undefined, state]);
});

test("the maintained generator applies Deathmatch after Brave without private release captures", () => {
  const source = read("../tools/generate-modules.mjs");
  const ast = parse(source, { sourceType: "module" }).program.body;
  assert.ok(ast.some(node => node.type === "ImportDeclaration" && node.source.value === "./deathmatch-compat.mjs"));
  const method = ast.find(node => node.type === "FunctionDeclaration" && node.id.name === "writeIfChanged");
  assert.ok(method);
  const body = source.slice(method.start, method.end);
  assert.ok(body.indexOf("applyDeathmatchCompatibility") > body.indexOf("applyBraveCompatibility"));
});
