import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { chooseGuestNickname, type GuestNicknameDependencies } from
  "./guest-nickname";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("async function PT(");
const end = release.indexOf("\nfunction Al0(", start);
assert.ok(start >= 0 && end > start);
const originalFunction = release.slice(start, end);

type Variant = "existing-valid" | "existing-unavailable" |
  "existing-invalid" | "existing-network-error" | "forced" |
  "fresh" | "ui-unavailable" | "ui-invalid" |
  "ui-network-error" | "back" | "aborted" | "preaborted";

async function observe(rewritten: boolean, variant: Variant) {
  const events: unknown[][] = [];
  class ElementStub {
    style = { cssText: "", margin: "" };
    children: ElementStub[] = [];
    textContent = "";
    value = "";
    placeholder = "";
    maxLength = 0;
    type = "";
    disabled = false;
    removed = false;
    onclick?: () => void;
    onsubmit?: (event: { preventDefault(): void }) => Promise<void>;
    constructor(readonly tag: string) { events.push(["element", tag]); }
    append(...children: ElementStub[]) {
      events.push(["append", this.tag, children.map(child => child.tag)]);
      this.children.push(...children);
    }
    remove() { this.removed = true; events.push(["remove", this.tag]); }
    focus() { events.push(["focus", this.tag]); }
  }
  const documentStub = { createElement: (tag: string) => new ElementStub(tag) };
  const body = new ElementStub("body");
  const root = { ownerDocument: { body } } as unknown as HTMLElement;
  const controller = new AbortController();
  if (variant === "preaborted") controller.abort();
  const previousName = variant.startsWith("existing") || variant === "forced"
    ? variant === "existing-invalid" ? "bad " : "old" : "";
  const fetchStub = async (url: string, options: Record<string, unknown>) => {
    events.push(["fetch", url, options.method, options.credentials,
      options.headers, options.body, options.signal === controller.signal]);
    const name = (JSON.parse(options.body as string) as { name: string }).name;
    return { ok: variant !== "existing-network-error" &&
      variant !== "ui-network-error",
    async json() { events.push(["json", name]);
      return { error: "TAKEN", available: variant === "ui-unavailable"
        ? false : variant === "existing-unavailable" && name === "old"
          ? false : true };
    } };
  };
  const styleButtons = (...buttons: HTMLButtonElement[]) => {
    events.push(["buttons", buttons.length]);
  };
  const formatError = (error: unknown) => `显示：${(error as Error).message}`;
  const deps = {
    createElement: documentStub.createElement as unknown as
      (tag: string) => HTMLElement,
    overlayStyle: "overlay-style", panelStyle: "panel-style",
    styleButtons,
    endpoint(action: string) { events.push(["endpoint", action]);
      return `https://api.example.com/${action}`; },
    fetch: fetchStub,
    errorMessages: { TAKEN: "昵称不可用" },
    formatError,
  } satisfies GuestNicknameDependencies;
  const Original = new Function("fetch", "ly", "uy", "document", "B7", "R7",
    "G7", "C6", `${originalFunction}\nreturn PT;`)(
      fetchStub, deps.endpoint, deps.errorMessages, documentStub,
      deps.overlayStyle, deps.panelStyle, styleButtons, formatError,
    ) as (root: HTMLElement, name: string, signal: AbortSignal,
      force: boolean) => Promise<string>;
  const pending = rewritten
    ? chooseGuestNickname(deps, root, previousName, controller.signal,
      variant === "forced")
    : Original(root, previousName, controller.signal, variant === "forced");
  const settlement = pending.then(value => ({ value }), error =>
    ({ error: (error as Error).message }));
  await new Promise<void>(resolve => setImmediate(resolve));
  const overlay = body.children[0];
  let ui: Record<string, unknown> | undefined;
  if (overlay) {
    const form = overlay.children[0]!;
    const [, description, input, errorText, submit, back] = form.children;
    const initial = { description: description!.textContent,
      value: input!.value, maxLength: input!.maxLength,
      placeholder: input!.placeholder };
    if (variant === "aborted") controller.abort();
    else if (variant === "back") back!.onclick?.();
    else {
      input!.value = variant === "ui-invalid" ? "<bad>" : "fresh";
      await form.onsubmit?.({ preventDefault() { events.push(["prevent-default"]); } });
      if (["ui-unavailable", "ui-invalid", "ui-network-error"]
        .includes(variant)) back!.onclick?.();
    }
    ui = { initial, errorText: errorText!.textContent,
      submitDisabled: submit!.disabled, removed: overlay.removed };
  }
  return { events, result: await settlement, ui };
}

test("guest nickname reuse, validation, dialog and cancellation match release", async () => {
  for (const variant of ["existing-valid", "existing-unavailable",
    "existing-invalid", "existing-network-error", "forced", "fresh",
    "ui-unavailable", "ui-invalid", "ui-network-error", "back",
    "aborted", "preaborted"] as const) {
    assert.deepEqual(await observe(true, variant),
      await observe(false, variant), variant);
  }
});
