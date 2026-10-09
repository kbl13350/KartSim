import assert from "node:assert/strict";
import test from "node:test";

import { gameServerSummary, showGameServerPicker,
  type GameServerPickerDependencies } from "./game-server-dialog";
import type { GameServerOption } from "./game-servers";

class DocumentStub {
  activeElement: ElementStub | null = null;
  body = new ElementStub("body", this);
}

class ElementStub {
  style = { cssText: "", margin: "" };
  children: ElementStub[] = [];
  attributes = new Map<string, string>();
  listeners = new Map<string, Set<(event: unknown) => void>>();
  id = "";
  tabIndex = 0;
  textContent = "";
  type = "";
  name = "";
  value = "";
  checked = false;
  disabled = false;
  removed = false;
  focused = false;
  onclick?: () => void;
  onsubmit?: (event: { preventDefault(): void }) => void;
  constructor(readonly tag: string, readonly document: DocumentStub) {}
  append(...children: ElementStub[]) { this.children.push(...children); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  remove() { this.removed = true; }
  focus() {
    if (this.document.activeElement) this.document.activeElement.focused = false;
    this.focused = true;
    this.document.activeElement = this;
  }
  contains(other: ElementStub | null): boolean {
    return other === this || this.children.some(child => child.contains(other));
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.get(type)?.delete(listener);
  }
  /** Dispatch a keydown and report what the handler did with it. */
  key(key: string, shiftKey = false) {
    const result = { prevented: false, stopped: false };
    const event = { key, shiftKey, preventDefault() { result.prevented = true; },
      stopPropagation() { result.stopped = true; } };
    for (const listener of this.listeners.get("keydown") ?? []) listener(event);
    return result;
  }
}

const server = (nodeId: string, players: number, full = false) => ({
  nodeId, name: `服务器 ${nodeId}`, origin: null, players, rooms: 2, capacity: 400, full,
});

const options: GameServerOption[] = [
  { server: server("game-a", 12) },
  { server: server("game-b", 400, true), unavailable: "已满" },
  { server: server("game-c", 0) },
];

function open(selected: string, signal?: AbortSignal) {
  const document = new DocumentStub();
  const body = document.body;
  const root = { ownerDocument: document } as unknown as HTMLElement;
  let styled = 0;
  const deps: GameServerPickerDependencies = {
    createElement: tag => new ElementStub(tag, document) as unknown as HTMLElement,
    overlayStyle: "overlay-style", panelStyle: "panel-style",
    styleButtons: (...buttons) => { styled += buttons.length; },
  };
  const result = showGameServerPicker(deps, root, options, selected, signal)
    .then(value => ({ value }), (error: Error) => ({ error: error.message }));
  const overlay = body.children[0];
  const form = overlay?.children[0];
  const [heading, description, list, errorText, submit, back] = form?.children ?? [];
  const rows = list?.children ?? [];
  const inputs = rows.map(row => row.children[0]!);
  return { document, body, overlay, form, heading, description, list, errorText, submit,
    back, rows, inputs, result, styled: () => styled };
}

const submitEvent = () => {
  let prevented = false;
  return { event: { preventDefault() { prevented = true; } }, prevented: () => prevented };
};

test("the picker lists every server and preselects the remembered usable one", async () => {
  const view = open("game-c");
  assert.equal(view.overlay!.style.cssText, "overlay-style");
  assert.equal(view.form!.tag, "form");
  assert.equal(view.form!.style.cssText, "panel-style");
  assert.equal(view.heading!.textContent, "选择游戏服务器");
  assert.equal(view.description!.textContent, "想一起玩的玩家请选择同一个服务器。");
  assert.equal(view.list!.attributes.get("role"), "radiogroup");
  assert.equal(view.styled(), 2);
  assert.deepEqual(view.rows.map(row => [row.tag, row.children[1]!.children[0]!.textContent,
    row.children[1]!.children[1]!.textContent]), [
    ["label", "服务器 game-a", "在线 12/400 · 房间 2"],
    ["label", "服务器 game-b", "在线 400/400 · 房间 2 · 已满"],
    ["label", "服务器 game-c", "在线 0/400 · 房间 2"],
  ]);
  assert.deepEqual(view.inputs.map(input => [input.type, input.name, input.value,
    input.checked, input.disabled]), [
    ["radio", "kartsim-game-server", "game-a", false, false],
    ["radio", "kartsim-game-server", "game-b", false, true],
    ["radio", "kartsim-game-server", "game-c", true, false],
  ]);
  assert.equal(view.inputs[2]!.focused, true);
  assert.equal(view.submit!.type, "submit");
  assert.equal(view.submit!.textContent, "进入服务器");
  assert.equal(view.back!.textContent, "返回");

  const submit = submitEvent();
  view.form!.onsubmit!(submit.event);
  assert.equal(submit.prevented(), true);
  assert.deepEqual(await view.result, { value: options[2]!.server });
  assert.equal(view.overlay!.removed, true);
});

test("the player can switch servers before entering", async () => {
  const view = open("game-a");
  view.inputs[0]!.checked = false;
  view.inputs[2]!.checked = true;
  view.form!.onsubmit!(submitEvent().event);
  assert.deepEqual(await view.result, { value: options[2]!.server });
});

test("a full server cannot be submitted even when it was remembered", async () => {
  const view = open("game-b");
  assert.equal(view.inputs[1]!.checked, false);
  assert.equal(view.inputs[0]!.focused, true);
  view.inputs[1]!.checked = true;
  view.form!.onsubmit!(submitEvent().event);
  assert.equal(view.errorText!.textContent, "请选择一个游戏服务器。");
  assert.equal(view.overlay!.removed, false);
  view.inputs[1]!.checked = false;
  view.inputs[0]!.checked = true;
  view.form!.onsubmit!(submitEvent().event);
  assert.deepEqual(await view.result, { value: options[0]!.server });
});

test("back and abort cancel the picker like the account dialogs", async () => {
  const backView = open("game-a");
  backView.back!.onclick!();
  assert.deepEqual(await backView.result, { error: "ACCOUNT_CANCELLED" });
  assert.equal(backView.overlay!.removed, true);

  const controller = new AbortController();
  const aborted = open("game-a", controller.signal);
  controller.abort();
  assert.deepEqual(await aborted.result, { error: "ACCOUNT_CANCELLED" });
  assert.equal(aborted.overlay!.removed, true);

  const early = new AbortController();
  early.abort();
  const never = open("game-a", early.signal);
  assert.equal(never.overlay, undefined);
  assert.deepEqual(await never.result, { error: "ACCOUNT_CANCELLED" });
});

test("server summaries show load and the unavailable reason", () => {
  assert.equal(gameServerSummary({ server: server("game-a", 3) }), "在线 3/400 · 房间 2");
  assert.equal(gameServerSummary({ server: server("game-a", 3), unavailable: "需要 HTTPS" }),
    "在线 3/400 · 房间 2 · 需要 HTTPS");
});

test("the picker is a labelled modal dialog that announces validation errors", () => {
  const view = open("game-a");
  assert.equal(view.form!.attributes.get("role"), "dialog");
  assert.equal(view.form!.attributes.get("aria-modal"), "true");
  assert.equal(view.heading!.id, "kartsim-game-server-title");
  assert.equal(view.form!.attributes.get("aria-labelledby"), view.heading!.id);
  assert.equal(view.errorText!.attributes.get("role"), "alert");
  assert.equal(view.overlay!.tabIndex, -1);
  view.back!.onclick!();
});

test("Escape cancels the picker without reaching the page behind it", async () => {
  const view = open("game-a");
  const other = view.overlay!.key("a");
  assert.deepEqual(other, { prevented: false, stopped: false });
  assert.equal(view.overlay!.removed, false);
  assert.deepEqual(view.overlay!.key("Escape"), { prevented: true, stopped: true });
  assert.deepEqual(await view.result, { error: "ACCOUNT_CANCELLED" });
  assert.equal(view.overlay!.removed, true);
  assert.equal(view.overlay!.listeners.get("keydown")?.size, 0);

  const controller = new AbortController();
  const aborted = open("game-a", controller.signal);
  controller.abort();
  await aborted.result;
  assert.equal(aborted.overlay!.listeners.get("keydown")?.size, 0);
});

test("Tab and Shift+Tab stay inside the picker", async () => {
  const view = open("game-c");
  const radio = view.inputs[2]!;
  assert.equal(view.document.activeElement, radio);
  // Moving between the radio group and the buttons is left to the browser.
  assert.deepEqual(view.overlay!.key("Tab"), { prevented: false, stopped: false });
  view.submit!.focus();
  assert.deepEqual(view.overlay!.key("Tab", true), { prevented: false, stopped: false });
  // Tab past 返回 wraps to the selected server.
  view.back!.focus();
  assert.equal(view.overlay!.key("Tab").prevented, true);
  assert.equal(view.document.activeElement, radio);
  // Shift+Tab from the radio group wraps to 返回.
  view.inputs[0]!.focus();
  assert.equal(view.overlay!.key("Tab", true).prevented, true);
  assert.equal(view.document.activeElement, view.back);
  // Focus on the backdrop (outside the panel) is pulled back in.
  view.overlay!.focus();
  assert.equal(view.overlay!.key("Tab").prevented, true);
  assert.equal(view.document.activeElement, radio);
  view.overlay!.focus();
  assert.equal(view.overlay!.key("Tab", true).prevented, true);
  assert.equal(view.document.activeElement, view.back);
  // With nothing selected, Tab past 返回 goes to the first usable server.
  radio.checked = false;
  view.back!.focus();
  view.overlay!.key("Tab");
  assert.equal(view.document.activeElement, view.inputs[0]);
  view.back!.onclick!();
  assert.deepEqual(await view.result, { error: "ACCOUNT_CANCELLED" });
});
