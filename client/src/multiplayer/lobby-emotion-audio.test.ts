import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { LobbyEmotionAudio, type LobbyEmotionAudioDependencies } from "./lobby-emotion-audio";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class xl0 {");
const end = release.indexOf("\nasync function Sl0(", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Variant = "normal" | "duplicate" | "invalid-path" | "invalid-sound" |
  "missing-entry" | "bytes-error" | "decode-error" | "resume-error" |
  "route-error" | "start-error" | "disposed-before" |
  "disposed-during-load" | "no-context" | "ended" | "stop-error";

async function observe(rewritten: boolean, variant: Variant) {
  const events: unknown[][] = [];
  const voices: Array<{ ended?: () => void }> = [];
  const library = { get(path: string) {
    events.push(["get", path]);
    if (variant === "missing-entry") return undefined;
    return { async bytes() {
      events.push(["bytes", path]);
      if (variant === "bytes-error") throw new Error("bytes failed");
      return new Uint8Array([1, 2, 3]);
    } };
  } };
  const context = { state: variant === "resume-error" ? "suspended" : "running",
    async resume() { events.push(["resume"]);
      if (variant === "resume-error") throw new Error("resume failed"); },
    createBufferSource() {
      const id = voices.length + 1;
      events.push(["source", id]);
      const voice = { buffer: undefined as unknown, ended: undefined as (() => void) | undefined,
        addEventListener(type: string, listener: () => void, options: { once: boolean }) {
          events.push(["listener", id, type, options.once]); this.ended = listener;
        },
        start() { events.push(["start", id]);
          if (variant === "start-error") throw new Error("start failed"); },
        stop() { events.push(["stop", id]);
          if (variant === "stop-error") throw new Error("stop failed"); },
        disconnect() { events.push(["disconnect", id]); },
      };
      voices.push(voice);
      return voice;
    },
  };
  const deps = {
    async decode(_context: unknown, bytes: Uint8Array) {
      events.push(["decode", _context === context, [...bytes]]);
      if (variant === "decode-error") throw new Error("decode failed");
      return { decoded: true };
    },
    route(_context: unknown, voice: unknown, channel: "fx") {
      events.push(["route", _context === context, voices.indexOf(voice as never) + 1,
        channel]);
      if (variant === "route-error") throw new Error("route failed");
    },
  } as LobbyEmotionAudioDependencies;
  const Original = new Function("Q9", "S9", `${originalClass}\nreturn xl0;`)(
    deps.decode, deps.route) as unknown as new (
      library: unknown, context: unknown,
      failed: (error: unknown) => void) => LobbyEmotionAudio;
  const failed = (error: unknown) => events.push(["failed", (error as Error).message]);
  const instance = rewritten
    ? new LobbyEmotionAudio(library,
      variant === "no-context" ? undefined : context, failed, deps)
    : new Original(library,
      variant === "no-context" ? undefined : context, failed);
  if (variant === "disposed-before") instance.dispose();
  const characterPath = variant === "invalid-path"
    ? "vehicles/kart/model.1s" : "character_/dao/model.1s";
  const soundName = variant === "invalid-sound" ? "bad/path" : "emote";
  instance.play(characterPath, soundName);
  if (variant === "duplicate") instance.play(characterPath, soundName);
  if (variant === "disposed-during-load") instance.dispose();
  await new Promise<void>(resolve => setImmediate(resolve));
  if (variant === "ended") voices[0]?.ended?.();
  let disposeError: string | undefined;
  if (variant !== "disposed-before" && variant !== "disposed-during-load") {
    try { instance.dispose(); }
    catch (error) { disposeError = (error as Error).message; }
  }
  return { events, disposeError, disposed: instance.disposed,
    bufferCount: instance.buffers.size, activeCount: instance.active.size };
}

test("lobby emotion audio caching, playback and failure handling match release", async () => {
  for (const variant of ["normal", "duplicate", "invalid-path", "invalid-sound",
    "missing-entry", "bytes-error", "decode-error", "resume-error",
    "route-error", "start-error", "disposed-before", "disposed-during-load",
    "no-context", "ended", "stop-error"] as const) {
    assert.deepEqual(await observe(true, variant),
      await observe(false, variant), variant);
  }
});
