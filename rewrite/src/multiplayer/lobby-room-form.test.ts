import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { showLobbyRoomCreationForm, type LobbyRoomFormDependencies } from
  "./lobby-room-form";
import { roomChannelKey, roomChannelNames, roomStyleDropdown } from
  "./lobby-room-options";
import type { LobbyDialogNode } from "./lobby-dialog-views";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const optionsStart = release.indexOf("function NT(");
const classStart = release.indexOf("class b1 {", optionsStart);
const classEnd = release.indexOf("\nconst $l0 =", classStart);
assert.ok(optionsStart >= 0 && classStart > optionsStart && classEnd > classStart);
const originalFunctions = release.slice(optionsStart, classStart);
const originalClass = release.slice(classStart, classEnd);

type Variant = "ordinary" | "channel" | "roadblock" | "missing-root" |
  "missing-style" | "missing-capacity";

async function observe(rewritten: boolean, variant: Variant) {
  const events: unknown[][] = [];
  const ordinary = { speedIndiCombine: "个人竞速", speedTeamCombine: "组队竞速" };
  const rp = { speedIndiCombine: "RP 竞速" };
  const modes = { speedIndiCombine: { mode: "individual" as const },
    speedTeamCombine: { mode: "team" as const } };
  const node = (name: string, children: LobbyDialogNode[] = [],
    extra: Record<string, unknown> = {}): LobbyDialogNode =>
    ({ name, children, ...extra });
  const rows = ["2", "3", "4", "5", "6", "7", "8"].map(value =>
    node(`row${value}`, [], { text: `${value} players` }));
  const joinNum = node("joinNum", [node("Skip", rows)],
    { frame: "frame", listFrame: "list" });
  const roomRoot = node("방만들기", [
    ...(variant === "missing-style" ? [] : [node("gameStyle")]),
    ...(variant === "missing-capacity" ? [] : [joinNum]),
    node("joinTeamGame"), node("roomName"), node("roomPassword"),
    node("isPassword"), node("createRoom"), node("cancelRoom"),
    node("warningGreenAuth"),
  ]);
  const definition = node("root", variant === "missing-root" ? [] : [roomRoot]);
  const library = { id: "library" };
  const options = { library, cancel() { events.push(["cancel"]); } };
  let settings: Record<string, unknown> | undefined;
  const view = { show() { events.push(["show"]); },
    focus(target?: string) { events.push(["focus", target]); },
    render() { events.push(["render"]); },
    dispose() { events.push(["dispose"]); },
  };
  const attribute = (target: LobbyDialogNode, name: string) =>
    target[name] as string | undefined;
  const clone = (target: LobbyDialogNode,
    fields: Record<string, string>, children?: LobbyDialogNode[]) => {
    events.push(["clone", target.name, fields, children?.length]);
    return { ...target, ...fields, children: children ?? target.children };
  };
  const deps = {
    async loadMessageTemplate() { throw new Error("unused"); },
    async loadDefinition(_library: unknown, folder: string, name: string) {
      events.push(["definition", _library === library, folder, name]);
      return definition;
    },
    async decorateDefinition(_library: unknown, tree: LobbyDialogNode,
      folder: string) {
      events.push(["decorate", _library === library, tree.name, folder]);
      return tree;
    },
    clone,
    nodeName: (target: LobbyDialogNode) => attribute(target, "name"),
    attribute,
    async loadView(options: Record<string, unknown>) {
      settings = options;
      events.push(["view", options.roots, options.label,
        JSON.stringify(options.definition)]);
      return view;
    },
    channelNames: (gameplay: string) => roomChannelNames(gameplay, ordinary, rp),
    channelKey: roomChannelKey,
    dropdown: (combo: LobbyDialogNode, template: LobbyDialogNode,
      values: string[]) => roomStyleDropdown(combo, template, values,
        { attribute, clone }),
    channelMode: (key: string) => modes[key as keyof typeof modes].mode,
  } satisfies LobbyRoomFormDependencies;
  const Original = new Function("H6", "lw", "He", "T", "h2", "F9", "C8",
    "te", `${originalFunctions}\n${originalClass}\nreturn b1;`)(
      ordinary, rp, modes, attribute, clone, deps.loadDefinition,
      deps.decorateDefinition, { load: deps.loadView },
    ) as unknown as { createForm(options: unknown,
      mode: string, nickname: string,
      submit: (value: unknown, channel?: string) => void,
      channel?: string, gameplay?: string): Promise<{
        busy: boolean; view: typeof view;
      }> };
  class Modern {
    busy = false;
    view = view;
  }
  const channel = variant === "channel" || variant === "roadblock"
    || variant === "missing-style" || variant === "missing-capacity"
    ? "speedIndiCombine" : undefined;
  const gameplay = variant === "roadblock" ? "roadblock" : "ordinary";
  const submit = (value: unknown, selected?: string) =>
    events.push(["submit", value, selected]);
  let dialog: { busy: boolean; view: typeof view } | undefined;
  let error: string | undefined;
  try {
    dialog = rewritten
      ? await showLobbyRoomCreationForm(() => new Modern(), options,
        "individual", "玩家甲", submit, channel, gameplay, deps)
      : await Original.createForm(options, "individual", "玩家甲",
        submit, channel, gameplay);
  } catch (failure) { error = (failure as Error).message; }
  if (!dialog || !settings) return { events, error };
  const state = settings.state as (node: LobbyDialogNode) => Record<string, unknown>;
  const snapshots: unknown[] = [];
  const field = (name: string) => state(node(name));
  snapshots.push({ style: field("gameStyle").text ??
    (field("gameStyle").select as { value: string } | undefined)?.value,
  capacity: (field("joinNum").select as { values: string[] }).values,
  teamVisible: field("joinTeamGame").visible,
  roomName: (field("roomName").input as { value: string }).value });
  if (variant === "channel") {
    ((field("joinNum").select as { change(value: string): void }).change)("5");
    ((field("gameStyle").select as { change(value: string): void }).change)(
      "组队竞速");
    snapshots.push({ style: (field("gameStyle").select as { value: string }).value,
      capacity: (field("joinTeamGame").select as { value: string }).value,
      teamVisible: field("joinTeamGame").visible });
  }
  ((field("roomName").input as { change(value: string): void }).change)("  房间  ");
  (field("isPassword").action as () => void)();
  ((field("roomPassword").input as { change(value: string): void }).change)("1234");
  (field("createRoom").action as () => void)();
  dialog.busy = true;
  (field("createRoom").action as () => void)();
  (settings.onCancel as () => void)();
  snapshots.push({ disabled: field("createRoom").disabled,
    passwordEnabled: field("isPassword").checked });
  dialog.busy = false;
  (settings.onCancel as () => void)();
  return { events, error, snapshots };
}

test("lobby room creation form template, modes, input and guards match release", async () => {
  for (const variant of ["ordinary", "channel", "roadblock",
    "missing-root", "missing-style", "missing-capacity"] as const) {
    assert.deepEqual(await observe(true, variant),
      await observe(false, variant), variant);
  }
});
