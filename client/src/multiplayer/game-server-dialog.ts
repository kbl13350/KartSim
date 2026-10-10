/** Game server picker shown before entering the lobby when several servers are open. */

import type { GameServer, GameServerOption } from "./game-servers";

export interface GameServerPickerDependencies {
  createElement(tag: string): HTMLElement;
  overlayStyle: string;
  panelStyle: string;
  styleButtons(...buttons: HTMLButtonElement[]): void;
}

const listStyle =
  "display:grid;gap:6px;max-height:min(50vh,360px);overflow-y:auto;overscroll-behavior:contain";
const rowStyle =
  "display:flex;align-items:center;gap:10px;padding:8px 10px;background:#1a2b40;border:1px solid #5599d5;cursor:pointer";
const unavailableRowStyle =
  "display:flex;align-items:center;gap:10px;padding:8px 10px;background:#1a2b40;border:1px solid #4a5a6c;opacity:.55;cursor:not-allowed";

/** "在线 12/400 · 房间 3", plus why the server cannot be chosen. */
export function gameServerSummary(option: GameServerOption): string {
  const { players, capacity, rooms } = option.server;
  return `在线 ${players}/${capacity} · 房间 ${rooms}` +
    (option.unavailable ? ` · ${option.unavailable}` : "");
}

const HEADING_ID = "kartsim-game-server-title";

/**
 * Let the player choose a server. Unavailable servers are listed but cannot be
 * selected; "返回", Escape and the abort signal reject with ACCOUNT_CANCELLED
 * like the other account dialogs. The panel is a modal dialog: Tab and
 * Shift+Tab stay inside it.
 */
export function showGameServerPicker(dependencies: GameServerPickerDependencies,
  root: HTMLElement, options: GameServerOption[], selected: string,
  signal?: AbortSignal): Promise<GameServer> {
  if (signal?.aborted) return Promise.reject(new Error("ACCOUNT_CANCELLED"));
  return new Promise<GameServer>((resolve, reject) => {
    const overlay = dependencies.createElement("div");
    const form = dependencies.createElement("form") as HTMLFormElement;
    overlay.style.cssText = dependencies.overlayStyle;
    // Clicking the backdrop keeps focus (and so Escape and Tab) in the picker.
    overlay.tabIndex = -1;
    form.style.cssText = dependencies.panelStyle;
    form.setAttribute("role", "dialog");
    form.setAttribute("aria-modal", "true");
    form.setAttribute("aria-labelledby", HEADING_ID);
    const heading = dependencies.createElement("h2");
    heading.id = HEADING_ID;
    heading.textContent = "选择游戏服务器";
    heading.style.margin = "0";
    const description = dependencies.createElement("div");
    description.textContent = "想一起玩的玩家请选择同一个服务器。";
    const list = dependencies.createElement("div");
    list.style.cssText = listStyle;
    list.setAttribute("role", "radiogroup");
    list.setAttribute("aria-label", "游戏服务器");

    const choices: Array<{ input: HTMLInputElement; server: GameServer }> = [];
    for (const option of options) {
      const row = dependencies.createElement("label");
      row.style.cssText = option.unavailable ? unavailableRowStyle : rowStyle;
      const input = dependencies.createElement("input") as HTMLInputElement;
      input.type = "radio";
      input.name = "kartsim-game-server";
      input.value = option.server.nodeId;
      input.disabled = !!option.unavailable;
      input.checked = !option.unavailable && option.server.nodeId === selected;
      const text = dependencies.createElement("span");
      text.style.cssText = "display:grid;gap:2px;flex:1;min-width:0";
      const name = dependencies.createElement("span");
      name.textContent = option.server.name;
      name.style.cssText = "overflow-wrap:anywhere;font-weight:bold";
      const summary = dependencies.createElement("span");
      summary.textContent = gameServerSummary(option);
      summary.style.cssText = "font-size:14px;color:#c8d8ea";
      text.append(name, summary);
      row.append(input, text);
      list.append(row);
      if (!option.unavailable) choices.push({ input, server: option.server });
    }

    const errorText = dependencies.createElement("div");
    errorText.style.cssText = "min-height:20px;color:#ffb3a9";
    errorText.setAttribute("role", "alert");
    const submit = dependencies.createElement("button") as HTMLButtonElement;
    submit.type = "submit";
    submit.textContent = "进入服务器";
    const back = dependencies.createElement("button") as HTMLButtonElement;
    back.type = "button";
    back.textContent = "返回";
    dependencies.styleButtons(submit, back);

    /** The radio group is one tab stop: the checked radio, else the first one. */
    const firstStop = () =>
      (choices.find(entry => entry.input.checked) ?? choices[0])?.input ?? submit;
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
      overlay.removeEventListener("keydown", onKey);
      overlay.remove();
    };
    const onAbort = () => {
      cleanup();
      reject(new Error("ACCOUNT_CANCELLED"));
    };
    // Handled on the overlay so the window's Escape-to-pause never sees it.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onAbort();
        return;
      }
      if (event.key !== "Tab") return;
      const active = root.ownerDocument.activeElement;
      const radio = choices.some(entry => entry.input === active);
      if (event.shiftKey ? radio || active === firstStop() || !form.contains(active)
        : active === back || !form.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? back : firstStop()).focus();
      }
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    overlay.addEventListener("keydown", onKey);
    back.onclick = onAbort;
    form.onsubmit = event => {
      event.preventDefault();
      const choice = choices.find(entry => entry.input.checked);
      if (!choice) {
        errorText.textContent = "请选择一个游戏服务器。";
        return;
      }
      cleanup();
      resolve(choice.server);
    };
    form.append(heading, description, list, errorText, submit, back);
    overlay.append(form);
    root.ownerDocument.body.append(overlay);
    firstStop().focus();
  });
}
