import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { LobbyCountdownMedia, type CountdownSceneNode,
  type LobbyCountdownDependencies } from "./lobby-countdown-media";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class dy {");
const end = release.indexOf("\nclass fy {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Variant = "normal" | "missing-scene" | "missing-alpha" |
  "missing-image" | "missing-sound" | "scene-error" |
  "decode-error" | "sound-bytes-error" | "audio-error";

async function observe(rewritten: boolean, variant: Variant) {
  const events: unknown[][] = [];
  let canvasIndex = 0;
  const sceneRoot: CountdownSceneNode = { kind: "node", name: "root",
    children: Array.from({ length: 9 }, (_, index) => {
      const digit = index + 1;
      return { kind: "node", name: String(digit), children: [{
        name: `${digit}_Geom`, slots: [{ kind: "texture",
          alphaController: variant === "missing-alpha" && digit === 9
            ? undefined : { digit } }],
      }] };
    }),
  };
  const paths = new Map<string, Uint8Array>();
  if (variant !== "missing-scene") {
    paths.set("stage_/mqReady/대기실카운트.1s", new Uint8Array([11]));
  }
  for (let digit = 1; digit <= 9; digit++) {
    if (variant !== "missing-image" || digit !== 4) {
      paths.set(`stage_/mqReady/${digit}.png`, new Uint8Array([digit]));
    }
  }
  if (variant !== "missing-sound") {
    paths.set("sound_/fx/interface/waitingroom_countdown.ogg",
      new Uint8Array([55]));
  }
  const library = {
    get(path: string) {
      events.push(["get", path]);
      const bytes = paths.get(path);
      if (!bytes) return undefined;
      return { async bytes() {
        events.push(["bytes", path]);
        if (variant === "scene-error" && path.endsWith(".1s")) {
          throw new Error("scene failed");
        }
        if (variant === "sound-bytes-error" && path.endsWith(".ogg")) {
          throw new Error("sound failed");
        }
        return bytes;
      } };
    },
  };
  const ImageDataStub = class {
    constructor(readonly pixels: Uint8ClampedArray,
      readonly width: number, readonly height: number) {}
  };
  const documentStub = {
    createElement(kind: string) {
      events.push(["element", kind]);
      const id = ++canvasIndex;
      return { id, width: 0, height: 0,
        getContext(contextKind: string) {
          events.push(["context", id, contextKind]);
          return { putImageData(image: InstanceType<typeof ImageDataStub>,
            x: number, y: number) {
            events.push(["pixels", id, image.width, image.height,
              [...image.pixels], x, y]);
          } };
        },
      };
    },
  };
  const AudioStub = class {
    currentTime = 5;
    constructor(readonly url: string) {
      events.push(["audio", url]);
      if (variant === "audio-error") throw new Error("audio failed");
    }
    play() { events.push(["play", this.currentTime]);
      return Promise.reject(new Error("play unavailable")); }
    pause() { events.push(["pause"]); }
  };
  const BlobStub = class {
    constructor(readonly parts: Uint8Array[], readonly options: { type: string }) {}
  };
  const urlStub = {
    createObjectURL(blob: InstanceType<typeof BlobStub>) {
      events.push(["object-url", blob.options.type, [...blob.parts[0]!]]);
      return "blob:countdown";
    },
    revokeObjectURL(url: string) { events.push(["revoke", url]); },
  };
  const sceneParser = (bytes: Uint8Array) => {
    events.push(["scene", [...bytes]]); return { root: sceneRoot };
  };
  const decoder = async (bytes: Uint8Array) => {
    events.push(["decode", [...bytes]]);
    if (variant === "decode-error" && bytes[0] === 3) {
      throw new Error("decode failed");
    }
    return { width: 2, height: 1,
      pixels: new Uint8Array([bytes[0]!, 0, 0, 255, 0, 0, 0, 255]) };
  };
  const alphaFromParsed = (controller: unknown) => {
    const digit = (controller as { digit: number }).digit;
    events.push(["alpha", digit]);
    return { update(frame: number) {
      events.push(["update", digit, frame]);
      return digit % 3 === 0 ? 0 : digit % 3 === 1 ? 0.4 : 1.8;
    }, reset(frame: number) { events.push(["reset", digit, frame]); } };
  };
  const deps = {
    parseScene: sceneParser,
    decodeImage: decoder,
    createCanvas(image: { width: number; height: number; pixels: Uint8Array }) {
      const canvas = documentStub.createElement("canvas");
      canvas.width = image.width; canvas.height = image.height;
      canvas.getContext("2d").putImageData(new ImageDataStub(
        new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0);
      return canvas;
    },
    alphaFromParsed,
    createSoundUrl(bytes: Uint8Array) {
      return urlStub.createObjectURL(new BlobStub([bytes], { type: "audio/ogg" }));
    },
    createAudio: (url: string) => new AudioStub(url),
    revokeSoundUrl: (url: string) => urlStub.revokeObjectURL(url),
  } satisfies LobbyCountdownDependencies;
  const Original = new Function("y9", "p2", "document", "ImageData", "on",
    "Audio", "URL", "Blob", `${originalClass}\nreturn dy;`)(
      sceneParser, decoder, documentStub, ImageDataStub,
      { fromParsed: alphaFromParsed }, AudioStub, urlStub, BlobStub,
    ) as unknown as { load(library: unknown): Promise<LobbyCountdownMedia> };
  let media: LobbyCountdownMedia | undefined;
  let error: string | undefined;
  try {
    media = rewritten
      ? await LobbyCountdownMedia.load(library, deps)
      : await Original.load(library);
  } catch (failure) { error = (failure as Error).message; }
  if (media) {
    const context = { globalAlpha: 1,
      save() { events.push(["save"]); },
      drawImage(image: { width: number; height: number; id?: number }, x: number, y: number,
        width: number, height: number) {
        events.push(["draw", image.id, x, y, width, height, this.globalAlpha]);
      },
      restore() { events.push(["restore"]); },
    };
    for (const elapsed of [-5, 0, 23.9, 15000]) {
      media.paint(context, { x: 1, y: 2, width: 40, height: 50 }, elapsed);
    }
    media.reset();
    media.playTick();
    await Promise.resolve();
    media.dispose();
  }
  return { events, error, media: media && {
    digitCount: media.digits.length, soundUrl: media.soundUrl,
    currentTime: media.sound.currentTime,
  } };
}

test("lobby countdown resource validation, decoding and cleanup match release", async () => {
  for (const variant of ["normal", "missing-scene", "missing-alpha",
    "missing-image", "missing-sound", "scene-error", "decode-error",
    "sound-bytes-error", "audio-error"] as const) {
    assert.deepEqual(await observe(true, variant),
      await observe(false, variant), variant);
  }
});
