/**
 * Small blocking overlays for the account flow, styled like the release
 * multiplayer account dialogs: a status line, an error with 重试, and a
 * message with one button.
 */
import {
  accountOverlayStyle, accountPanelStyle, styleAccountButtons,
} from "../multiplayer/account-ui-support";

export interface OverlayDocument {
  body: HTMLElement;
  createElement<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K];
}

function overlay(document: OverlayDocument, title: string, message: string) {
  const element = document.createElement("div");
  element.style.cssText = accountOverlayStyle;
  element.dataset.kartsimAccount = "overlay";
  const panel = document.createElement("div");
  panel.style.cssText = accountPanelStyle;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  const heading = document.createElement("h2");
  heading.textContent = title;
  heading.style.margin = "0";
  const text = document.createElement("div");
  text.textContent = message;
  text.style.cssText = "white-space:pre-line;line-height:1.5";
  panel.append(heading, text);
  element.append(panel);
  document.body.append(element);
  return { element, panel, text };
}

/** A blocking status line; `close` removes it. */
export function showAccountStatus(document: OverlayDocument, title: string,
  message: string): { close(): void; set(message: string): void } {
  const view = overlay(document, title, message);
  view.panel.setAttribute("role", "status");
  return { close: () => view.element.remove(), set: value => { view.text.textContent = value; } };
}

/** A blocking message with one button; resolves when it is pressed. */
export function showAccountMessage(document: OverlayDocument, title: string,
  message: string, buttonText = "重试"): Promise<void> {
  const view = overlay(document, title, message);
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = buttonText;
  styleAccountButtons(button);
  view.panel.append(button);
  button.focus();
  return new Promise(resolve => {
    button.onclick = () => {
      view.element.remove();
      resolve();
    };
  });
}

/** A message with two choices; resolves true for the first. */
export function confirmAccountAction(document: OverlayDocument, title: string,
  message: string, accept: string, cancel = "取消"): Promise<boolean> {
  const view = overlay(document, title, message);
  const yes = document.createElement("button");
  const no = document.createElement("button");
  yes.type = no.type = "button";
  yes.textContent = accept;
  no.textContent = cancel;
  styleAccountButtons(yes, no);
  view.panel.append(yes, no);
  no.focus();
  return new Promise(resolve => {
    yes.onclick = () => { view.element.remove(); resolve(true); };
    no.onclick = () => { view.element.remove(); resolve(false); };
  });
}

/** A self-dismissing toast at the top of the page (level ups, rewards). */
export function showAccountToast(document: OverlayDocument, message: string,
  durationMs = 4_000): void {
  const toast = document.createElement("div");
  toast.setAttribute("role", "status");
  toast.dataset.kartsimAccount = "toast";
  toast.textContent = message;
  toast.style.cssText = "position:fixed;left:50%;top:12%;transform:translateX(-50%);z-index:10001;" +
    "padding:12px 22px;border-radius:8px;background:rgba(8,24,48,.92);color:#fff;" +
    "border:2px solid #ffd54a;box-shadow:0 8px 28px #0008;font:bold 20px sans-serif;" +
    "pointer-events:none;white-space:nowrap;text-shadow:0 1px 2px #000";
  document.body.append(toast);
  const timer = setTimeout(() => toast.remove(), durationMs);
  (timer as { unref?(): void }).unref?.();
}
