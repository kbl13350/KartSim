import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { InterfaceAudio, INTERFACE_AUDIO_PATHS } from
  "../src/timeattack/interface-audio.ts";

const release = readFileSync(
  new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const nodes = parse(release, { sourceType: "module" }).program.body;
function source(name) {
  const node = nodes.find(item => item.id?.name === name);
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}

async function run(readable, hoverAvailable) {
  const events = [];
  let sourceId = 0;
  const context = {
    createBufferSource() {
      const id = ++sourceId;
      events.push(["source", id]);
      return {
        buffer: undefined,
        onended: null,
        start() { events.push(["start", id, this.buffer]); },
        stop() { events.push(["stop", id]); },
        disconnect() { events.push(["disconnect", id]); },
      };
    },
  };
  const library = {
    exactCanonicalCandidates(path) {
      events.push(["lookup", path]);
      if (path === INTERFACE_AUDIO_PATHS.hover && !hoverAvailable) return [];
      return [{ bytes: async () => new TextEncoder().encode(path) }];
    },
  };
  const decode = async (ctx, bytes) => {
    const path = new TextDecoder().decode(bytes);
    events.push(["decode", path]);
    return path;
  };
  const route = (ctx, source) => events.push(["route", sourceId]);
  const Original = new Function("Q9", "S9", "xf0", "Cf0", "Ef0",
    "Sf0", `${source("Kf")}\n${source("Tf0")}\n${source("Ny")}; return Ny;`)(
      decode, route, INTERFACE_AUDIO_PATHS.click,
      INTERFACE_AUDIO_PATHS.hover, INTERFACE_AUDIO_PATHS.slotChanger,
      INTERFACE_AUDIO_PATHS.start);
  const audio = readable
    ? await InterfaceAudio.load(library, context, { decode, route },
      (click, hover, slotChanger, start) =>
        new InterfaceAudio(context, click, hover, slotChanger, start,
          { decode, route }))
    : await Original.load(library, context);
  audio.playStart(); audio.playStart();
  audio.playClick(); audio.playClick();
  audio.playHover(); audio.playHover();
  audio.playSlotChanger(); audio.playSlotChanger();
  audio.activeStart.onended();
  audio.playStart();
  audio.dispose();
  return {
    events,
    active: [audio.activeStart, audio.activeClick,
      audio.activeHover, audio.activeSlotChanger],
  };
}

test("interface sound loading, one-shot playback, and disposal match release", async () => {
  assert.deepEqual(await run(true, true), await run(false, true));
  assert.deepEqual(await run(true, false), await run(false, false));
});
