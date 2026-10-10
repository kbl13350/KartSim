import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { LobbyAvatarPreviews, type LobbyAvatarPreviewDependencies } from
  "./lobby-avatar-previews";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Tl0 {");
const end = release.indexOf("\nclass dy {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Variant = "normal" | "rp" | "system-kart" | "missing-kart" |
  "missing-character" | "preview-error" | "environment-error" |
  "pending-dispose";

async function observe(rewritten: boolean, variant: Variant) {
  const events: unknown[][] = [];
  let releaseEnvironment: ((value: { dispose(): void }) => void) | undefined;
  const environment = { dispose() { events.push(["environment-dispose"]); } };
  const environmentPromise = variant === "pending-dispose"
    ? new Promise<typeof environment>(resolve => { releaseEnvironment = resolve; })
    : variant === "environment-error"
      ? Promise.reject<typeof environment>(new Error("environment failed"))
      : Promise.resolve(environment);
  const binding = { beginFrame(nowMs: number) { events.push(["begin-frame", nowMs]); },
    dispose() { events.push(["binding-dispose"]); } };
  const sound = { play(path: string, name: string) {
    events.push(["emotion-sound", path, name]); },
  dispose() { events.push(["emotion-dispose"]); } };
  const kart = { itemId: 10, systemKey: "system", engineGrade: "S",
    linkCharacterId: 2, alwaysLinkCharacter: true };
  const library = { async timeAttackGarageCatalog() {
    events.push(["catalog"]);
    return { karts: variant === "missing-kart" ? [] : [kart],
      characters: variant === "missing-character" ? [] :
        [{ itemId: 20, path: "character_/dao/model.1s" }] };
  } };
  const preview = { scene: { matrixWorldAutoUpdate: true }, reverse: false,
    roomMotion: { request(action: number) { events.push(["motion", action]); } },
    kart: { animation: { updateCurrentState(nowMs: number) {
      events.push(["kart-state", nowMs]); } } },
    flyingPet: { update(nowMs: number, camera: unknown,
      width: number, height: number) {
      events.push(["pet", nowMs, camera, width, height]);
    } },
    decorations: [{ scene: { update(nowMs: number, camera: unknown,
      width: number, height: number) {
      events.push(["decoration", nowMs, camera, width, height]);
    } } }],
  };
  const member = { playerId: "self", name: "玩家", initial: "blue",
    equipment: { itemIds: { 1: 20, 3: 10 }, systemKart: "system",
      systemKartVariant: variant === "system-kart" ? "variant-a" : undefined } };
  let slotValue: unknown;
  const SlotsStub = class {
    constructor(_build: unknown, _release: unknown,
      _changed: unknown, _failed: unknown) { events.push(["slots-created"]); }
    update(room: { members: Array<{ equipment: unknown }> }) {
      events.push(["slots-update", room.members.map(item => item.equipment)]);
    }
    get(id: string) { events.push(["slots-get", id]); return slotValue; }
    dispose() { events.push(["slots-dispose"]); }
  };
  class SlotsFactory extends SlotsStub {
    constructor(build: unknown, release: unknown, changed: unknown,
      failed: unknown) {
      events.push(["slots-callbacks", typeof changed, typeof failed]);
      super(build, release, changed, failed);
    }
  }
  const renderer = { outputColorSpace: undefined as unknown,
    setClearColor(color: number, alpha: number) {
      events.push(["clear", color, alpha]);
    },
    setSize(width: number, height: number, updateStyle: boolean) {
      events.push(["size", width, height, updateStyle]);
    },
    dispose() { events.push(["renderer-dispose"]); },
  };
  class PartsStub {
    readonly part = true;
    constructor() { events.push(["parts"]); }
  }
  const deps = {
    createBinding() { events.push(["binding-created"]); return binding; },
    createEmotionAudio(_library: unknown, _context: unknown, _failed: unknown) {
      events.push(["emotion-created", _library === library]); return sound;
    },
    loadEnvironment(_library: unknown) {
      events.push(["environment-load", _library === library]);
      return environmentPromise;
    },
    createSlots(_build: unknown, _release: unknown,
      changed: unknown, failed: unknown) {
      events.push(["slots-callbacks", typeof changed, typeof failed]);
      return new SlotsStub(_build, _release, changed, failed);
    },
    disposePreview(_preview: unknown) {
      events.push(["preview-dispose", _preview === preview]);
    },
    gameplayMode(room: { mode?: string }) {
      events.push(["mode", room.mode]); return room.mode ?? "ordinary";
    },
    rpEquipment(equipment: { itemIds: Record<number, number> },
      replacement: { kartId: number; flyingPetId: number }) {
      events.push(["rp-equipment", replacement]);
      return { ...equipment, itemIds: { ...equipment.itemIds, 3: replacement.kartId } };
    },
    systemKart(karts: unknown[], itemId: number, path: string,
      key: unknown) {
      events.push(["system-kart", karts.length, itemId, path, key]);
      return { ...kart, itemId: 0 };
    },
    async loadAppearance(_library: unknown, equipment: unknown,
      team: unknown, grade: unknown, initial: string | undefined) {
      events.push(["appearance", _library === library,
        equipment === member.equipment, team, grade, initial]);
      return { appearance: true };
    },
    async loadPreview(_library: unknown, item: unknown, character: unknown,
      env: unknown, frame: unknown, parts: unknown, mode: "ready",
      appearance: unknown, optional: undefined, lobby: true) {
      events.push(["preview", _library === library, item, character,
        env === environment, frame === binding, parts instanceof PartsStub, mode,
        appearance, optional, lobby]);
      if (variant === "preview-error") throw new Error("preview failed");
      return preview;
    },
    createParts() { return new PartsStub(); },
    createCamera(team: unknown, reverse: boolean, linked?: number,
      always?: boolean, itemId?: number) {
      events.push(["camera", team, reverse, linked, always, itemId]);
      return { camera: true };
    },
    createRenderer(options: { alpha: true; preserveDrawingBuffer: true }) {
      events.push(["renderer", options]); return renderer;
    },
    outputColorSpace: "srgb",
    updatePreview(_preview: unknown, nowMs: number, camera: unknown,
      width: number, height: number) {
      events.push(["update-preview", _preview === preview, nowMs,
        camera, width, height]);
    },
    drawPreview(_renderer: unknown, canvas: unknown, rect: unknown,
      render: () => void) {
      events.push(["draw-preview", _renderer === renderer, canvas, rect]);
      render();
    },
    renderScene(_renderer: unknown, scene: unknown, camera: unknown) {
      events.push(["render-scene", _renderer === renderer,
        scene === preview.scene, camera]);
    },
  } as unknown as LobbyAvatarPreviewDependencies;
  const Original = new Function("ha", "xl0", "rn", "El0", "Lt", "G2",
    "wI", "b4", "Sl0", "Jv", "Tr", "Ml0", "I4", "qe", "T4", "NP",
    "f4", `${originalClass}\nreturn Tl0;`)(
      class { constructor() { return deps.createBinding(); } },
      class { constructor(lib: unknown, context: unknown, failed: unknown) {
        return deps.createEmotionAudio(lib as never, context, failed as never);
      } },
      { load: deps.loadEnvironment }, SlotsFactory,
      deps.disposePreview,
      deps.gameplayMode, deps.rpEquipment, deps.systemKart,
      deps.loadAppearance, deps.loadPreview,
      PartsStub,
      deps.createCamera,
      class { constructor(options: { alpha: true; preserveDrawingBuffer: true }) {
        return deps.createRenderer(options);
      } },
      deps.outputColorSpace, deps.updatePreview, deps.drawPreview,
      deps.renderScene,
    ) as unknown as new (library: unknown, changed: () => void,
      failed: (error: unknown) => void, emotions: unknown[],
      audioContext: unknown) => LobbyAvatarPreviews;
  const changed = () => events.push(["changed"]);
  const failed = (error: unknown) => events.push(["failed", (error as Error).message]);
  const emotions = [{ index: 7, soundName: "wave" }];
  const controller = rewritten
    ? new LobbyAvatarPreviews(library, changed, failed, emotions, {}, deps)
    : new Original(library, changed, failed, emotions, {});
  controller.play("removed", 9);
  controller.update({ mode: variant === "rp" ? "rp" : "ordinary",
    members: [member] });
  let built: Awaited<ReturnType<LobbyAvatarPreviews["build"]>> | undefined;
  let error: string | undefined;
  const building = controller.build(member, "red");
  if (variant === "pending-dispose") {
    controller.dispose();
    releaseEnvironment?.(environment);
  }
  try { built = await building; }
  catch (failure) { error = (failure as Error).message; }
  if (built && variant !== "pending-dispose") {
    slotValue = built;
    controller.play("self", 7);
    controller.paint("absent", {}, {}, 123);
    controller.paint("self", "canvas", "rect", 123);
    controller.paint("self", "canvas", "rect", 124);
  }
  if (variant !== "pending-dispose") controller.dispose();
  controller.paint("self", "canvas", "rect", 125);
  await new Promise<void>(resolve => setImmediate(resolve));
  return { events, error, built: built && {
    characterPath: built.characterPath, camera: built.camera,
    matrixWorldAutoUpdate: built.preview.scene.matrixWorldAutoUpdate,
  }, pending: controller.pending, disposed: controller.disposed,
    released: controller.released, pendingActions: [...controller.pendingActions] };
}

test("lobby avatar roster, preview construction, emotion and teardown match release", async () => {
  for (const variant of ["normal", "rp", "system-kart", "missing-kart",
    "missing-character", "preview-error", "environment-error",
    "pending-dispose"] as const) {
    assert.deepEqual(await observe(true, variant),
      await observe(false, variant), variant);
  }
});
