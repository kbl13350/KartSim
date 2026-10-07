import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { createMultiplayerRaceLoader } from "../src/multiplayer/race-loader.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const node = parse(release, { sourceType: "module" }).program.body.find(item =>
  item.type === "FunctionDeclaration" && item.id.name === "Hs0");
assert.ok(node);
const originalSource = release.slice(node.start, node.end);

function fixture(roadblock, failAt) {
  const log = [];
  const resource = name => ({
    name,
    dispose() { log.push(["dispose", name]); },
  });
  const library = { id: "library" };
  const root = { id: "root" };
  const map = { path: "track/east/stage.1s", metadata: { cnTitle: "East", difficulty: 3 } };
  const participant = {
    playerId: "self",
    profile: { equipment: { itemIds: [1, 2, 3, 4], kartSerial: 5 }, garage: "garage" },
    vehicle: { kartItem: { engineGrade: 6 } },
  };
  const raceAssets = {
    map, participants: [participant],
    dispose() { log.push(["dispose", "assets"]); },
  };
  const source = { getLibrary: () => library, targetRandom: "random" };
  const audio = { id: "audio" };
  const bgm = {
    async selectRace(_library, metadata) { log.push(["bgm", metadata.cnTitle]); },
  };
  const host = {
    assets: () => source, audio: () => audio, profile: () => "profile", bgm: () => bgm,
    renderer: { domElement: { parentElement: root } },
    clientFramerate: 60, status: "status",
    raceAnonymous: () => true, classicHud: () => false,
    raceTimeGap: () => true, flyingPetVisible: () => true,
  };
  const config = { mode: roadblock ? "individual" : "team", speed: 2 };
  const room = { roadblock, trackId: 9, roster: [{ playerId: "self", team: 1 }] };
  const signal = { aborted: false };
  const connection = {
    playerId: "self", leaveRace() { log.push(["leave"]); },
    returnToRoom() { log.push(["return"]); },
    presentationClosed() { log.push(["closed"]); },
  };
  const load = (name, extra = {}) => async (...args) => {
    log.push(["load", name, args.length]);
    if (name === failAt) throw new Error(`fail:${name}`);
    return Object.assign(resource(name), extra);
  };
  const loadRaceAssets = async (_assets, _config, _room, _audio, player) => {
    log.push(["assets", player.playerId, player.anonymous, player.classicHud]);
    return raceAssets;
  };
  const loadCharacterAnimations = load("animations");
  class NetworkDriver {
    constructor(...args) { log.push(["driver", args.length]); }
    dispose() { log.push(["dispose", "driver"]); }
  }
  class TimeGap {
    static load(...args) { return load("timeGap", {
      async loadTimeGap(_library, _root) { log.push(["loadTimeGap"]); },
    })(...args); }
  }
  class Countdown { static load(...args) { return load("countdown")(...args); } }
  class Flag { static load(...args) { return load("flag", {
    bind(_connection, _assets) { log.push(["bindFlag"]); },
  })(...args); } }
  class TrackCard { static load(...args) { return load("trackCard", {
    setVisible(value) { log.push(["trackCardVisible", value]); },
  })(...args); } }
  class RoadblockResult {
    static loadHud(...args) { return load("roadblockHud")(...args); }
    static loadResult(...args) { return load("roadblockResult")(...args); }
  }
  class RoadblockOverlay { static load(...args) { return load("roadblockOverlay")(...args); } }
  class Result { static load(...args) { return load("result")(...args); } }
  class Banner { static load(...args) { return load("banner")(...args); } }
  class Presenter {
    constructor(...args) { log.push(["presenter", args.length]); }
    async prepareRoadBlockFlag() { log.push(["prepare", "flag"]); }
    async prepareGiant() {
      log.push(["prepare", "giant"]);
      if (failAt === "prepareGiant") throw new Error("fail:prepareGiant");
    }
    async prepareRoadBlockResult() { log.push(["prepare", "result"]); }
    async prepareFlyingPet() { log.push(["prepare", "pet"]); }
    async prepareTrackEvents() { log.push(["prepare", "events"]); }
    warm(_renderer, now) { log.push(["warm", now]); }
    dispose() { log.push(["dispose", "presenter"]); }
  }
  class Chat { static load(...args) { return load("chat")(...args); } }
  class Session {
    constructor(_driver, _presenter, callbacks, _chat, _overlay) {
      this.callbacks = callbacks;
      log.push(["session"]);
    }
  }
  class Binding {}
  const findKart = (garage, id, serial) => {
    log.push(["kart", garage, id, serial]); return "kart";
  };
  const bannerKind = (_kart, grade, mode, speed) => {
    log.push(["bannerKind", grade, mode, speed]);
    return roadblock ? undefined : "banner";
  };
  const dependencies = {
    createToonStageBinding: () => new Binding(), loadRaceAssets, loadCharacterAnimations,
    createNetworkDriver: (...args) => new NetworkDriver(...args),
    loadTimeGap: (...args) => TimeGap.load(...args),
    loadCountdownAudio: (...args) => Countdown.load(...args),
    loadRoadblockFlag: (...args) => Flag.load(...args),
    loadTrackCard: (...args) => TrackCard.load(...args),
    loadRoadblockHud: (...args) => RoadblockResult.loadHud(...args),
    loadRoadblockResult: (...args) => RoadblockResult.loadResult(...args),
    loadRoadblockOverlay: (...args) => RoadblockOverlay.load(...args),
    loadRaceResult: (...args) => Result.load(...args),
    findKart, bannerKind, loadBanner: (...args) => Banner.load(...args),
    createPresenter: (...args) => new Presenter(...args),
    loadRaceChat: (...args) => Chat.load(...args),
    createSession: (...args) => new Session(...args),
    now: () => 1234,
  };
  const Original = new Function(
    "ha", "A40", "hI", "Ui0", "Dw", "Q6", "tw", "M7", "Bo", "Gw", "Tw",
    "p5", "uP", "x7", "jr0", "Dv", "Yr0", "performance",
    `${originalSource}\nreturn Hs0;`,
  )(Binding, loadRaceAssets, loadCharacterAnimations, NetworkDriver, TimeGap,
    Countdown, Flag, TrackCard, RoadblockResult, RoadblockOverlay, Result,
    findKart, bannerKind, Banner, Presenter, Chat, Session, { now: () => 1234 });
  return { log, host, config, room, signal, connection, dependencies, Original };
}

async function exercise(rewritten, roadblock, failAt) {
  const { log, host, config, room, signal, connection, dependencies, Original } =
    fixture(roadblock, failAt);
  const loader = rewritten ? createMultiplayerRaceLoader(host, dependencies) : Original(host);
  try {
    const session = await loader.prepare(config, room, signal, connection);
    await session.callbacks.leave();
    await session.callbacks.returnToRoom();
    session.callbacks.closePresentation();
    return { result: "success", log };
  } catch (error) {
    return { result: error.message, log };
  }
}

test("multiplayer race assembly matches the release for normal and roadblock races", async () => {
  for (const roadblock of [false, true])
    assert.deepEqual(await exercise(true, roadblock), await exercise(false, roadblock));
});

test("multiplayer race failure cleanup matches the release", async () => {
  for (const failedStep of ["roadblockResult", "prepareGiant", "chat"])
    assert.deepEqual(await exercise(true, true, failedStep),
      await exercise(false, true, failedStep), failedStep);
});
