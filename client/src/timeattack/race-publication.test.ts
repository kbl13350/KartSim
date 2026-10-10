import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  publishSoloRace, type GhostResource, type RaceCoatingStage,
  type RaceDisposable, type SoloRacePublisher, type SoloRaceResources,
  type SoloRaceSession,
} from "./race-publication";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const functionStart = release.indexOf("async function Af0(");
const functionEnd = release.indexOf("\nclass bf0", functionStart);
assert.ok(functionStart >= 0 && functionEnd > functionStart);
const source = release.slice(functionStart, functionEnd);

type Event = Array<string | number | boolean | undefined | null>;
let activeEvents: Event[] = [];
class OriginalLifecycle {
  constructor(readonly previousRecordMs: number | null) {
    activeEvents.push(["new-lifecycle", previousRecordMs]);
  }
}
const recordKey = (selection: { trackId?: string }, options: { speed: number }) => {
  activeEvents.push(["record-key", selection.trackId, options.speed]);
  return `${selection.trackId}:${options.speed}`;
};
const raceParam = (options: { speed: number }) => {
  activeEvents.push(["race-param", options.speed]);
  return { modeId: 9, speed: options.speed };
};
const originalAf0 = new Function("GF", "Pt", "yf0", `${source}\nreturn Af0;`)(
  OriginalLifecycle, { recordKey }, raceParam,
) as (host: SoloRacePublisher, selection: object, stage?: RaceCoatingStage) => Promise<void>;

interface Fixture {
  host: SoloRacePublisher;
  selection: { trackId: string; vehicleItemId: number };
  stage?: RaceCoatingStage;
  events: Event[];
  currentTrack: { name: string } | undefined;
}

type Mode = "full" | "sparse" | "build-error" | "validate-error" | "commit-error";

function makeFixture(mode: Mode): Fixture {
  const events: Event[] = [];
  activeEvents = events;
  const sparse = mode === "sparse";
  const disposable = (name: string): RaceDisposable & { name: string } => ({
    name,
    dispose(argument?: boolean) { events.push(["dispose", name, argument]); },
  });
  const visible = (name: string) => ({ ...disposable(name), object: `${name}-object` });
  const ghost = (name: string): GhostResource => ({
    view: {
      dispose: () => { events.push(["dispose", name]); },
      attachToScene: () => { events.push(["attach-ghost", name]); },
    },
  });
  const newAudioContext = { name: "new-context", state: "running", close: () => {
    events.push(["close", "new-context"]);
  } };
  const oldAudioContext = sparse ? newAudioContext : {
    name: "old-context", state: "running", close: () => {
      events.push(["close", "old-context"]);
    },
  };
  const newBgm = disposable("new-bgm");
  const newKartAudio = { ...disposable("new-kart-audio"),
    start: () => { events.push(["start-kart-audio"]); } };
  const session: SoloRaceSession = {
    coordinator: disposable("old-coordinator"),
    flyingPet: disposable("old-flying-pet"),
    vehicleRender: disposable("old-vehicle"),
    characterRender: disposable("old-character"),
    linkedCharacterRender: disposable("old-linked-character"),
    outlineBatch: disposable("old-outlines"),
    kartEffects: disposable("old-kart-effects"),
    ghosts: [ghost("old-ghost-1"), ghost("old-ghost-2")],
    balloonDecoration: disposable("old-balloon"),
    characterDecorations: [{ kind: "old-hat", render: disposable("old-hat") }],
    raceAura: disposable("old-aura"),
    kartTrails: visible("old-trails"),
    kartDriftEffects: visible("old-drift"),
    kartMotionBlur: disposable("old-motion-blur"),
    zetAirEffect: visible("old-zet"),
    shockWaveEffect: visible("old-shock"),
    exhaustEffect: visible("old-exhaust"),
    crashEffect: visible("old-crash"),
    chargerEffect: disposable("old-charger"),
    particleModification: disposable("old-particle"),
    particleModificationBanner: disposable("old-particle-banner"),
    particleModificationBannerRequest: { name: "old-banner-request" },
    trackEventEffects: disposable("old-track-effects"),
    trackEventAudio: disposable("old-track-audio"),
    trackDummyAudio: disposable("old-dummy-audio"),
    lampFlares: disposable("old-lamps"),
    simpleShadow: visible("old-shadow"),
    tachometer: disposable("old-tachometer"),
    pause: disposable("old-pause"),
    rain: visible("old-rain"),
    rainAudio: disposable("old-rain-audio"),
    snow: visible("old-snow"),
    toonEnvironment: disposable("old-toon-environment"),
  };
  if (sparse) {
    session.coordinator = undefined;
    session.flyingPet = undefined;
    session.characterRender = undefined;
    session.linkedCharacterRender = undefined;
    session.ghosts = [];
    session.characterDecorations = [];
    session.rain = undefined;
    session.snow = undefined;
    session.toonEnvironment = undefined;
    session.outlineBatch = undefined;
    session.particleModificationBanner = undefined;
  }
  const resources: SoloRaceResources = {
    audioContext: newAudioContext,
    loadedBgm: newBgm,
    loadedMap: {
      environment: disposable("new-toon-environment"),
      metadata: { id: "mountain" },
      readyCamera: { name: "ready-camera" },
      warpNextCamera: { name: "warp-camera" },
      admission: { name: "admission" },
    },
    loadedVehicle: {
      imported: { renderScene: disposable("new-vehicle") },
      effects: disposable("new-effects"),
      decoration: disposable("new-decoration"),
      accessories: [
        { kind: "aura", render: disposable("new-aura") },
        { kind: "hat", render: disposable("new-hat") },
      ],
      trails: visible("new-trails"),
      driftEffects: visible("new-drift"),
      motionBlur: disposable("new-motion-blur"),
      zetAirEffect: visible("new-zet"),
      shockWaveEffect: visible("new-shock"),
      exhaustEffect: visible("new-exhaust"),
      crashEffect: visible("new-crash"),
      chargerEffect: disposable("new-charger"),
      particleModification: disposable("new-particle"),
      lampFlares: disposable("new-lamps"),
      simpleShadow: visible("new-shadow"),
      tachometerRenderer: disposable("new-tachometer"),
      tachometerSelection: { folder: "speed-gauge" },
      audio: newKartAudio,
      kartItem: { itemId: 1097 },
    },
    loadedCharacters: {
      ordinary: { scene: disposable("new-character") },
      linked: { scene: disposable("new-linked-character") },
    },
    nextPhysics: { name: "new-physics" },
    nextTrack: { name: "new-track" },
    nextRain: sparse ? undefined : visible("new-rain"),
    nextRainAudio: sparse ? undefined : disposable("new-rain-audio"),
    nextSnow: sparse ? undefined : visible("new-snow"),
    nextGameplayUi: { name: "gameplay-ui" },
    nextAction2D: { name: "action-2d" },
    nextResult: { name: "result" },
    nextTrackInfoCard: { name: "track-card" },
    nextPause: disposable("new-pause"),
    nextCountdownAudio: disposable("new-countdown"),
    nextTrackEventEffects: disposable("new-track-effects"),
    nextTrackEventAudio: disposable("new-track-audio"),
    nextTrackDummyAudio: disposable("new-dummy-audio"),
    nextLinkedCharacterPresentation: { name: "linked-presentation" },
    nextFlyingPet: sparse ? undefined : disposable("new-flying-pet"),
    nextGhosts: [ghost("new-ghost-1"), ghost("new-ghost-2")],
    rankColors: ["red", "blue"],
    selectedVehicle: { title: "Speed Kart" },
    particleModificationBanner: disposable("new-particle-banner"),
    particleModificationBannerRequest: { name: "new-banner-request" },
    outlineBatch: disposable("new-outlines"),
  };
  const selection = { trackId: "mountain", vehicleItemId: 1097 };
  const readyOptions = { speed: 7, booster: 0 };
  const audio = {
    bgm: sparse ? newBgm : disposable("old-bgm"),
    bgmTrackId: "old-track",
    context: oldAudioContext,
    countdownAudio: disposable("old-countdown"),
    kartAudio: { ...disposable("old-kart-audio"), start: () => {} },
  };
  let currentTrack: { name: string } | undefined;
  const host: SoloRacePublisher = {
    session, audio,
    cameras: { beginNewStage: () => { events.push(["new-camera-stage"]); } },
    scene: { add: object => { events.push(["scene-add", String(object)]); } },
    toonStageBinding: { retain: environment => {
      events.push(["retain-toon", name(environment)]);
    } },
    tachometerGaugePreserve: { configure: folder => {
      events.push(["configure-tachometer", String(folder)]);
    } },
    presenter: {
      disposeRaceInterface: () => { events.push(["dispose-race-interface"]); },
      changeStage: (name, configuration) => {
        const value = configuration as {
          param: { modeId: number; speed: number };
          owners: Record<string, { name: string }>;
        };
        events.push(["change-stage", name, value.param.modeId, value.param.speed,
          Object.values(value.owners).map(owner => owner.name).join(",")]);
      },
    },
    library: { record: key => {
      events.push(["record", String(key)]);
      return sparse ? undefined : { elapsedMs: 2_500 };
    } },
    ready: { releaseForRace: () => { events.push(["release-ready"]); } },
    shell: { enterRace: () => { events.push(["enter-race"]); } },
    input: { setEnabled: enabled => { events.push(["input", enabled]); } },
    hud: { setPaused: paused => { events.push(["hud-paused", paused]); } },
    getRaceBuilder: () => ({
      build: async (requestedSelection, options, stage) => {
        events.push(["build", (requestedSelection as { trackId: string }).trackId,
          (options as { speed: number }).speed, !!stage]);
        if (mode === "build-error") throw new Error("build failed");
        return resources;
      },
    }),
    getReadyOptions: () => { events.push(["ready-options"]); return readyOptions; },
    getLocalNickname: () => { events.push(["local-nickname"]); return "Driver"; },
    replaceTrack: track => {
      currentTrack = track as { name: string };
      events.push(["replace-track", currentTrack.name]);
    },
    applyRaceOptions: kartItemId => { events.push(["apply-options", kartItemId]); },
    setPaused: paused => { events.push(["set-paused", paused]); },
  };
  const stage = sparse ? undefined : {
    validate: () => {
      events.push(["validate-stage"]);
      if (mode === "validate-error") throw new Error("stage invalid");
    },
    commit: () => {
      events.push(["commit-stage"]);
      if (mode === "commit-error") throw new Error("commit failed");
    },
  };
  return { host, selection, stage, events,
    get currentTrack() { return currentTrack; } };
}

function name(value: unknown): string | undefined {
  return (value as { name?: string } | undefined)?.name;
}

function summary(fixture: Fixture): unknown {
  const { host, events } = fixture;
  const session = host.session;
  return {
    events,
    currentTrack: fixture.currentTrack?.name,
    session: {
      flyingPet: name(session.flyingPet),
      vehicleRender: name(session.vehicleRender),
      characterRender: name(session.characterRender),
      linkedCharacterRender: name(session.linkedCharacterRender),
      ghostCount: session.ghosts.length,
      characterKinds: session.characterDecorations.map(item => item.kind),
      raceAura: name(session.raceAura),
      toonEnvironment: name(session.toonEnvironment),
      rain: name(session.rain),
      snow: name(session.snow),
      outlineBatch: name(session.outlineBatch),
      rankColors: session.rankColors,
      localName: session.localName,
      physics: name(session.physics),
      selection: session.selection,
      vehicleTitle: session.vehicleTitle,
      previousRecordMs: (session.lifecycle as { previousRecordMs?: number | null } | undefined)?.previousRecordMs,
      particleModificationBannerRequest: name(session.particleModificationBannerRequest),
    },
    audio: {
      bgm: name(host.audio.bgm),
      bgmTrackId: host.audio.bgmTrackId,
      context: name(host.audio.context),
      countdownAudio: name(host.audio.countdownAudio),
      kartAudio: name(host.audio.kartAudio),
    },
  };
}

async function run(mode: Mode, rewritten: boolean): Promise<unknown> {
  const fixture = makeFixture(mode);
  const { host, selection, stage, events } = fixture;
  try {
    if (rewritten) {
      await publishSoloRace(host, selection, stage, {
        createLifecycle: previousRecordMs => new OriginalLifecycle(previousRecordMs),
        recordKey,
        raceParam,
      });
    } else {
      await originalAf0(host, selection, stage);
    }
  } catch (error) {
    events.push(["rejected", error instanceof Error ? error.message : String(error)]);
  }
  return summary(fixture);
}

test("solo race publication cleans up old owners and commits in release order", async () => {
  assert.deepEqual(await run("full", true), await run("full", false));
});

test("solo race publication reuses audio owners and skips optional scenery like release", async () => {
  assert.deepEqual(await run("sparse", true), await run("sparse", false));
});

test("build, validation and commit failures preserve release boundaries", async () => {
  for (const mode of ["build-error", "validate-error", "commit-error"] as const) {
    assert.deepEqual(await run(mode, true), await run(mode, false));
  }
});
