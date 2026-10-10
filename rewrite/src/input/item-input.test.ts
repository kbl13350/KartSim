import assert from "node:assert/strict";
import test from "node:test";
import { DrivingAction } from "./driving-input";
import { ItemInputRouter, isItemAction, type ItemCommand } from "./item-input";

function sink(racing = true) {
  const commands: ItemCommand[] = [];
  let escapes = 0;
  return {
    commands,
    get escapes() { return escapes; },
    racing,
    command(command: ItemCommand) { commands.push(command); },
    escape() { escapes += 1; },
  };
}

const edge = (action: number, down: boolean, source = "keyboard:x") => ({ action, down, source });

test("Ctrl, Alt and Z become item commands and leave the driving batch", () => {
  assert.ok(isItemAction(DrivingAction.UseItemOrBooster));
  assert.ok(isItemAction(DrivingAction.ReorderItems));
  assert.ok(isItemAction(DrivingAction.SecondaryItem));
  assert.ok(!isItemAction(DrivingAction.ModeImpulsePositive), "Z's LTE binding stays a driving action");
  const router = new ItemInputRouter();
  const target = sink();
  const forward = edge(DrivingAction.Forward, true);
  const impulse = edge(DrivingAction.ModeImpulsePositive, true);
  const driving = router.route([
    forward,
    edge(DrivingAction.UseItemOrBooster, true),
    edge(DrivingAction.ReorderItems, true),
    edge(DrivingAction.ReorderItems, false),
    edge(DrivingAction.SecondaryItem, true),
    impulse,
    edge(DrivingAction.UseItemOrBooster, false),
  ], target);
  assert.deepEqual(driving, [forward, impulse]);
  assert.equal(driving[0], forward, "untouched transitions keep their identity");
  assert.deepEqual(target.commands, [
    { kind: "use", phase: "press" },
    { kind: "swap" },
    { kind: "change" },
    { kind: "use", phase: "release" },
  ]);
});

test("two use sources press once and release when the last lets go", () => {
  const router = new ItemInputRouter();
  const target = sink();
  router.route([edge(5, true, "keyboard:ControlLeft"), edge(5, true, "keyboard:ControlRight")], target);
  router.route([edge(5, false, "keyboard:ControlLeft")], target);
  assert.deepEqual(target.commands, [{ kind: "use", phase: "press" }]);
  router.route([edge(5, false, "keyboard:ControlRight")], target);
  assert.deepEqual(target.commands,
    [{ kind: "use", phase: "press" }, { kind: "use", phase: "release" }]);
  router.route([edge(5, false)], target);
  assert.equal(target.commands.length, 2, "a stray release is ignored");
});

test("outside racing nothing fires, but a held aim is still released or cancelled", () => {
  const router = new ItemInputRouter();
  const waiting = sink(false);
  router.route([edge(5, true), edge(6, true), edge(7, true), edge(5, false)], waiting);
  assert.deepEqual(waiting.commands, []);

  const racing = sink(true);
  router.route([edge(5, true)], racing);
  const finished = sink(false);
  router.route([edge(5, false)], finished);
  assert.deepEqual(finished.commands, [{ kind: "use", phase: "release" }]);

  router.route([edge(5, true)], racing);
  const cancelled = sink();
  router.cancel(cancelled);
  router.cancel(cancelled);
  assert.deepEqual(cancelled.commands, [{ kind: "use", phase: "cancel" }]);
  router.route([edge(5, false)], cancelled);
  assert.equal(cancelled.commands.length, 1, "the release after a cancel is dropped");
});

test("left and right presses are escape presses and still steer", () => {
  const router = new ItemInputRouter();
  const target = sink();
  const left = edge(DrivingAction.SteerLeft, true);
  const leftUp = edge(DrivingAction.SteerLeft, false);
  const right = edge(DrivingAction.SteerRight, true);
  assert.deepEqual(router.route([left, leftUp, right], target), [left, leftUp, right]);
  assert.equal(target.escapes, 2);
});

test("a down from a source whose release was lost starts a fresh press", () => {
  // Ctrl held to aim, then a system shortcut (Ctrl+Left switches the macOS Space)
  // takes focus and the keyup goes to another window.
  const router = new ItemInputRouter();
  const target = sink();
  router.route([edge(5, true, "keyboard:ControlLeft")], target);
  router.route([edge(5, true, "keyboard:ControlLeft")], target);
  router.route([edge(5, false, "keyboard:ControlLeft")], target);
  router.route([edge(5, true, "keyboard:ControlLeft")], target);
  router.route([edge(5, false, "keyboard:ControlLeft")], target);
  assert.deepEqual(target.commands, [
    { kind: "use", phase: "press" },
    { kind: "use", phase: "cancel" },
    { kind: "use", phase: "press" },
    { kind: "use", phase: "release" },
    { kind: "use", phase: "press" },
    { kind: "use", phase: "release" },
  ]);
});

test("keyboard and touch or gamepad holds merged by the input queue never leave the use key stuck", () => {
  // The queue drops one kind's edges while the other kind holds the action, and it
  // tracks keyboard holds per action, so RightCtrl's release below never arrives.
  const router = new ItemInputRouter();
  const target = sink();
  const key = (code: string, down: boolean) => ({ action: 5, down, source: `keyboard:${code}`, sourceKind: "keyboard" });
  const pad = (down: boolean) => ({ action: 5, down, source: "touch:5", sourceKind: "touch" });
  router.route([key("ControlLeft", true), key("ControlRight", true)], target);
  router.route([key("ControlLeft", false)], target);
  router.route([pad(true)], target);
  router.route([pad(false)], target);
  assert.deepEqual(target.commands.at(-1), { kind: "use", phase: "release" });
  const used = target.commands.length;
  router.route([pad(true)], target);
  router.route([pad(false)], target);
  assert.deepEqual(target.commands.slice(used),
    [{ kind: "use", phase: "press" }, { kind: "use", phase: "release" }]);

  // Keyboard down, touch down (dropped by the queue), keyboard up (dropped), touch up.
  const merged = new ItemInputRouter();
  const mergedTarget = sink();
  merged.route([key("ControlLeft", true)], mergedTarget);
  merged.route([pad(false)], mergedTarget);
  assert.deepEqual(mergedTarget.commands,
    [{ kind: "use", phase: "press" }, { kind: "use", phase: "release" }]);
  merged.route([key("ControlLeft", true)], mergedTarget);
  assert.deepEqual(mergedTarget.commands.at(-1), { kind: "use", phase: "press" });
});

test("gamepad edges merged after the queue are tracked on their own", () => {
  const router = new ItemInputRouter();
  const target = sink();
  const key = (down: boolean) => ({ action: 5, down, source: "keyboard:ControlLeft", sourceKind: "keyboard" });
  const pad = (down: boolean) => ({ action: 5, down, source: "gamepad:3", sourceKind: "gamepad" });
  router.route([key(true), pad(true), pad(false)], target);
  assert.deepEqual(target.commands, [{ kind: "use", phase: "press" }], "the key still holds the aim");
  router.route([key(false)], target);
  assert.deepEqual(target.commands,
    [{ kind: "use", phase: "press" }, { kind: "use", phase: "release" }]);
});
