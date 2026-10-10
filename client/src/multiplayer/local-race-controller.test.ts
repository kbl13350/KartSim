import assert from "node:assert/strict";
import test from "node:test";
import { LocalRaceController } from "./local-race-controller";

test("local race update hands its frame actions to the multiplayer coordinator", () => {
  // The coordinator calls actions.some(...) every frame; a dropped return value
  // threw during the countdown and sent players back to the lobby.
  const race = Object.assign(Object.create(LocalRaceController.prototype), {
    disposed: true, dependencies: { runtime: {} },
  }) as LocalRaceController;
  assert.deepEqual(race.update(1000, 1 / 60), []);
});
