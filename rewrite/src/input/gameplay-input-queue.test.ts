import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { GameplayInputQueue, isEditableTarget } from "./gameplay-input-queue";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("const Kl0 = 31;");
const end = source.indexOf("class Xl0 {", start);
assert.ok(start > 0 && end > start);

class FakeElement {
  isContentEditable = false;
  constructor(readonly input = false) {}
  matches(selector: string) { return this.input && selector.includes("input"); }
}

test("keyboard/touch queue, repeat release, editable focus and 31-record cap match jl0", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousElement = globalThis.HTMLElement;
  globalThis.HTMLElement = FakeElement as unknown as typeof HTMLElement;
  const originalMap = ["original"];
  const resolveActions = (code: string, _map: string[]) =>
    code === "KeyW" ? [2] : code === "Space" ? [4] : [];
  const Original = new Function("xl", "Br", `${source.slice(start, end)}; return jl0;`)(
    resolveActions, originalMap) as new () => GameplayInputQueue<string[]>;

  const run = (released: boolean) => {
    const listeners = new Map<string, Array<(event: unknown) => void>>();
    const events: string[] = [];
    const add = (owner: string, name: string, listener: (event: unknown) => void) => {
      events.push(`add:${owner}:${name}`);
      listeners.set(name, [...(listeners.get(name) ?? []), listener]);
    };
    const remove = (owner: string, name: string) => events.push(`remove:${owner}:${name}`);
    globalThis.window = {
      addEventListener: (name: string, listener: (event: unknown) => void) =>
        add("window", name, listener),
      removeEventListener: (name: string) => remove("window", name),
    } as unknown as Window & typeof globalThis;
    globalThis.document = {
      addEventListener: (name: string, listener: (event: unknown) => void) =>
        add("document", name, listener),
      removeEventListener: (name: string) => remove("document", name),
    } as unknown as Document;
    const queue = released ? new Original() : new GameplayInputQueue({
      keyMap: originalMap, resolveActions,
      editableTarget: isEditableTarget,
    });
    const states: unknown[] = [];
    const capture = (label: string, result?: unknown) => states.push({
      label, result, enabled: queue.isEnabled, cancelled: queue.cancelled,
      keyboardRecordCount: queue.keyboardRecordCount,
      records: queue.records.map(record => ({ ...record })),
      transitions: queue.transitions.map(transition => ({ ...transition })),
      releasedKeys: [...queue.releasedKeys],
      keyboardActions: [...queue.keyboardActions],
      touchActions: [...queue.touchActions],
      keyMap: [...queue.keyMap], events: [...events],
    });
    const emitKey = (name: "keydown" | "keyup", code: string, repeat = false,
      target: FakeElement | null = null) => {
      let prevented = false;
      const event = { code, repeat, target, preventDefault: () => { prevented = true; } };
      listeners.get(name)?.[0]?.(event);
      return prevented;
    };
    const focus = (target: FakeElement) => listeners.get("focusin")?.[0]?.({ target });
    capture("constructed");
    capture("initial-drain", queue.drain());
    capture("keydown", emitKey("keydown", "KeyW"));
    capture("repeat", emitKey("keydown", "KeyW", true));
    capture("keyup", emitKey("keyup", "KeyW"));
    capture("drain-keys", queue.drain());
    queue.setTouchAction(2, true);
    emitKey("keydown", "KeyW");
    capture("touch-before-key", queue.drain());
    queue.setTouchAction(2, false);
    emitKey("keyup", "KeyW");
    capture("touch-release", queue.drain());
    focus(new FakeElement(true));
    capture("editable-focus", queue.drain());
    capture("editable-key", emitKey("keydown", "Space", false, new FakeElement(true)));
    queue.setEnabled(false);
    queue.setTouchAction(4, true);
    capture("disabled", queue.drain());
    queue.setEnabled(true);
    queue.setKeyMap(["changed"]);
    for (let index = 0; index < 34; index++) emitKey("keydown", `K${index}`);
    capture("record-cap");
    capture("record-drain", queue.drain());
    queue.dispose();
    capture("disposed");
    return states;
  };
  try {
    assert.deepEqual(run(false), run(true));
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.HTMLElement = previousElement;
  }
});
