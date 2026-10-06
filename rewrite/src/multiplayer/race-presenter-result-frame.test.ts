import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentRaceResultFrame,
  type RacePresenterResultDependencies, type RacePresenterResultHost,
} from "./race-presenter-result-frame";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class jr0 {");
const end = release.indexOf("\nclass aP {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Presenter = RacePresenterResultHost & {
  update(renderer: { getDrawingBufferSize(size: { x: number; y: number }): void },
    nowMs: number, events: Array<{ kind: string }>): void;
};

function makeFixture(rewritten: boolean, mode: {
  disposed?: boolean;
  visible?: boolean;
  publish?: boolean;
  sky?: boolean;
  extras?: boolean;
}) {
  const events: unknown[][] = [];
  const dependencies: RacePresenterResultDependencies = {
    countdownState: "Countdown",
    render(scene, camera, clear) {
      events.push(["render", scene, camera === presenter.camera, clear]);
    },
  };
  const Original = new Function("X2", "e4",
    `${originalClass}\nreturn jr0;`)(
      { Countdown: dependencies.countdownState }, dependencies.render,
    ) as new () => Presenter;
  const presenter = Object.create(Original.prototype) as Presenter;
  presenter.disposed = mode.disposed ?? false;
  presenter.size = { x: 0, y: 0 };
  presenter.camera = { aspect: 0 };
  presenter.scene = "race-scene";
  presenter.views = "views";
  presenter.bannerRequest = "banner-request";
  presenter.resultVisible = mode.visible ?? false;
  presenter.resultComplete = false;
  presenter.runtime = {
    giantEffectsEnded: mode.extras ?? false,
    local: {
      scheduledStartAtMs: 100,
      lifecycle: { state: "Countdown" },
      track: {
        updateRender(nowMs, camera, width, height) {
          events.push(["track-render", nowMs, camera === presenter.camera,
            width, height]);
        },
        skydome: mode.sky ? "sky" : undefined,
      },
    },
  };
  presenter.trackInfoCard = { update(nowMs) {
    events.push(["track-card", nowMs]);
  } };
  presenter.banner = { update(...args) { events.push(["banner", ...args]); } };
  presenter.hud = { hideTimeGap() { events.push(["hide-gap"]); } };
  presenter.resultView = { update(nowMs) {
    events.push(["result-view", nowMs]); return "complete";
  } };
  presenter.assets = {
    map: { stageBinding: { beginFrame(nowMs) {
      events.push(["begin-frame", nowMs]);
    } } },
    lteCoins: mode.extras ? { update(nowMs, camera, width, height) {
      events.push(["coins", nowMs, camera === presenter.camera,
        width, height]);
    } } : undefined,
  };
  presenter.award = mode.extras ? { update(nowMs, camera, local, assets, views) {
    events.push(["award", nowMs, camera === presenter.camera,
      local === presenter.runtime.local, assets === presenter.assets, views]);
  } } : undefined;
  presenter.roadblockResult = mode.extras ? { update(nowMs, camera, width, height) {
    events.push(["roadblock-result", nowMs, camera === presenter.camera,
      width, height]);
  } } : undefined;
  presenter.clearGiant = () => { events.push(["clear-giant"]); };
  presenter.showResult = nowMs => {
    events.push(["show-result", nowMs]); presenter.resultVisible = true;
  };
  if (rewritten) Object.assign(presenter, {
    update(renderer: { getDrawingBufferSize(size: { x: number; y: number }): void },
      nowMs: number, input: Array<{ kind: string }>) {
      presentRaceResultFrame(presenter, renderer, nowMs, input, dependencies);
    },
  });
  const renderer = { getDrawingBufferSize(size: { x: number; y: number }) {
    events.push(["buffer-size"]); size.x = 1280; size.y = 720;
  } };
  return { presenter, renderer, events };
}

test("race presenter result branch and published result match release", () => {
  for (const mode of [
    { visible: true, sky: true, extras: true },
    { publish: true, sky: false, extras: false },
    { disposed: true, visible: true, extras: true },
  ]) {
    const inspect = (rewritten: boolean) => {
      const { presenter, renderer, events } = makeFixture(rewritten, mode);
      presenter.update(renderer, 1234,
        mode.publish ? [{ kind: "publish-result" }] : []);
      return { events, visible: presenter.resultVisible,
        complete: presenter.resultComplete,
        aspect: presenter.camera.aspect,
        size: presenter.size };
    };
    assert.deepEqual(inspect(true), inspect(false), JSON.stringify(mode));
  }
});
