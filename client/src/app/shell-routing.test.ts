import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import { shellRouting, type ShellRoutingHost } from "./shell-routing";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as { parse(source: string, options: object): any };
const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class Bf0 {");
const classEnd = release.indexOf("\nfunction Rf0", classStart);
assert.ok(classStart >= 0 && classEnd > classStart);
const classSource = release.slice(classStart, classEnd);
const ast = parse(classSource, { sourceType: "script" });
const selected = new Set(Object.keys(shellRouting));
const members = ast.program.body[0].body.body.filter((member: any) =>
  member.key?.type === "Identifier" && selected.has(member.key.name));
assert.equal(members.length, selected.size);
const originalSource = members.map((member: any) =>
  classSource.slice(member.start, member.end)).join("\n");

type Event = unknown[];
const routes = shellRouting as unknown as Record<string,
  (host: ShellRoutingHost, ...args: unknown[]) => unknown>;

function makeHost(rewritten: boolean, hasAudioContext = true): {
  host: ShellRoutingHost; events: Event[];
} {
  const events: Event[] = [];
  const applyAudioOptions = (context: unknown, options: unknown) => {
    events.push(["apply-audio-options", context, options]);
  };
  const Original = new Function("Qc", `return class { ${originalSource} };`)(
    applyAudioOptions,
  ) as new () => ShellRoutingHost;
  const host = new Original();
  const service = (owner: string) => new Proxy({}, {
    get: (_target, name) => (...args: unknown[]) => {
      events.push(["call", owner, String(name), ...args]);
      return `result:${owner}.${String(name)}`;
    },
  });
  const presenter = service("presenter") as ShellRoutingHost["presenter"];
  const ready = service("ready") as ShellRoutingHost["ready"];
  const drivingPipeline = service("driving") as ShellRoutingHost["drivingPipeline"];
  const records = service("records") as ShellRoutingHost["records"];
  const hud = { update: (state: unknown, fps: unknown) => {
    events.push(["hud-update", state, fps]);
  } };
  const cameras = { update: (...args: unknown[]) => {
    events.push(["camera-update", ...args]);
  } };
  const audio = { context: hasAudioContext ? "audio-context" : undefined };
  Object.defineProperties(host, {
    presenter: { get: () => { events.push(["get", "presenter"]); return presenter; } },
    ready: { get: () => { events.push(["get", "ready"]); return ready; } },
    drivingPipeline: { get: () => {
      events.push(["get", "drivingPipeline"]); return drivingPipeline;
    } },
    records: { get: () => { events.push(["get", "records"]); return records; } },
    hud: { get: () => { events.push(["get", "hud"]); return hud; } },
    cameras: { get: () => { events.push(["get", "cameras"]); return cameras; } },
    camera: { get: () => { events.push(["get", "camera"]); return "camera"; } },
    session: { get: () => { events.push(["get", "session"]); return "session"; } },
    physics: { get: () => { events.push(["get", "physics"]); return { state: "physics-state" }; } },
    track: { get: () => { events.push(["get", "track"]); return "track"; } },
    fps: { get: () => { events.push(["get", "fps"]); return 144; } },
    audio: { get: () => { events.push(["get", "audio"]); return audio; } },
    gameOptions: { get: () => {
      events.push(["get", "gameOptions"]); return { music: true };
    } },
  });
  if (rewritten) {
    for (const name of selected) {
      Object.defineProperty(host, name, { configurable: true,
        value: (...args: unknown[]) => name === "applySavedAudioOptions"
          ? routes[name]?.(host, applyAudioOptions)
          : routes[name]?.(host, ...args),
      });
    }
  }
  return { host, events };
}

function inspectMethod(name: string, rewritten: boolean, hasAudioContext = true): unknown {
  const { host, events } = makeHost(rewritten, hasAudioContext);
  const method = (host as unknown as Record<string, (...args: unknown[]) => unknown>)[name];
  assert.ok(method);
  const result = method.call(host, 101, "second", "third", "fourth");
  return { result, events };
}

test("Ready, Presenter, driving, record, HUD and camera routing matches release", () => {
  for (const name of selected) {
    assert.deepEqual(inspectMethod(name, true), inspectMethod(name, false), name);
  }
});

test("audio option routing skips a missing context like release", () => {
  assert.deepEqual(inspectMethod("applySavedAudioOptions", true, false),
    inspectMethod("applySavedAudioOptions", false, false));
});
