import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { TrackChangeNotice, type TrackChangeNoticeDependencies,
  type TrackChangeNode } from "./track-change-notice";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class fy {");
const end = release.indexOf("\nconst _l0", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Variant = "host" | "guest" | "missing-message" | "missing-host-text" |
  "missing-guest-text" | "definition-error" | "string-error" | "view-error";

async function observe(rewritten: boolean, variant: Variant, exercise: boolean) {
  const events: unknown[][] = [];
  const library = { id: "library" };
  const root = { id: "root" };
  const room = { roomId: "R1", hostId: variant === "guest" ? "other" : "self",
    phase: "open", trackId: "T1", randomTrackCode: "" };
  const message: TrackChangeNode = { name: "message", children: [],
    leftTopWH: "0 0 200 20", textRender: "bold16" };
  const caption: TrackChangeNode = { name: "blink", children:
    variant === "missing-message" ? [] : [message], clientSize: "260 50" };
  const strings = [
    { n: "trackChangeWaitForMaster", children: variant === "missing-host-text"
      ? [] : [{ c: "cn", v: "主机正在更换赛道", children: [] }] },
    { n: "trackChangeWait", children: variant === "missing-guest-text"
      ? [] : [{ c: "cn", v: "请等待主机", children: [] }] },
  ];
  const attributes: Record<string, string> = {};
  const view = {
    element: { dataset: {} as Record<string, string>,
      style: { pointerEvents: "" },
      setAttribute(name: string, value: string) {
        attributes[name] = value; events.push(["attribute", name, value]);
      } },
    wrapLabel(text: string, maxWidth: number, fontSize: number) {
      events.push(["wrap", text, maxWidth, fontSize]);
      return { lines: [text.slice(0, 2), text.slice(2)], lineHeight: 18 };
    },
    paintLabelLines(_canvas: unknown, lines: string[], _rect: unknown,
      fontSize: number, color: string, lineHeight: number) {
      events.push(["paint", lines, fontSize, color, lineHeight]);
    },
    show() { events.push(["show"]); },
    hide() { events.push(["hide"]); },
    dispose() { events.push(["dispose"]); },
  };
  let clock = 1000;
  const deps = {
    loadDefinition: async (_library: unknown, folder: string, name: string) => {
      events.push(["definition", _library === library, folder, name]);
      if (variant === "definition-error") throw new Error("definition failed");
      return caption;
    },
    loadStringBag: async (_library: unknown) => {
      events.push(["strings", _library === library]);
      if (variant === "string-error") throw new Error("strings failed");
      return new Uint8Array([1]);
    },
    parseStringBag: (_bytes: Uint8Array) => ({ root: { children: strings } }),
    nodeAttribute: (node: TrackChangeNode, name: string) => node[name] as string,
    stringAttribute: (node: { [key: string]: unknown }, name: string) =>
      node[name] as string | undefined,
    clone: (node: TrackChangeNode, fields: Record<string, string>) => {
      events.push(["clone", node.name, fields]);
      return { ...node, ...fields };
    },
    loadView: async (options: Record<string, unknown>) => {
      const state = options.state as (node: TrackChangeNode) => Record<string, unknown>;
      events.push(["view", options.library === library, options.root === root,
        options.roots, options.label, options.preserveDisplayPixels,
        options.smoothImages, state(message).text,
        state(caption)]);
      if (variant === "view-error") throw new Error("view failed");
      (state(message).paint as (canvas: unknown, rect: unknown) => void)({}, {});
      return view;
    },
    nowMs: () => clock,
  } satisfies TrackChangeNoticeDependencies;
  const Original = new Function("F9", "U1", "T", "x1", "j0", "h2", "te",
    "performance", `${originalClass}\nreturn fy;`)(
      deps.loadDefinition,
      (_library: unknown) => ({ bytes: () => deps.loadStringBag(_library) }),
      deps.nodeAttribute, deps.parseStringBag, deps.stringAttribute, deps.clone,
      { load: deps.loadView }, { now: deps.nowMs },
    ) as unknown as { load(library: unknown, root: unknown, room: unknown,
      playerId: string): Promise<TrackChangeNotice> };
  let notice: TrackChangeNotice | undefined;
  let error: string | undefined;
  try {
    notice = rewritten
      ? await TrackChangeNotice.load(library, root, room, "self", deps)
      : await Original.load(library, root, room, "self");
  } catch (failure) { error = (failure as Error).message; }
  if (notice && exercise) {
    notice.show();
    notice.update({ ...room }, true);
    notice.update({ ...room, trackId: "T2" }, true);
    clock = 3999;
    notice.tick();
    clock = 4000;
    notice.tick();
    notice.update({ ...room, trackId: "T2", randomTrackCode: "random" }, true);
    notice.update({ ...room, roomId: "R2", trackId: "T3" }, true);
    notice.update({ ...room, roomId: "R2" }, false);
    notice.dispose();
  }
  return { events, error, notice: notice && {
    until: notice.until, activeLayout: notice.activeLayout,
    layoutCount: notice.layouts.size,
    caption: JSON.stringify(notice.definition.children),
    uiLayer: view.element.dataset.uiLayer,
    pointerEvents: view.element.style.pointerEvents,
    attributes,
  } };
}

test("track-change notice loading, labels and cleanup match release", async () => {
  for (const variant of ["host", "guest", "missing-message",
    "missing-host-text", "missing-guest-text", "definition-error",
    "string-error", "view-error"] as const) {
    assert.deepEqual(await observe(true, variant, false),
      await observe(false, variant, false), variant);
  }
});

test("track-change notice host and guest updates match release", async () => {
  for (const variant of ["host", "guest"] as const) {
    assert.deepEqual(await observe(true, variant, true),
      await observe(false, variant, true), variant);
  }
});
