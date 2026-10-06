import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Group, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";

import { DrivingAction } from "../input/driving-input";
import { AwardPodiumScene, loadAwardPodiumScene,
  type AwardAsset, type AwardPodiumDependencies,
  type AwardSlot } from "./award-podium-scene";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseAward(dependencies: {
  distance: AwardPodiumDependencies["makeDistanceController"];
  parse?: (bytes: Uint8Array) => unknown;
  scene?: (parsed: unknown, library: unknown, label: string,
    texture: unknown, options: unknown) => Promise<AwardAsset>;
}) {
  const source = await readFile(releaseFile, "utf8");
  const start = source.indexOf("class tw {");
  const end = source.indexOf("\nfunction ", start);
  const rankStart = source.indexOf("function rG(");
  const rankEnd = source.indexOf("\nconst l2", rankStart);
  assert.ok(start >= 0 && end > start && rankStart >= 0 && rankEnd > rankStart);
  return new Function("T2", "H", "v2", "s5", "on", "l2", "we", "z6", "y9",
    "W1", "sn", `${source.slice(rankStart, rankEnd)}
    ${source.slice(start, end)}
    return tw;`)(Group, Vector3, Matrix4, Quaternion,
    { fromParsed: dependencies.distance }, DrivingAction,
    (fov: number, aspect: number) => fov / aspect,
    () => ({ base: 70 }), dependencies.parse,
    dependencies.scene, () => "texture") as {
    new (render: AwardAsset, slots: AwardSlot[], confetti: AwardAsset,
      mode: string): AwardPodiumScene;
    load(library: unknown, options: unknown): Promise<AwardPodiumScene>;
  };
}

function slot(name: string, x = 0): AwardSlot {
  return { name, kind: "node", children: [], position: [x, 0, 0],
    transform: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], scale: [1, 1, 1] };
}

function fixture() {
  const events: unknown[][] = [];
  const asset = (name: string): AwardAsset => ({
    object: new Group(),
    reset: time => events.push([name, "reset", time]),
    update: (time, _camera, width, height) =>
      events.push([name, "update", time, width, height]),
    dispose: () => events.push([name, "dispose"]),
  });
  const distance: AwardPodiumDependencies["makeDistanceController"] = parsed => {
    events.push(["distance", "create", parsed]);
    return { reset: time => events.push(["distance", "reset", time]),
      update: time => { events.push(["distance", "update", time]); return 14; } };
  };
  const deps: AwardPodiumDependencies = { makeDistanceController: distance,
    baseFov: () => 70, horizontalFov: (fov, aspect) => fov / aspect };
  const slots = [slot("first", 1), slot("second", 2), slot("third", 3)];
  const stage = { startPose: { right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: 1 },
    position: { x: 4, y: 5, z: 6 } },
  track: { rayQuery: (_position: unknown, _direction: unknown, _backface: boolean) =>
    ({ point: { x: 10, y: 20, z: 30 } }) } };
  const character = { award: { enter: () => events.push(["award", "enter"]),
    request: (motion: number) => events.push(["award", "request", motion]) },
  scene: { update: (time: number) => events.push(["character", "update", time]) } };
  const player = { playerId: "p1", characters: { ordinary: character },
    vehicle: { imported: { renderScene: { update: () => events.push(["kart", "update"]) } },
      accessories: [{ render: { scene: { update: () => events.push(["accessory", "update"]) } } }],
      decoration: { scene: { update: () => events.push(["decoration", "update"]) } } } };
  const race = { participants: [player] };
  const sent: number[] = [];
  let subscriber: ((event: { playerId: string; motion: number }) => void) | undefined;
  const connection = { playerId: "p1",
    subscribeAwardMotion: (listener: typeof subscriber) => {
      subscriber = listener;
      return () => events.push(["unsubscribe"]);
    },
    sendAwardMotion: async (motion: number) => { sent.push(motion); },
  };
  const results = [{ playerId: "p1", rank: 1, elapsedMs: 1000 },
    { playerId: "p2", rank: 2, elapsedMs: 1100 }];
  const racers = new Map([["p1", { root: { visible: false } }],
    ["p2", { root: { visible: false } }]]);
  const room = { roster: [{ playerId: "p1", team: 1 },
    { playerId: "p2", team: 2 }], winningTeam: 1 };
  const camera = new PerspectiveCamera(60, 4 / 3, 0.1, 1000);
  const visuals = new Map([["p1", { root: { updateMatrixWorld: () =>
    events.push(["visual", "matrix"]) },
  updatePose: (pose: unknown) => events.push(["visual", "pose", pose]) }]]);
  return { events, asset, distance, deps, slots, stage, race, connection,
    sent, subscriber: () => subscriber, results, racers, room, camera, visuals };
}

function sceneSnapshot(scene: AwardPodiumScene, camera: PerspectiveCamera,
  events: unknown[][], sent: number[]) {
  return { active: scene.active, disposed: scene.disposed,
    winners: [...scene.winners].map(([name, chosen]) => [name, chosen.name]),
    rootPosition: scene.root.position.toArray(),
    rootQuaternion: scene.root.quaternion.toArray(),
    effectPosition: scene.effectRoot.position.toArray(),
    effectQuaternion: scene.effectRoot.quaternion.toArray(),
    cameraTarget: scene.cameraTarget.toArray(),
    cameraPosition: camera.position.toArray(),
    cameraQuaternion: camera.quaternion.toArray(),
    cameraFov: camera.fov, cameraNear: camera.near, cameraFar: camera.far,
    events, sent };
}

test("颁奖台站位、动作输入、角色动画、镜头和清理与发行版一致", async () => {
  const oldCase = fixture(), newCase = fixture();
  const Original = await releaseAward({ distance: oldCase.distance });
  const old = new Original(oldCase.asset("stand"), oldCase.slots,
    oldCase.asset("confetti"), "individual");
  const current = new AwardPodiumScene(newCase.asset("stand"), newCase.slots,
    newCase.asset("confetti"), "individual", newCase.deps);
  assert.deepEqual(oldCase.events, newCase.events, "distance definition");
  for (const [scene, data] of [[old, oldCase], [current, newCase]] as const) {
    scene.bind(data.connection, data.race);
    scene.show(1000, data.stage, data.results, data.racers, data.room);
    scene.request("p1", 7);
    data.subscriber()?.({ playerId: "p1", motion: 8 });
    scene.input([{ action: DrivingAction.Forward, down: true },
      { action: DrivingAction.SteerLeft, down: true },
      { action: DrivingAction.SteerRight, down: false }], true);
    scene.update(1016, data.camera, data.stage, data.race, data.visuals);
  }
  assert.deepEqual(sceneSnapshot(current, newCase.camera, newCase.events, newCase.sent),
    sceneSnapshot(old, oldCase.camera, oldCase.events, oldCase.sent));
  assert.deepEqual([...newCase.racers].map(([id, racer]) => [id, racer.root.visible]),
    [...oldCase.racers].map(([id, racer]) => [id, racer.root.visible]));
  old.dispose(); current.dispose();
  assert.deepEqual(sceneSnapshot(current, newCase.camera, newCase.events, newCase.sent),
    sceneSnapshot(old, oldCase.camera, oldCase.events, oldCase.sent));
});

test("颁奖资源选择、颁奖台节点检查和失败清理与发行版一致", async () => {
  for (const failure of ["none", "missing-stand", "missing-slot", "missing-confetti", "scene-error"]) {
    const run = async (release: boolean) => {
      const data = fixture();
      const calls: unknown[][] = [];
      const root = slot("root");
      root.children = [slot("first"), slot("second"), slot("third")];
      if (failure === "missing-slot") root.children.pop();
      const library = { exactCanonicalCandidates: (name: string) => {
        calls.push(["find", name]);
        if (failure === "missing-stand" && name.includes("stand")) return [];
        if (failure === "missing-confetti" && name.includes("effect")) return [];
        return [{ bytes: async () => new Uint8Array([name.includes("stand") ? 1 : 2]) }];
      } };
      const parse = (bytes: Uint8Array) => ({ root: bytes[0] === 1 ? root : slot("effect") });
      const scene = async (_parsed: unknown, _lib: unknown, label: string) => {
        calls.push(["scene", label]);
        if (failure === "scene-error" && label === "MultiplayerConfetti")
          throw new Error("scene failed");
        const asset = data.asset(label);
        return asset;
      };
      const options = { mode: "individual", map: { environment: {}, stageBinding: {} } };
      try {
        const loaded = release
          ? await (await releaseAward({ distance: data.distance, parse, scene })).load(library, options)
          : await loadAwardPodiumScene(library, options,
            { parseModel: parse, loadScene: scene,
              resolveTexture: () => "texture" },
          (stand, slots, confetti, mode) => new AwardPodiumScene(
            stand, slots, confetti, mode, data.deps));
        return { error: undefined, calls, events: data.events,
          slots: loaded.slots.map(item => item.name), mode: loaded.mode };
      } catch (error) {
        return { error: String(error), calls, events: data.events };
      }
    };
    assert.deepEqual(await run(false), await run(true), failure);
  }
});
