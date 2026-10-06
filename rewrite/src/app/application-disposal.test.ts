import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import { disposeApplicationRuntime, type ApplicationDisposalHost } from "./application-disposal";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as { parse(source: string, options: object): any };
const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class Bf0 {");
const classEnd = release.indexOf("\nfunction Rf0", classStart);
assert.ok(classStart >= 0 && classEnd > classStart);
const classSource = release.slice(classStart, classEnd);
const ast = parse(classSource, { sourceType: "script" });
const disposalMember = ast.program.body[0].body.body.find((member: any) =>
  member.key?.type === "Identifier" && member.key.name === "dispose");
assert.ok(disposalMember);
const originalSource = classSource.slice(disposalMember.start, disposalMember.end);

type Event = Array<string | boolean | undefined>;
let originalEvents: Event[] = [];
const Original = new Function("Pp", "window", `return class { ${originalSource} };`)(
  (enabled: boolean) => originalEvents.push(["toon-lines", enabled]),
  { removeEventListener: (name: string, callback: unknown) =>
    originalEvents.push(["remove-listener", name, String(callback)]) },
) as new () => ApplicationDisposalHost & { dispose(): void };

function makeHost(rewritten: boolean, sparse: boolean): {
  host: ApplicationDisposalHost & { dispose?: () => void };
  events: Event[];
} {
  const events: Event[] = [];
  const disposable = (name: string) => ({
    dispose(argument?: boolean) { events.push(["dispose", name, argument]); },
  });
  const host = new Original();
  host.canvasDiagnostics = disposable("canvas-diagnostics");
  host.devToolsHandle = disposable("dev-tools");
  host.devToolsOverlayHandle = disposable("dev-tools-overlay");
  host.devToolsObjectsOverlayHandle = disposable("dev-tools-objects");
  host.shell = disposable("shell");
  host.assets = { invalidate: () => events.push(["invalidate-assets"]) };
  host.presenter = {
    ...disposable("presenter"),
    disposeRaceInterface: () => events.push(["dispose-race-interface"]),
  };
  host.activeBlackBar = disposable("black-bar");
  host.viewportResizeObserver = { disconnect: () => events.push(["disconnect-resize"]) };
  host.onGlobalKeyDown = "key-handler";
  host.onViewportResize = "resize-handler";
  host.touchControls = disposable("touch-controls");
  host.input = disposable("input");
  host.kartView = disposable("kart-view");
  host.ready = disposable("ready");
  host.session = {
    coordinator: disposable("coordinator"),
    flyingPet: disposable("flying-pet"),
    vehicleRender: disposable("vehicle"),
    characterRender: disposable("character"),
    linkedCharacterRender: disposable("linked-character"),
    kartEffects: disposable("kart-effects"),
    ghosts: [{ view: disposable("ghost-1") }, { view: disposable("ghost-2") }],
    outlineBatch: disposable("outlines"),
    balloonDecoration: disposable("balloon"),
    characterDecorations: [{ render: disposable("decoration") }],
    raceAura: { active: true },
    kartTrails: disposable("trails"),
    kartDriftEffects: disposable("drift-effects"),
    kartMotionBlur: disposable("motion-blur"),
    zetAirEffect: disposable("zet-air"),
    shockWaveEffect: disposable("shock-wave"),
    exhaustEffect: disposable("exhaust"),
    crashEffect: disposable("crash"),
    chargerEffect: disposable("charger"),
    particleModification: disposable("particle-modification"),
    particleModificationBanner: disposable("particle-banner"),
    particleModificationBannerRequest: { active: true },
    trackEventEffects: disposable("track-events"),
    trackEventAudio: disposable("track-event-audio"),
    trackDummyAudio: disposable("track-dummy-audio"),
    lampFlares: disposable("lamp-flares"),
    simpleShadow: disposable("shadow"),
    tachometer: disposable("tachometer"),
    pause: disposable("pause"),
    rain: disposable("rain"),
    rainAudio: disposable("rain-audio"),
    snow: disposable("snow"),
    toonEnvironment: disposable("toon-environment"),
    track: disposable("track"),
  };
  host.audio = {
    interfaceAudio: disposable("interface-audio"),
    bgm: disposable("bgm"),
    countdownAudio: disposable("countdown-audio"),
    kartAudio: disposable("kart-audio"),
    context: { state: sparse ? "closed" : "running",
      close: () => events.push(["close-audio-context"]) },
  };
  host.toonStageBinding = {
    retain: () => events.push(["retain-toon-environment"]),
    dispose: () => events.push(["dispose-toon-binding"]),
  };
  host.hud = disposable("hud");
  host.renderer = {
    ...disposable("renderer"),
    domElement: { remove: () => events.push(["remove-canvas"]) },
  };
  host.releaseReadyToonEnvironment = () => events.push(["release-ready-environment"]);
  if (sparse) {
    host.devToolsHandle = undefined;
    host.devToolsOverlayHandle = undefined;
    host.devToolsObjectsOverlayHandle = undefined;
    host.activeBlackBar = undefined;
    host.session.ghosts = [];
    host.session.characterDecorations = [];
    host.session.toonEnvironment = undefined;
    host.session.particleModification = undefined;
    host.session.particleModificationBanner = undefined;
    host.audio.kartAudio = undefined;
  }
  if (rewritten) {
    host.dispose = () => disposeApplicationRuntime(host, {
      setToonLinesEnabled: enabled => events.push(["toon-lines", enabled]),
      removeWindowListener: (name, callback) =>
        events.push(["remove-listener", name, String(callback)]),
    });
  } else {
    originalEvents = events;
  }
  return { host, events };
}

function run(rewritten: boolean, sparse: boolean): unknown {
  const { host, events } = makeHost(rewritten, sparse);
  host.dispose?.();
  const session = host.session;
  return {
    events,
    clearedHandles: [host.devToolsHandle, host.devToolsOverlayHandle,
      host.devToolsObjectsOverlayHandle, host.activeBlackBar],
    clearedSession: [session.flyingPet, session.ghosts, session.outlineBatch,
      session.raceAura, session.particleModification, session.particleModificationBanner,
      session.particleModificationBannerRequest],
  };
}

test("application shutdown order and retained state match the release", () => {
  assert.deepEqual(run(true, false), run(false, false));
  assert.deepEqual(run(true, true), run(false, true));
});
