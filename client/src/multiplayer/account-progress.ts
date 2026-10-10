/** Blocking status view while multiplayer account services are checked. */

export interface AccountProgressNode {
  style: { cssText: string; margin: string };
  textContent: string;
  hidden: boolean;
  type: string;
  onclick: (() => void) | null;
  setAttribute(name: string, value: string): void;
  append(...children: AccountProgressNode[]): void;
  remove(): void;
}

export interface AccountProgressRoot {
  ownerDocument?: {
    body?: AccountProgressNode;
    createElement(tag: string): AccountProgressNode;
  };
}

export interface AccountProgressSignal {
  addEventListener(type: "abort", listener: () => void,
    options?: { once: boolean }): void;
  removeEventListener(type: "abort", listener: () => void): void;
}

export interface AccountProgressDependencies {
  overlayStyle: string;
  panelStyle: string;
  styleButtons(button: AccountProgressNode): void;
}

export interface AccountProgressSession {
  close(): void;
  fail(message: string): Promise<void>;
}

export function showAccountServiceProgress(root: AccountProgressRoot,
  signal: AccountProgressSignal | undefined,
  dependencies: AccountProgressDependencies): AccountProgressSession {
  const body = root.ownerDocument?.body;
  if (!body) return { close: () => {}, fail: async () => {} };
  const overlay = root.ownerDocument!.createElement("div");
  const panel = root.ownerDocument!.createElement("div");
  overlay.style.cssText = dependencies.overlayStyle;
  panel.style.cssText = dependencies.panelStyle;
  panel.setAttribute("role", "status");
  const heading = root.ownerDocument!.createElement("h2");
  heading.textContent = "多人游戏";
  heading.style.margin = "0";
  const message = root.ownerDocument!.createElement("div");
  message.textContent = "正在检查联机服务…";
  const back = root.ownerDocument!.createElement("button");
  back.type = "button";
  back.textContent = "返回";
  back.hidden = true;
  dependencies.styleButtons(back);
  panel.append(heading, message, back);
  overlay.append(panel);
  body.append(overlay);

  let closed = false;
  let resolveDismissal: (() => void) | undefined;
  const dismissed = new Promise<void>(resolve => { resolveDismissal = resolve; });
  const close = () => {
    if (closed) return;
    closed = true;
    signal?.removeEventListener("abort", close);
    overlay.remove();
    resolveDismissal?.();
  };
  back.onclick = close;
  signal?.addEventListener("abort", close, { once: true });
  return {
    close,
    fail: async error => {
      if (!closed) {
        message.textContent = error;
        back.hidden = false;
        await dismissed;
      }
    },
  };
}
