import assert from "node:assert/strict";
import test from "node:test";
import { drawMultiplayerWindowNode, type MultiplayerWindowDrawHost,
  type MultiplayerWindowDrawDependencies } from "./multiplayer-window-draw";
import type { WindowNode } from "./multiplayer-window-assets";

for (const name of ["roomEmotionToggle", "roomEmotionWheel"]) {
  test(`${name}: animation repaint never draws the replaced legacy control`, () => {
    let canvasAccesses = 0;
    const host = {
      paintingOnly: true,
      options: { state: () => ({ visible: true, action() {} }) },
      get textures() { canvasAccesses++; throw Error("legacy drawing reached"); },
    } as unknown as MultiplayerWindowDrawHost;
    const dependencies = {
      attribute: (_node: unknown, key: string) => key === "name" ? name : undefined,
    } as unknown as MultiplayerWindowDrawDependencies;
    const visible = new Set<WindowNode>();
    drawMultiplayerWindowNode(host, { name: "TextButton", children: [] },
      { x: 0, y: 0, width: 1600, height: 900 }, visible, dependencies);
    assert.equal(canvasAccesses, 0);
    assert.equal(visible.size, 0, "paint-only pass must preserve existing DOM controls");
  });
}
