import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  clearPreparationPageFrames, closeGaragePreparation, disposeGaragePreparation,
  preparationCards, preparationPreviewCard, preparationPreviewRect,
  resizePreparationCanvases, selectedPreparationVehicle,
  type GaragePreparationHost, type GaragePreparationItem,
} from "./garage-upgrade-preparation-state";
import { GarageUpgradePreparationState } from "./garage-progression-session";
import type { XunGarageProgression } from "./garage-progression-panel";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "Ja");
assert.ok(view && view.type === "ClassDeclaration");
const Original = new Function(release.slice(view.start!, view.end!) + "; return Ja;")() as
  new (...args: never[]) => GaragePreparationHost & {
    selected: GaragePreparationItem;
    previewRect: unknown;
    previewCard: unknown;
    cards: unknown;
    resizeCanvases(): void;
    clearPageFrameResources(): void;
    close(accept: boolean): void;
    dispose(): void;
  };

function progression(level = 2): XunGarageProgression {
  return { kind: "xun", level, skills: [
    { id: 1, points: 0 }, { id: 2, points: 0 }, { id: 3, points: 0 },
  ] };
}

function fixture(released: boolean, level = 2) {
  const events: unknown[] = [];
  const candidates = Array.from({ length: 18 }, (_, itemId) => ({
    item: { itemId, engineGrade: 9, title: "Vehicle " + itemId },
    value: progression(itemId === 17 ? level : 2),
  }));
  const state = new GarageUpgradePreparationState(candidates, 17, {
    blockedKart: () => false,
    validate: () => undefined,
    nextLevel: value => ({ ...value, level: Math.min(value.level + 1, 5) }),
  });
  const host = released
    ? Object.create(Original.prototype) as InstanceType<typeof Original>
    : {} as GaragePreparationHost;
  Object.assign(host, {
    state,
    disposed: false,
    assets: {
      rects: new Map([
        ["itemView", { x: 10, y: 20, width: 120, height: 90 }],
        ["kartSelector", { x: 100, y: 200, width: 400, height: 200 }],
      ]),
      cardLayout: {
        width: 80, height: 50, columns: 4,
        horizontalMargin: 5, verticalMargin: 7, clientLeft: 9, clientTop: 11,
      },
    },
    pageFrameObservers: [
      { disconnect: () => { events.push("disconnect-a"); } },
      { disconnect: () => { events.push("disconnect-b"); } },
    ],
    pageFrameRedraws: [
      () => { events.push("redraw-a"); },
      () => { events.push("redraw-b"); },
    ],
    element: { remove: () => { events.push("remove"); } },
    previousFocus: { isConnected: true, focus: () => { events.push("focus"); } },
    onClose: (choice: unknown) => { events.push(["close", choice]); },
  });
  const selected = () => released
    ? (host as InstanceType<typeof Original>).selected
    : selectedPreparationVehicle(host);
  const previewRect = () => released
    ? (host as InstanceType<typeof Original>).previewRect
    : preparationPreviewRect(host);
  const previewCard = () => released
    ? (host as InstanceType<typeof Original>).previewCard
    : preparationPreviewCard(host);
  const cards = () => released
    ? (host as InstanceType<typeof Original>).cards
    : preparationCards(host);
  const resize = () => released
    ? (host as InstanceType<typeof Original>).resizeCanvases()
    : resizePreparationCanvases(host);
  const clear = () => released
    ? (host as InstanceType<typeof Original>).clearPageFrameResources()
    : clearPreparationPageFrames(host);
  const close = (accept: boolean) => released
    ? (host as InstanceType<typeof Original>).close(accept)
    : closeGaragePreparation(host, accept);
  const dispose = () => released
    ? (host as InstanceType<typeof Original>).dispose()
    : disposeGaragePreparation(host);
  const snapshot = () => ({
    selected: selected(), previewRect: previewRect(), previewCard: previewCard(),
    cards: cards(), events: structuredClone(events), disposed: host.disposed,
    settled: state.settled, hasAssets: !!host.assets,
    observers: host.pageFrameObservers.length,
    redraws: host.pageFrameRedraws?.length,
  });
  return { host, state, selected, previewRect, previewCard, cards,
    resize, clear, close, dispose, snapshot, events };
}

test("upgrade preparation preview and paged card geometry match Ja", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const secondPage = f.snapshot();
    f.state.choose(3);
    const firstPage = f.snapshot();
    f.host.assets = undefined;
    return { secondPage, firstPage, unloaded: f.snapshot() };
  };
  assert.deepEqual(run(false), run(true));
});

test("upgrade preparation redraw, cancellation and idempotent cleanup match Ja", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    f.resize();
    const redrawn = f.snapshot();
    f.close(false);
    f.dispose();
    f.clear();
    return { redrawn, closed: f.snapshot() };
  };
  assert.deepEqual(run(false), run(true));
});

test("upgrade preparation only commits a loaded, available upgrade like Ja", () => {
  const run = (released: boolean, level: number) => {
    const f = fixture(released, level);
    const assets = f.host.assets;
    f.host.assets = undefined;
    f.close(true);
    const unloaded = f.snapshot();
    f.host.assets = assets;
    f.close(true);
    return { unloaded, final: f.snapshot() };
  };
  for (const level of [2, 5]) {
    assert.deepEqual(run(false, level), run(true, level), String(level));
  }
});
