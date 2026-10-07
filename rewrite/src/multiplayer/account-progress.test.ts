import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { showAccountServiceProgress, type AccountProgressNode,
  type AccountProgressRoot, type AccountProgressSignal } from
  "./account-progress";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("function vl0(");
const end = release.indexOf("\nasync function Xo(", start);
assert.ok(start >= 0 && end > start);
const source = release.slice(start, end);

type Scenario = "no-body" | "button" | "abort" | "direct";

async function observe(rewritten: boolean, scenario: Scenario) {
  const events: unknown[][] = [];
  class FakeNode implements AccountProgressNode {
    style = { cssText: "", margin: "" };
    textContent = "";
    hidden = false;
    type = "";
    onclick: (() => void) | null = null;
    children: FakeNode[] = [];
    attributes: Record<string, string> = {};
    constructor(readonly tag: string) {}
    setAttribute(name: string, value: string) {
      events.push(["attribute", this.tag, name, value]);
      this.attributes[name] = value;
    }
    append(...children: FakeNode[]) {
      events.push(["append", this.tag, children.map(child => child.tag)]);
      this.children.push(...children);
    }
    remove() { events.push(["remove", this.tag]); }
  }
  const body = new FakeNode("body");
  const created: FakeNode[] = [];
  const document = {
    body: scenario === "no-body" ? undefined : body,
    createElement(tag: string) {
      events.push(["create", tag]);
      const element = new FakeNode(tag);
      created.push(element);
      return element;
    },
  };
  const root = { ownerDocument: document };
  const listeners = new Set<() => void>();
  const signal = {
    addEventListener(type: "abort", listener: () => void,
      options?: { once: boolean }) {
      events.push(["listen", type, options]);
      listeners.add(listener);
    },
    removeEventListener(type: "abort", listener: () => void) {
      events.push(["unlisten", type]);
      listeners.delete(listener);
    },
  };
  const styleButtons = (button: AccountProgressNode) => {
    events.push(["button-style"]);
    button.style.cssText = "button-css";
  };
  const dependencies = {
    overlayStyle: "overlay-css", panelStyle: "panel-css", styleButtons,
  };
  const original = new Function("B7", "R7", "G7",
    `${source}\nreturn vl0;`)(
      dependencies.overlayStyle, dependencies.panelStyle, styleButtons,
    ) as (host: AccountProgressRoot, abort: AccountProgressSignal) => {
      close(): void; fail(message: string): Promise<void>;
    };
  const session = rewritten
    ? showAccountServiceProgress(root, signal, dependencies)
    : original(root, signal);
  let pending = false;
  let resolved = false;
  if (scenario !== "no-body" && scenario !== "direct") {
    pending = true;
    const result = session.fail("无法连接").then(() => { resolved = true; });
    await Promise.resolve();
    assert.equal(resolved, false);
    if (scenario === "button") created.find(node => node.tag === "button")!.onclick?.();
    else for (const listener of [...listeners]) listener();
    await result;
  } else {
    session.close();
    await session.fail("不会显示");
  }
  session.close();
  const snapshot = created.map(element => ({
    tag: element.tag, text: element.textContent, hidden: element.hidden,
    type: element.type, style: element.style, attributes: element.attributes,
    children: element.children.map(child => child.tag),
    hasClick: !!element.onclick,
  }));
  return { events, snapshot, pending, resolved, listeners: listeners.size };
}

test("multiplayer account progress close, fail and abort match release", async () => {
  for (const scenario of ["no-body", "button", "abort", "direct"] as const) {
    assert.deepEqual(await observe(true, scenario), await observe(false, scenario),
      scenario);
  }
});
