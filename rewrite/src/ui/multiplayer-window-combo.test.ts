import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import type { WindowNode } from "./multiplayer-window-assets";
import { drawMultiplayerComboPopup, type ComboFrame,
  type MultiplayerComboHost } from "./multiplayer-window-combo";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

test("多人窗口组合弹层布局、列表帧和操作与发行版一致", async () => {
  const source = await readFile(releaseFile, "utf8");
  const start = source.indexOf("class te {");
  const end = source.indexOf("\nfunction OM(", start);
  assert.ok(start >= 0 && end > start);
  const attribute = (entry: WindowNode, name: string) =>
    (entry as WindowNode & { attrs: Record<string, string> }).attrs[name];
  const entries = (entry: WindowNode) => entry.children;
  const rectangle = (entry: WindowNode, parent: { x: number; y: number;
    width: number; height: number }) =>
    ({ x: parent.x, y: parent.y, width: parent.width,
      height: Number(attribute(entry, "height") ?? 20) });
  const paintFrame = (context: CanvasRenderingContext2D, frame: ComboFrame,
    image: CanvasImageSource, rect: unknown) =>
    (context as CanvasRenderingContext2D & { log(event: unknown[]): void })
      .log(["frame", frame.texture, image, rect]);
  const Original = new Function("T", "OM", "V0", "C9",
    `${source.slice(start, end)}\nreturn te;`)(attribute, entries, rectangle,
      paintFrame) as { prototype: { drawComboPopup(this: MultiplayerComboHost): void } };
  const frame: ComboFrame = { texture: "list", left: { width: 5 },
    right: { width: 6 }, caption: { height: 7 }, bottom: { height: 8 } };
  const itemFrame: ComboFrame = { texture: "item", left: { width: 0 },
    right: { width: 0 }, caption: { height: 0 }, bottom: { height: 0 } };
  const nodes = ["one", "two", "three"].map((value, index) => ({
    name: "Option", children: [], attrs: { text: value, height: String(20 + index * 2) },
  })) as WindowNode[];
  const combo = { name: "Combo", children: nodes,
    attrs: { listFrame: "DefaultEdit" } } as WindowNode;
  const makeHost = (active: boolean, disabled: boolean, withRect: boolean) => {
    const events: unknown[][] = [];
    const context = { log: (event: unknown[]) => events.push(event) } as unknown as CanvasRenderingContext2D;
    const host = {
      options: { state: () => ({ select: { values: ["one", "two", "three"],
        value: "two" }, disabled }), onHover: () => events.push(["hover"]) },
      openCombo: active ? combo : undefined,
      comboIndex: 1,
      comboRects: new Map(withRect ? [[combo,
        { x: 100, y: 200, width: 120, height: 25 }]] : []),
      buttons: [],
      frames: new Map([["DefaultEdit", [frame]]]),
      styles: new Map(nodes.map(node => [node,
        { states: [{ frame: itemFrame }, { frame: itemFrame }] }])),
      images: new Map([["list", { image: "list-image" }],
        ["item", { image: "item-image" }]]),
      context,
      closeCombo: () => events.push(["close"]),
      chooseCombo: (index: number) => events.push(["choose", index]),
      drawComboText: (entry: WindowNode, rect: unknown) =>
        events.push(["text", attribute(entry, "text"), rect]),
      text: (value: string) => value.toUpperCase(),
    } as unknown as MultiplayerComboHost;
    return { host, summary: () => {
      const buttons = host.buttons.map(button =>
        [button.key, button.rect, button.label, button.tabIndex]);
      for (const button of host.buttons) {
        button.hover?.();
        button.activate();
      }
      return { open: host.openCombo === combo, buttons, events };
    } };
  };
  for (const [active, disabled, withRect] of [
    [false, false, true], [true, true, true], [true, false, false],
    [true, false, true],
  ] as Array<[boolean, boolean, boolean]>) {
    const original = makeHost(active, disabled, withRect);
    const rewritten = makeHost(active, disabled, withRect);
    Original.prototype.drawComboPopup.call(original.host);
    drawMultiplayerComboPopup(rewritten.host,
      { entries, attribute, rectangle, paintFrame });
    assert.deepEqual(rewritten.summary(), original.summary(),
      `active=${active} disabled=${disabled} withRect=${withRect}`);
  }
});
