import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CoatingPreviewSession, type CoatingChoice } from "./coating-preview";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("class xa0 {");
const end = source.indexOf("function Sa0(", start);
assert.ok(start > 0 && end > start);
const Original = new Function(`${source.slice(start, end)}; return xa0;`)() as typeof CoatingPreviewSession;

const choice = (overrides: Partial<CoatingChoice> = {}): CoatingChoice => ({
  family: "xun", resourceIndex: 513, textureIndex: 1,
  texturePath: "effect/envMap/env1.png", ...overrides,
});

async function exercise(Session: typeof CoatingPreviewSession) {
  const events: unknown[] = [];
  const pending: Array<{ resolve(texture: unknown): void; reject(error: Error): void }> = [];
  const session = new Session(
    { setCoatingProjection: value => events.push(value) },
    ["body"],
    { request: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) },
    "xun", { original: true },
  );
  const errors: string[] = [];
  for (const invalid of [
    choice({ family: "classic" }),
    choice({ unavailableReason: "未解锁" }),
    choice({ resourceIndex: -1 }),
    choice({ resourceIndex: 257, textureIndex: 2 }),
    choice({ texturePath: "other.png" }),
  ]) {
    try { await session.select(invalid); } catch (error) { errors.push(String(error)); }
  }

  const first = session.select(choice());
  const secondChoice = choice({ resourceIndex: 514, textureIndex: 2,
    texturePath: "effect/envMap/env2.png" });
  const second = session.select(secondChoice);
  pending[0]!.resolve("old-texture");
  pending[1]!.resolve("new-texture");
  const settled = [await first, await second];
  const selected = session.current;
  session.cancel();
  const afterCancel = session.current;
  const third = session.select(choice());
  session.dispose();
  pending[2]!.reject(new Error("late"));
  const late = await third;
  try { await session.select(choice()); } catch (error) { errors.push(String(error)); }
  return { errors, settled, selected, afterCancel, late,
    revision: session.revision, disposed: session.disposed, events };
}

test("garage coating validation, async ordering, cancel and dispose match release", async () => {
  assert.deepEqual(await exercise(CoatingPreviewSession), await exercise(Original));
});
