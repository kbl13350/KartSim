import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import type { WindowNode } from "./multiplayer-window-assets";
import { chooseMultiplayerCombo, closeMultiplayerCombo, multiplayerCanvasButton,
  updateMultiplayerHoverRegion, type MultiplayerWindowActionHost,
  type MultiplayerWindowActionState } from "./multiplayer-window-actions";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

test("多人窗口按钮、组合框与 hover region 的业务动作和发行版一致", async () => {
  const release = await readFile(releaseFile, "utf8");
  const start = release.indexOf("class te {");
  const end = release.indexOf("\nfunction OM(", start);
  assert.ok(start >= 0 && end > start);
  const attribute = (node: WindowNode, name: string) =>
    (node as WindowNode & { attributes: Record<string, string> }).attributes[name];
  const Original = new Function("T", `${release.slice(start, end)}\nreturn te;`)(
    attribute) as { prototype: {
      canvasButton(this: MultiplayerWindowActionHost, node: WindowNode,
        rect: unknown, text: string | undefined, state: MultiplayerWindowActionState):
        ReturnType<typeof multiplayerCanvasButton>;
      updateHoverRegion(this: MultiplayerWindowActionHost, event: PointerEvent): void;
      closeCombo(this: MultiplayerWindowActionHost): void;
      chooseCombo(this: MultiplayerWindowActionHost, index: number): void;
    } };
  const make = (rewritten: boolean) => {
    const events: unknown[][] = [];
    const button = { name: "Button", children: [],
      attributes: { name: "Apply" } } as WindowNode;
    const combo = { name: "Combo", children: [],
      attributes: { name: "People" } } as WindowNode;
    const states = new Map<WindowNode, MultiplayerWindowActionState>([
      [button, { label: "Apply", action: () => events.push(["action"]),
        onActivate: () => events.push(["button sound"]) }],
      [combo, { select: { values: ["one", "two", "three"], value: "two",
        change: value => events.push(["change", value]) } }],
    ]);
    const host = {
      options: {
        root: { getBoundingClientRect: () =>
          ({ left: 20, top: 30, width: 800, height: 450 }) },
        state: (node: WindowNode) => states.get(node) ?? {},
        onHover: () => events.push(["hover sound"]),
        onActivate: () => events.push(["activate sound"]),
      },
      openCombo: undefined, comboIndex: 0, hoveredRegion: undefined,
      hoverRegions: [
        { id: "sound", rect: { x: 0, y: 0, width: 40, height: 40 }, sound: true },
        { id: "quiet", rect: { x: 40, y: 0, width: 40, height: 40 }, sound: false },
      ],
      controls: new Map([[combo, { focus: () => events.push(["focus"]) }]]),
      render: () => events.push(["render"]),
      closeCombo: () => { if (rewritten) closeMultiplayerCombo(host);
        else Original.prototype.closeCombo.call(host); },
      chooseCombo: (index: number) => { if (rewritten) chooseMultiplayerCombo(host, index);
        else Original.prototype.chooseCombo.call(host, index); },
    } as unknown as MultiplayerWindowActionHost;
    const rect = { x: 0, y: 0, width: 60, height: 40 };
    const makeButton = (node: WindowNode, text?: string) => rewritten
      ? multiplayerCanvasButton(host, node, rect, text, states.get(node)!, attribute)
      : Original.prototype.canvasButton.call(host, node, rect, text, states.get(node)!);
    const regular = makeButton(button, "fallback");
    const selector = makeButton(combo);
    const key = (value: string) => ({ key: value,
      preventDefault: () => events.push(["key prevent"]),
      stopPropagation: () => events.push(["key stop"]),
    }) as unknown as KeyboardEvent;
    regular.hover();
    regular.activate();
    regular.keydown(key("ArrowDown"));
    states.get(button)!.silentHover = true;
    regular.hover();
    states.get(button)!.disabled = true;
    regular.activate();
    selector.keydown(key("ArrowDown"));
    host.chooseCombo(2);
    selector.activate();
    host.chooseCombo(99);
    selector.activate();
    states.get(combo)!.disabled = true;
    host.chooseCombo(0);
    states.get(combo)!.disabled = false;
    host.openCombo = undefined;
    selector.activate();
    host.closeCombo();
    for (const [x, y] of [[30, 35], [55, 35], [62, 35], [300, 300]]) {
      const pointer = { clientX: x, clientY: y } as PointerEvent;
      if (rewritten) updateMultiplayerHoverRegion(host, pointer);
      else Original.prototype.updateHoverRegion.call(host, pointer);
    }
    return { buttons: [regular.label, regular.disabled, selector.label, selector.disabled],
      hoveredRegion: host.hoveredRegion, comboIndex: host.comboIndex,
      openCombo: host.openCombo === combo, events };
  };
  assert.deepEqual(make(true), make(false));
});
