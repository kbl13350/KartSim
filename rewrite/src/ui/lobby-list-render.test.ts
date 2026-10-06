import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { renderLobbyList, type LobbyListRenderHost } from "./lobby-list-render";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

test("多人大厅按钮标签、画布尺寸与事件和发行版一致", async () => {
  const release = await readFile(releaseFile, "utf8");
  const start = release.indexOf("class Ew {");
  const end = release.indexOf("\nfunction U1(", start);
  assert.ok(start >= 0 && end > start);
  const viewport = () => ({ width: 1600, height: 900, scaleX: 1, scaleY: 1 });
  const modeForButton = (name: string) => name === "giant" ? { label: "巨人模式" } : undefined;
  const roomLabel = () => "测试房间";
  const Original = new Function("Sr", "Zc", "rR",
    `${release.slice(start, end)}\nreturn Ew;`)(viewport, modeForButton, roomLabel) as {
      prototype: { render(this: LobbyListRenderHost): void };
    };

  const previousWindow = globalThis.window;
  globalThis.window = { devicePixelRatio: 2 } as Window & typeof globalThis;
  try {
    const makeHost = () => {
      const events: unknown[][] = [];
      let buttons: Array<{ key: string; label: string; hover(): void; activate(): void }> = [];
      const host = {
        disposed: false,
        options: {
          root: { getBoundingClientRect: () => ({ width: 800, height: 450 }) },
          onHover: () => events.push(["hover"]),
        },
        canvas: { width: 0, height: 0, style: { cursor: "" } },
        context: {
          setTransform: (...args: number[]) => events.push(["transform", ...args]),
          imageSmoothingEnabled: false,
        },
        assets: { definition: { name: "root", children: [] },
          textures: new Map(), trackTitles: new Map(), strings: new Map() },
        rooms: [{ count: 3, capacity: 8, gaming: true }],
        hovered: "room0", hits: [],
        draw: (_node: unknown, rect: unknown) => {
          events.push(["draw", rect]);
          host.hits = ["room0", "giant", "createRoom", "roomRight"].map(name =>
            ({ name, rect: { x: 0, y: 0, width: 20, height: 20 } }));
        },
        buttons: { update: (entries: typeof buttons) => { buttons = entries; } },
        activate: (name: string) => events.push(["activate", name]),
      } as unknown as LobbyListRenderHost;
      return {
        host, events,
        result: () => {
          const entries = buttons.map(button => [button.key, button.label]);
          for (const button of buttons) { button.hover(); button.activate(); }
          return { entries, canvas: [host.canvas.width, host.canvas.height],
            cursor: host.canvas.style.cursor, hits: host.hits, events };
        },
      };
    };
    const original = makeHost();
    const rewritten = makeHost();
    Original.prototype.render.call(original.host);
    renderLobbyList(rewritten.host, { viewport, modeForButton, roomLabel });
    assert.deepEqual(rewritten.result(), original.result());
  } finally {
    globalThis.window = previousWindow;
  }
});
