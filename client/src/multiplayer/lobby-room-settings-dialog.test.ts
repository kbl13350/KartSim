import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { roomSettingsMode, showLobbyRoomSettings } from "./lobby-room-settings-dialog";
import type { LobbyDialogNode, LobbyDialogViewDependencies } from
  "./lobby-dialog-views";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class b1 {");
const end = release.indexOf("\nconst $l0 =", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Variant = "individual" | "team" | "existing-password" |
  "missing-template" | "busy" | "whitespace";

async function observe(rewritten: boolean, variant: Variant) {
  const events: unknown[][] = [];
  const node = (name: string, children: LobbyDialogNode[] = []): LobbyDialogNode =>
    ({ name, children });
  const template = node("방설정변경", [node("roomName"), node("roomPassword"),
    node("warningGreenAuth"), node("clubRaceCont")]);
  const source = node("root", variant === "missing-template" ? [] : [template]);
  const library = { id: "library" };
  const options = { library, cancel() { events.push(["cancel"]); } };
  const view = { show() { events.push(["show"]); },
    focus(target?: string) { events.push(["focus", target]); },
    render() { events.push(["render"]); },
    dispose() { events.push(["dispose"]); },
  };
  let captured: Record<string, unknown> | undefined;
  const deps = {
    async loadMessageTemplate() { throw new Error("unused"); },
    async loadDefinition(_library: unknown, folder: string, name: string) {
      events.push(["definition", _library === library, folder, name]);
      return source;
    },
    async decorateDefinition(_library: unknown, tree: LobbyDialogNode,
      folder: string) {
      events.push(["decorate", _library === library, tree.name, folder]);
      return tree;
    },
    clone(target: LobbyDialogNode, fields: Record<string, string>) {
      events.push(["clone", target.name, fields]);
      return { ...target, ...fields };
    },
    nodeName: (target: LobbyDialogNode) => target.name,
    async loadView(settings: Record<string, unknown>) {
      captured = settings;
      events.push(["view", settings.roots, settings.label,
        JSON.stringify(settings.definition)]);
      return view;
    },
  } satisfies LobbyDialogViewDependencies;
  const Original = new Function("F9", "T", "h2", "C8", "te",
    `${originalClass}\nreturn b1;`)(
      deps.loadDefinition, deps.nodeName, deps.clone,
      deps.decorateDefinition, { load: deps.loadView },
    ) as unknown as { roomSettings(options: unknown, mode: string,
      initial: { name: string; password: string },
      submit: (settings: unknown) => void): Promise<{ busy: boolean }> };
  class Modern { busy = false; view = view; }
  const initial = { name: "原房间", password:
    variant === "existing-password" ? "old" : "" };
  const submit = (settings: unknown) => events.push(["submit", settings]);
  let dialog: { busy: boolean } | undefined;
  let error: string | undefined;
  try {
    dialog = rewritten
      ? await showLobbyRoomSettings(() => new Modern(), options,
        variant === "team" ? "team" : "individual", initial, submit, deps)
      : await Original.roomSettings(options,
        variant === "team" ? "team" : "individual", initial, submit);
  } catch (failure) { error = (failure as Error).message; }
  if (!dialog || !captured) return { events, error };
  const state = captured.state as (node: LobbyDialogNode) => Record<string, unknown>;
  const field = (name: string) => state(node(name));
  const snapshots: unknown[] = [{ mode: field("gameType").text,
    name: (field("roomName").input as { value: string }).value,
    passwordDisabled: field("roomPassword").disabled,
    checked: field("isPassword").checked }];
  ((field("roomName").input as { change(value: string): void }).change)(
    variant === "whitespace" ? "   " : "  新名  ");
  if (variant === "existing-password") {
    (field("isPassword").action as () => void)();
    snapshots.push({ password: (field("roomPassword").input as
      { value: string }).value });
  } else {
    (field("isPassword").action as () => void)();
    ((field("roomPassword").input as { change(value: string): void }).change)(
      "new-password");
  }
  if (variant === "busy") {
    dialog.busy = true;
    (field("isPassword").action as () => void)();
    (captured.onConfirm as () => void)();
    (captured.onCancel as () => void)();
    snapshots.push({ checked: field("isPassword").checked,
      disabled: field("change").disabled });
    dialog.busy = false;
  }
  (captured.onConfirm as () => void)();
  (field("change").action as () => void)();
  (captured.onCancel as () => void)();
  return { events, error, snapshots };
}

test("lobby room settings template, input, password and busy guards match release", async () => {
  for (const variant of ["individual", "team", "existing-password",
    "missing-template", "busy", "whitespace"] as const) {
    assert.deepEqual(await observe(true, variant),
      await observe(false, variant), variant);
  }
});

test("道具赛 room settings show the item game", async () => {
  assert.equal(roomSettingsMode({ mode: "team", gameplay: "item" }), "itemTeam");
  assert.equal(roomSettingsMode({ mode: "individual", gameplay: "item" }), "itemIndi");
  assert.equal(roomSettingsMode({ mode: "team", gameplay: "grip" }), "team");
  assert.equal(roomSettingsMode({ mode: "individual" }), "individual");
  for (const [mode, text] of [["itemTeam", "组队道具赛"], ["itemIndi", "个人道具赛"],
    ["team", "组队竞速"]] as const) {
    let captured: Record<string, unknown> | undefined;
    const view = { show() {}, focus() {}, render() {}, dispose() {} };
    const node = (name: string): LobbyDialogNode => ({ name, children: [] });
    const deps = {
      async loadMessageTemplate() { throw new Error("unused"); },
      async loadDefinition() { return { name: "root", children: [node("방설정변경")] }; },
      async decorateDefinition(_library: unknown, tree: LobbyDialogNode) { return tree; },
      clone: (target: LobbyDialogNode, fields: Record<string, string>) => ({ ...target, ...fields }),
      nodeName: (target: LobbyDialogNode) => target.name,
      async loadView(settings: Record<string, unknown>) { captured = settings; return view; },
    } satisfies LobbyDialogViewDependencies;
    class Modern { busy = false; view = view; }
    await showLobbyRoomSettings(() => new Modern(), { library: {}, cancel() {} }, mode,
      { name: "房间", password: "" }, () => {}, deps);
    const state = captured!.state as (target: LobbyDialogNode) => Record<string, unknown>;
    assert.equal(state(node("gameType")).text, text, mode);
  }
});
