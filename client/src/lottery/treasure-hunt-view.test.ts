import assert from "node:assert/strict";
import test from "node:test";
import { TreasureHuntView } from "./treasure-hunt-view";

const result = (count: number, code?: string) => ({
  draws: Array.from({ length: count }, () => ({})),
  ...(code ? { stopped: { code } } : {}),
});

function autoFixture(results: ReturnType<typeof result>[]) {
  const view = Object.create(TreasureHuntView.prototype);
  const calls: number[] = [], notices: string[] = [];
  Object.assign(view, {
    busy: false, auto: false, shell: { disposed: false, showNotice: (text: string) => notices.push(text) },
    updateButtons() {}, hideStop() {},
    async draw(count: number, fromAuto: boolean) {
      assert.equal(fromAuto, true);
      calls.push(count);
      return results.shift();
    },
  });
  return { view, calls, notices };
}

test("continuous draws retry unspent duplicate rewards, including partially successful rounds", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { view, calls } = autoFixture([
    result(0, "ALREADY_OWNED"), result(3, "ALREADY_OWNED"), result(10), result(4, "INSUFFICIENT_ITEMS"),
  ]);
  const done = view.drawAuto();
  for (let i = 0; i < 12; i++) { await Promise.resolve(); t.mock.timers.tick(2000); }
  await done;
  assert.deepEqual(calls, [10, 10, 10, 10]);
  assert.equal(view.auto, false);
});

test("stopping between rounds prevents another request", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { view, calls } = autoFixture([result(10), result(10)]);
  const done = view.drawAuto();
  await Promise.resolve();
  view.stopRequested = true;
  t.mock.timers.tick(2000);
  await done;
  assert.deepEqual(calls, [10]);
  assert.equal(view.auto, false);
});

test("an entirely owned pool pauses instead of retrying forever", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { view, calls, notices } = autoFixture(Array.from({ length: 21 }, () => result(0, "ALREADY_OWNED")));
  const done = view.drawAuto();
  for (let i = 0; i < 50; i++) { await Promise.resolve(); t.mock.timers.tick(2000); }
  await done;
  assert.equal(calls.length, 20);
  assert.match(notices[0]!, /连抽已暂停/);
});

test("skip avoids the spin, and toggling it during a spin clears every light", async () => {
  const view = Object.create(TreasureHuntView.prototype);
  let lit = 0, cleared = 0;
  Object.assign(view, { skip: true, stopRequested: false, shell: { disposed: false }, lights: [{
    toggleAttribute() { lit++; view.skip = true; }, removeAttribute() { cleared++; },
  }] });
  await view.spin();
  assert.equal(lit, 0);
  view.skip = false;
  await view.spin();
  assert.equal(lit, 1);
  assert.equal(cleared, 1);
});
