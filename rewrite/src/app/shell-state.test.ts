import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import {
  currentRhoLibrary, getOrCreateAudioDirector, getOrCreateRaceSession,
  getOrCreateReplayLibrary, requireRacePhysics, requireRaceTrack,
} from "./shell-state";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as { parse(source: string, options: object): any };
const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class Bf0 {");
const classEnd = release.indexOf("\nfunction Rf0", classStart);
assert.ok(classStart >= 0 && classEnd > classStart);
const classSource = release.slice(classStart, classEnd);
const ast = parse(classSource, { sourceType: "script" });
const selected = new Set(["session", "audio", "replayLibrary", "rhoLibrary", "physics", "track"]);
const members = ast.program.body[0].body.body.filter((member: any) =>
  member.key?.type === "Identifier" && selected.has(member.key.name));
assert.equal(members.length, selected.size);
const originalSource = members.map((member: any) =>
  classSource.slice(member.start, member.end)).join("\n");

type TestedHost = {
  raceSession?: { physics?: unknown; track?: unknown } | null;
  audioDirector?: { name: string } | null;
  replayLibraryInstance?: { name: string } | null;
  assets: { current?: string };
  readonly session: { physics?: unknown; track?: unknown };
  readonly audio: { name: string };
  readonly replayLibrary: { name: string };
  readonly rhoLibrary?: string;
  readonly physics: unknown;
  readonly track: unknown;
};

function inspect(rewritten: boolean): unknown {
  const events: unknown[][] = [];
  class Session {
    physics?: unknown;
    track?: unknown;
    constructor() { events.push(["new-session"]); }
  }
  class Audio {
    name = "audio";
    constructor() { events.push(["new-audio"]); }
  }
  class Library {
    name = "library";
    constructor() { events.push(["new-library"]); }
  }
  const Original = new Function("Bd0", "bf0", "Pt", `return class { ${originalSource} };`)(
    Session, Audio, Library,
  ) as new () => TestedHost;
  const host = new Original();
  host.assets = { current: "rho-1" };
  if (rewritten) {
    Object.defineProperties(host, {
      session: { configurable: true, get: () => getOrCreateRaceSession(host, () => new Session()) },
      audio: { configurable: true, get: () => getOrCreateAudioDirector(host, () => new Audio()) },
      replayLibrary: { configurable: true, get: () =>
        getOrCreateReplayLibrary(host, () => new Library()) },
      rhoLibrary: { configurable: true, get: () => currentRhoLibrary(host) },
      physics: { configurable: true, get: () => requireRacePhysics(host) },
      track: { configurable: true, get: () => requireRaceTrack(host) },
    });
  }
  const firstSession = host.session;
  const firstAudio = host.audio;
  const firstLibrary = host.replayLibrary;
  const cached = {
    session: host.session === firstSession,
    audio: host.audio === firstAudio,
    replay: host.replayLibrary === firstLibrary,
  };
  const rhoBefore = host.rhoLibrary;
  host.assets.current = "rho-2";
  const rhoAfter = host.rhoLibrary;
  host.raceSession = null;
  host.audioDirector = null;
  host.replayLibraryInstance = null;
  const recreated = {
    session: host.session !== firstSession,
    audio: host.audio !== firstAudio,
    replay: host.replayLibrary !== firstLibrary,
  };

  // The required getters intentionally access `session` again on success.
  const selectedSession: { physics?: unknown; track?: unknown } = {};
  Object.defineProperty(host, "session", { configurable: true,
    get: () => { events.push(["session-read"]); return selectedSession; } });
  const errors: string[] = [];
  try { void host.physics; } catch (error) { errors.push((error as Error).message); }
  try { void host.track; } catch (error) { errors.push((error as Error).message); }
  selectedSession.physics = "physics-owner";
  selectedSession.track = "track-owner";
  const physics = host.physics;
  const track = host.track;
  return { events, cached, recreated, rhoBefore, rhoAfter, errors, physics, track };
}

test("lazy shell owners and required race accessors match release", () => {
  assert.deepEqual(inspect(true), inspect(false));
});
