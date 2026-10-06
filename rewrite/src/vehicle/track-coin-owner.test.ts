import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TrackCoinOwner, type CoinAudioSource, type CoinOwnerOps, type CoinOwnerSource, type CoinSceneObject } from "./track-coin-owner";
import { uniqueOriginalCoinAsset } from "./track-coin-source";
import type { CoinPosition, CoinView } from "./track-coin";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class jw {");
const end = release.indexOf("function nl(n, e) {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

const coinSource: CoinOwnerSource = {
  resources: { radius: 2, stayModel: "stay.1s", eatenModel: "eaten.1s", eatenLifeMs: 400, waitLifeMs: 800, audioStem: "cash" },
  coins: [
    { name: "gold-1", ordinal: 2, position: { x: 1, y: 2, z: 3 } },
    { name: "gold-2", ordinal: 3, position: { x: -2, y: 0, z: 8 } },
  ],
};

function harness(failAt?: number) {
  const events: string[] = [];
  let sceneId = 0, modelCount = 0;
  class Scene implements CoinSceneObject {
    id = ++sceneId;
    visible = true;
    rotation = { y: 0 };
    position = { copy: (position: CoinPosition) => { events.push(`scene${this.id}.position=${Object.values(position)}`); } };
    add(...objects: Scene[]) { events.push(`scene${this.id}.add=${objects.map(object => object.id)}`); }
    removeFromParent() { events.push(`scene${this.id}.remove`); }
  }
  class Model {
    object = new Scene();
    constructor(public name: string) {}
    reset(time: number) { events.push(`${this.name}.reset=${time}`); }
    playControllers(time: number, elapsed: number) { events.push(`${this.name}.play=${time},${elapsed}`); }
    update(...args: unknown[]) { events.push(`${this.name}.update=${args.join(",")}`); }
    dispose() { events.push(`${this.name}.dispose`); }
  }
  class AudioSource implements CoinAudioSource {
    buffer: unknown;
    onended: (() => void) | null = null;
    start() { events.push("audio.start"); }
    stop() { events.push("audio.stop"); }
    disconnect() { events.push("audio.disconnect"); }
  }
  const context = { createBufferSource: () => new AudioSource() };
  const archive = {
    exactCanonicalCandidates: (path: string) => [{ absenceAuthoritative: true, bytes: async () => {
      events.push(`bytes=${path}`);
      return path;
    } }],
  };
  const decodeModel = (bytes: unknown) => { events.push(`decode=${bytes}`); return String(bytes); };
  const decodeAudio = (_context: typeof context, bytes: unknown) => { events.push(`audio.decode=${bytes}`); return `audio:${bytes}`; };
  const loadModel = async (data: string, _archive: typeof archive, path: string,
    _identity: { id: "lucci" }, _options: unknown) => {
    modelCount += 1;
    events.push(`model.load=${data},${path}`);
    if (modelCount === failAt) throw Error(`model failure ${failAt}`);
    return new Model(`${path}#${modelCount}`);
  };
  const contacts: Array<{ name: string; view: CoinView; kartPeer: (peer: unknown) => boolean }> = [];
  class Contact {
    constructor(
      public name: string, _position: CoinPosition, _resources: unknown,
      public view: CoinView, public kartPeer: (peer: unknown) => boolean,
      _kartPosition: () => CoinPosition, _canCollect: () => boolean,
    ) { contacts.push({ name, view, kartPeer }); }
  }
  const routeAudio = (_context: typeof context, _source: CoinAudioSource, group: "fx") => { events.push(`audio.route=${group}`); };
  const original = new Function("T2", "nl", "y9", "Q9", "c5", "y10", "S9",
    `${originalClass}return jw;`,
  )(Scene, uniqueOriginalCoinAsset, decodeModel, decodeAudio, loadModel, Contact, routeAudio) as {
    load(archiveArg: typeof archive, source: CoinOwnerSource, environment: unknown, stage: unknown, audioContext: typeof context): Promise<TrackCoinOwner<typeof archive, string>>;
  };
  const ops: CoinOwnerOps<typeof archive, string> = {
    createObject: () => new Scene(),
    originalAsset: uniqueOriginalCoinAsset,
    decodeModel, decodeAudio, loadModel,
    createContact: (...args) => new Contact(...args),
    routeAudio,
  };
  return { events, context, archive, contacts, original, ops };
}

async function run(useOriginal: boolean, failAt?: number) {
  const h = harness(failAt);
  let owner: TrackCoinOwner<typeof h.archive, string>;
  try {
    owner = useOriginal
      ? await h.original.load(h.archive, coinSource, "environment", "stage", h.context)
      : await TrackCoinOwner.load(h.archive, coinSource, "environment", "stage", h.context, h.ops);
  } catch (error) {
    return { error: (error as Error).message, events: h.events };
  }
  const keys = Object.keys(owner);
  const world = {
    queueKartPairObject: (_contact: unknown) => { h.events.push("contact.queued"); },
    isKartPeer: (peer: unknown) => peer === "kart",
  };
  owner.attach(world, () => ({ x: 4, y: 5, z: 6 }), () => true);
  h.contacts[0]!.view.stay(0.6);
  h.contacts[0]!.view.eaten({ x: 9, y: 8, z: 7 }, 123);
  h.contacts[0]!.view.eaten({ x: 5, y: 4, z: 3 }, 124);
  h.contacts[1]!.view.hide();
  owner.update(125, 16, "frame", "options");
  const peerResult = h.contacts[0]!.kartPeer("kart");
  let attachError = "";
  try { owner.attach(world, () => ({ x: 0, y: 0, z: 0 }), () => true); }
  catch (error) { attachError = (error as Error).message; }
  owner.dispose();
  owner.dispose();
  return {
    keys, peerResult, attachError,
    state: {
      attached: owner.attached, disposed: owner.disposed, viewCount: owner.views.length,
      sourceCount: owner.sources.size, textureCount: owner.textures.size,
    },
    events: h.events,
  };
}

test("coin owner load, contact view, audio and disposal match release", async () => {
  assert.deepEqual(await run(false), await run(true));
});

test("coin owner cleans up partial model loads like release", async () => {
  for (const failAt of [1, 2, 3, 4]) {
    assert.deepEqual(await run(false, failAt), await run(true, failAt), `failed model ${failAt}`);
  }
});

test("coin owner sound completion and post-dispose guards match release", async () => {
  async function trace(useOriginal: boolean) {
    const h = harness();
    const owner = useOriginal
      ? await h.original.load(h.archive, coinSource, "environment", "stage", h.context)
      : await TrackCoinOwner.load(h.archive, coinSource, "environment", "stage", h.context, h.ops);
    owner.play();
    const source = [...owner.sources][0]!;
    source.onended?.();
    owner.dispose();
    owner.update(90, 16, null, null);
    let error = "";
    try { owner.attach({ queueKartPairObject() {}, isKartPeer: () => true }, () => ({ x: 0, y: 0, z: 0 }), () => true); }
    catch (caught) { error = (caught as Error).message; }
    return { error, sourceCount: owner.sources.size, events: h.events };
  }
  assert.deepEqual(await trace(false), await trace(true));
});
