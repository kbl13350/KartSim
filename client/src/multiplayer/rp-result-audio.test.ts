import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { RpResultAudio, type RpResultAudioDependencies } from "./rp-result-audio";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class wy {");
const end = release.indexOf("\nfunction Vl0(", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

const sounds = {
  opening: "sound_/fx/etc/복불복 상자 사운드.ogg",
  lucky: "sound_/fx/etc/복불복 대박 사운드.ogg",
  unlucky: "sound_/fx/etc/복불복 꽝 사운드.ogg",
};

type Variant = "normal" | "no-context" | "missing" | "suspended" |
  "start-error" | "stop-error" | "ended" | "missing-buffer" |
  "disposed";

async function observe(rewritten: boolean, variant: Variant) {
  const events: unknown[][] = [];
  const source = (path: string) => ({ async bytes() {
    events.push(["bytes", path]); return Uint8Array.from([path.length]);
  } });
  const library = { get(path: string) {
    events.push(["get", path]);
    return variant === "missing" && path === sounds.lucky
      ? undefined : source(path);
  } };
  const voices: Array<{ onended: (() => void) | null }> = [];
  const context = {
    state: variant === "suspended" ? "suspended" : "running",
    async resume() { events.push(["resume"]); },
    createBufferSource() {
      events.push(["voice"]);
      const voice = {
        buffer: undefined as unknown,
        onended: null as (() => void) | null,
        start() { events.push(["start", this.buffer]);
          if (variant === "start-error") throw new Error("start failed"); },
        stop() { events.push(["stop"]);
          if (variant === "stop-error") throw new Error("stop failed"); },
        disconnect() { events.push(["disconnect"]); },
      };
      voices.push(voice);
      return voice;
    },
  };
  const dependencies: RpResultAudioDependencies = {
    async decode(_context, bytes) { events.push(["decode", [...bytes]]);
      return `decoded-${bytes[0]}`; },
    route(_context, voice, channel) {
      events.push(["route", voice.buffer, channel]);
    },
  };
  const Legacy = new Function("VT", "Q9", "S9",
    `${originalClass}\nreturn wy;`)(sounds, dependencies.decode,
    dependencies.route) as {
      load(library: unknown, context: unknown): Promise<RpResultAudio>;
    };
  class Modern extends RpResultAudio {
    constructor(audioContext: typeof context | undefined,
      buffers: Map<string, unknown>) {
      super(audioContext, buffers, dependencies);
    }
  }
  let audio: RpResultAudio | undefined;
  let error: string | undefined;
  try {
    audio = rewritten
      ? await Modern.load(library, variant === "no-context" ? undefined : context,
        dependencies)
      : await Legacy.load(library, variant === "no-context" ? undefined : context);
    if (variant === "missing-buffer") audio.buffers.clear();
    await audio.prepare();
    if (variant === "disposed") audio.dispose();
    audio.play("opening");
    if (variant === "ended") voices[0]?.onended?.();
    if (variant === "normal" || variant === "stop-error" ||
      variant === "suspended") {
      audio.play("lucky");
      audio.stop();
    }
    audio.dispose();
  } catch (failure) { error = (failure as Error).message; }
  return { events, error, audio: audio && {
    disposed: audio.disposed, buffers: [...audio.buffers],
    voices: audio.voices.size,
  } };
}

test("RP result sound loading, playback and voice cleanup match release", async () => {
  for (const variant of ["normal", "no-context", "missing", "suspended",
    "start-error", "stop-error", "ended", "missing-buffer",
    "disposed"] as const) {
    assert.deepEqual(await observe(true, variant), await observe(false, variant), variant);
  }
});
