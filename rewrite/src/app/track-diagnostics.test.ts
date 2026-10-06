import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import {
  devToolsTrackObjects, devToolsTrackObjectsSource, devToolsTrackOwner,
  type TrackDiagnosticHost, type TrackDiagnosticOwner, type TrackObjectSource,
} from "./track-diagnostics";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as { parse(source: string, options: object): any };
const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class Bf0 {");
const classEnd = release.indexOf("\nfunction Rf0", classStart);
assert.ok(classStart >= 0 && classEnd > classStart);
const classSource = release.slice(classStart, classEnd);
const ast = parse(classSource, { sourceType: "script" });
const selected = new Set([
  "devToolsTrackOwner", "devToolsTrackObjects", "devToolsTrackObjectsSource",
]);
const members = ast.program.body[0].body.body.filter((member: any) =>
  member.key?.type === "Identifier" && selected.has(member.key.name));
assert.equal(members.length, selected.size);
const originalSource = members.map((member: any) =>
  classSource.slice(member.start, member.end)).join("\n");

type Event = unknown[];
type Mode = "full" | "no-track" | "no-physics" | "route-error" |
  "non-track-admission" | "no-collector" | "no-library" |
  "no-metadata" | "no-environment" | "selected-kinds";
type TestedHost = TrackDiagnosticHost & {
  devToolsTrackOwner(): TrackDiagnosticOwner | undefined;
  devToolsTrackObjectsSource(): TrackObjectSource | undefined;
};

function makeHost(rewritten: boolean, mode: Mode): {
  host: TestedHost; events: Event[]; admittedObjects: unknown[];
} {
  const events: Event[] = [];
  const defaultKinds = new Set(["item", "obstacle"]);
  const Original = new Function("Gf0", `return class { ${originalSource} };`)(
    defaultKinds,
  ) as new () => TestedHost;
  const host = new Original();
  const admittedObjects = [{ kind: "item", id: 10 }, { kind: "obstacle", id: 11 }];
  host.session = {
    track: mode === "no-track" ? undefined : {
      data: { trackId: "village_R01" },
      getRouteState: physics => {
        events.push(["route-state", physics]);
        if (mode === "route-error") throw new Error("route unavailable");
        return { checkpoint: 4 };
      },
    },
    physics: mode === "no-physics" ? undefined : "physics",
    admission: { parsed: { root: {
      kind: mode === "non-track-admission" ? "garage" : "track",
      trackObjects: admittedObjects,
    } } },
    trackMetadata: mode === "no-metadata" ? undefined : { trackId: "village_R01" },
    toonEnvironment: mode === "no-environment" ? undefined : "environment",
  };
  host.devToolsTrackObjectSelection = mode === "selected-kinds" ? new Set() : undefined;
  host.devToolsCollectorInstance = mode === "no-collector" ? undefined : {
    trackObjectSnapshots: objects => {
      events.push(["snapshots", objects.length]);
      return objects.map((object: any) => ({ id: object.id }));
    },
  };
  Object.defineProperty(host, "rhoLibrary", {
    configurable: true,
    get: () => {
      events.push(["library-get"]);
      return mode === "no-library" ? undefined : "rho-library";
    },
  });
  host.toonStageBinding = "stage-binding";
  host.assets = {
    get generationValue() {
      events.push(["generation-get"]);
      return 17;
    },
    isCurrent: generation => {
      events.push(["is-current", generation]);
      return generation === 17;
    },
  };
  if (rewritten) {
    host.devToolsTrackOwner = () => devToolsTrackOwner(host, defaultKinds);
    host.devToolsTrackObjects = () => devToolsTrackObjects(host);
    host.devToolsTrackObjectsSource = () => devToolsTrackObjectsSource(host);
  }
  return { host, events, admittedObjects };
}

function inspect(rewritten: boolean, mode: Mode): unknown {
  const { host, events, admittedObjects } = makeHost(rewritten, mode);
  const objects = host.devToolsTrackObjects();
  const owner = host.devToolsTrackOwner();
  const source = host.devToolsTrackObjectsSource();
  const itemCube = source?.itemCube;
  const generationCurrent = itemCube?.isGenerationCurrent(17);
  const generationExpired = itemCube?.isGenerationCurrent(16);
  return {
    objects, sameAdmittedObjects: objects === admittedObjects,
    owner, source: source && {
      objects: source.objects,
      visibleKinds: source.visibleKinds,
      itemCube: itemCube && {
        library: itemCube.library,
        metadata: itemCube.metadata,
        environment: itemCube.environment,
        stageBinding: itemCube.stageBinding,
        generation: itemCube.generation,
      },
    },
    generationCurrent, generationExpired, events,
  };
}

test("track diagnostic owner, objects and item-cube bridge match release", () => {
  for (const mode of ["full", "no-track", "no-physics", "route-error",
    "non-track-admission", "no-collector", "no-library", "no-metadata",
    "no-environment", "selected-kinds"] as const) {
    assert.deepEqual(inspect(true, mode), inspect(false, mode), mode);
  }
});
