import { te } from "../generated/library.js";
import { LOGIN_FIELD_LABELS, LoginForm, type LoginField, type LoginFormRequests } from "../account/login-form";
import type { AccountLoginOptions } from "../multiplayer/account-login-dialog";
import { currentResourceManager } from "../resources/resource-manager";
import { node, nodeName, paintText, prepare, type BmlLibrary, type Node, type NodeState,
  type WindowView } from "./bml-kit";

/**
 * The account windows in the game's look, drawn by the release window
 * renderer like the other dialogs (CaptionDialog, DefaultEdit fields,
 * TextButtons): the startup login / register form (account/login-form.ts)
 * and the login gate's status and 重试 messages. They sit in their own
 * layer over the startup loading screen, sized like the game area.
 */

const ROOTS = ["stage_/common"];
const TEXT = "rgb(42,55,80)";
const WIDTH = 540;
const ROW = { label: 130, edit: 330, height: 32, step: 44 };
const RULES = "账号名 3–24 位字母、数字或下划线；游戏昵称 1–16 字；密码至少 8 位。";

/** The resource library the windows read, once startup has loaded it. */
export function gameWindowLibrary(): BmlLibrary | undefined {
  const library = currentResourceManager()?.library as Partial<BmlLibrary> | undefined;
  return typeof library?.canonicalCandidates === "function" ? library as BmlLibrary : undefined;
}

/**
 * A layer over everything (the startup loading screen is z-index 7): it
 * dims the whole page, and its stage covers exactly the game area, which
 * the release windows take as their 1600×900 stage.
 */
function overlayHost(root: HTMLElement): { element: HTMLElement; dispose(): void } {
  const doc = root.ownerDocument;
  const layer = doc.createElement("div");
  layer.dataset.uiLayer = "account";
  Object.assign(layer.style, { position: "fixed", inset: "0", zIndex: "8", background: "rgba(0,0,0,.45)" });
  const element = doc.createElement("div");
  element.style.position = "absolute";
  layer.append(element);
  const place = () => {
    const rect = root.getBoundingClientRect();
    Object.assign(element.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`,
      height: `${rect.height}px` });
  };
  place();
  const view = doc.defaultView;
  view?.addEventListener("resize", place);
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(place) : undefined;
  observer?.observe(root);
  doc.body.append(layer);
  return { element, dispose: () => {
    view?.removeEventListener("resize", place);
    observer?.disconnect();
    layer.remove();
  } };
}

async function loadWindow(library: BmlLibrary, root: HTMLElement, definition: Node, label: string,
  state: (entry: Node) => NodeState, onCancel?: () => void): Promise<WindowView> {
  return await te.load({ library, root, definition: prepare(library, definition, ROOTS), roots: ROOTS,
    smoothImages: true, modal: true, label, onCancel, state }) as WindowView;
}

/** A TextButton's state: the renderer draws `text`; `label` names it for assistive tech. */
function button(text: string, action: () => void, disabled = false): NodeState {
  return { text, label: text, disabled, ...(disabled ? {} : { action }) };
}

const AUTOCOMPLETE: Record<LoginField, (register: boolean) => string> = {
  username: () => "username",
  nickname: () => "nickname",
  password: register => register ? "new-password" : "current-password",
  confirm: () => "new-password",
  invite: () => "off",
};

export interface LoginWindowText {
  heading: string;
  hint?: string;
}

/** The form's tree for its current mode: a labelled DefaultEdit a field, then the buttons. */
export function loginWindowDefinition(form: LoginForm, text: LoginWindowText): Node {
  const register = form.mode === "register";
  const children: Node[] = [];
  let y = 14;
  if (text.hint) {
    children.push(node("Label", { name: "hint", leftTopWH: `20 ${y} ${WIDTH - 60} 36` }));
    y += 46;
  }
  for (const field of form.fields()) {
    children.push(
      node("Label", { name: `${field}Label`, leftTopWH: `20 ${y} ${ROW.label - 12} ${ROW.height}`, textRender: "bold15",
        textColor: "255 72 106 163", textAlign: "right|vcenter", text: LOGIN_FIELD_LABELS[field] }),
      node("Edit", { name: field, leftTopWH: `${20 + ROW.label} ${y} ${ROW.edit} ${ROW.height}`, frame: "DefaultEdit",
        textRender: "bold16" }),
    );
    y += ROW.step;
  }
  if (register) {
    // One line across the form, under the last field.
    children.push(node("Label", { name: "rules", leftTopWH: `20 ${y - 4} ${WIDTH - 60} 20` }));
    y += 24;
  }
  if (form.inviteToggleShown()) {
    children.push(node("TextButton", { name: "inviteToggle", leftTopWH: `${20 + ROW.label} ${y} 96 22`, frame: "NoFrame",
      textRender: "bold14", textAlign: "left|vcenter" }));
    y += 28;
  }
  children.push(node("Label", { name: "error", leftTopWH: `20 ${y} ${WIDTH - 60} 24` }));
  y += 30;
  const twoButtons = form.canRegister;
  children.push(
    node("Window", { leftTopWH: `0 0 ${WIDTH - 50} 1`, frame: "HSection", align: "hcenter;bottom", adjust: "0 63" }),
    node("TextButton", { name: "submitButton", leftTopWH: "0 0 150 38", align: "hcenter;bottom",
      adjust: twoButtons ? "-84 12" : "0 12", textRender: "bold16" }),
  );
  if (twoButtons) {
    children.push(node("TextButton", { name: "modeButton", leftTopWH: "0 0 150 38", align: "hcenter;bottom",
      adjust: "84 12", textRender: "bold16" }));
  }
  // Caption bar and client margins (CaptionDialog) plus the button strip.
  const height = y + 118;
  return node("Panel", { windowRect: "fullscreen" }, [
    node("CaptionWindow", { name: "loginDialog", windowRect: `0 0 ${WIDTH} ${height}`, frame: "CaptionDialog",
      caption: text.heading, captionPos: "0 1", align: "center", textRender: "bold" }, children),
  ]);
}

/**
 * The startup login / register window; resolves with the signed-in
 * account. It has no close: the player must sign in (no guest path).
 */
export async function openGameLogin(library: BmlLibrary, root: HTMLElement, options: AccountLoginOptions,
  requests: LoginFormRequests): Promise<unknown> {
  const form = new LoginForm(options, requests);
  const host = overlayHost(root);
  let view: WindowView | undefined;
  let finish!: (account: unknown) => void;
  const done = new Promise<unknown>(resolve => { finish = resolve; });
  const heading = () => form.mode === "register" ? "跑跑卡丁车 · 注册新账号" : options.heading ?? "跑跑卡丁车 · 账号登录";
  const render = () => view?.render();
  const submit = async () => {
    if (form.busy) return;
    const pending = form.submit();
    render();
    const account = await pending;
    if (account !== undefined) finish(account);
    else render();
  };
  const state = (entry: Node): NodeState => {
    const name = nodeName(entry);
    const register = form.mode === "register";
    switch (name) {
      case "loginDialog": return { text: heading() };
      case "hint": return paintText(options.hint ?? "", { size: 13, color: TEXT, align: "center", middle: true,
        lineGap: 5 });
      case "rules": return paintText(RULES, { size: 12, color: "rgb(110,120,140)", align: "center", middle: true });
      case "inviteToggle": return { ...button("有邀请码？", () => {
        form.revealInvite();
        void build("invite");
      }, form.busy), textColor: "rgb(30,110,210)" };
      case "error": return paintText(form.busy ? (register ? "正在注册…" : "正在登录…") : form.error, {
        size: 13, color: form.busy ? TEXT : "rgb(205,45,35)", bold: !form.busy, middle: true });
      case "submitButton": return button(register ? "注册并登录" : "登录", () => void submit(), form.busy);
      case "modeButton": return button(register ? "已有账号，去登录"
        : options.invite === "required" || options.invite === undefined ? "用邀请码注册" : "注册新账号", () => {
        form.toggleMode();
        void build();
      }, form.busy);
    }
    if (name in LOGIN_FIELD_LABELS && !name.endsWith("Label")) {
      const field = name as LoginField;
      return { label: LOGIN_FIELD_LABELS[field], disabled: form.busy, input: {
        value: form.values[field], maxLength: form.maxLength(field),
        password: field === "password" || field === "confirm",
        autocomplete: AUTOCOMPLETE[field](register),
        change: (value: string) => form.set(field, value),
        submit: () => void submit(),
      } };
    }
    return {};
  };
  /** Rebuilt when the fields change (mode, 有邀请码？); the values stay in the form. */
  let building = Promise.resolve();
  const build = (focus?: LoginField): Promise<void> => building = building.then(async () => {
    const next = await loadWindow(library, host.element, loginWindowDefinition(form, { heading: heading(),
      hint: options.hint }), heading(), state);
    view?.dispose();
    view = next;
    view.show();
    view.focus(focus ?? form.fields().find(field => !form.values[field]) ?? form.fields()[0]);
  });
  try {
    await build();
    return await done;
  } finally {
    await building.catch(() => undefined);
    view?.dispose();
    host.dispose();
  }
}

function messageDefinition(title: string, withButton: boolean): Node {
  return node("Panel", { windowRect: "fullscreen" }, [
    node("CaptionWindow", { name: "messageDialog", windowRect: `0 0 480 ${withButton ? 230 : 170}`,
      frame: "CaptionDialog", caption: title, captionPos: "0 1", align: "center", textRender: "bold" }, [
      node("Label", { name: "messageText", windowSize: "440 96", adjust: "0 16", align: "hcenter" }),
      ...withButton ? [
        node("Window", { leftTopWH: "0 0 430 1", frame: "HSection", align: "hcenter;bottom", adjust: "0 63" }),
        node("TextButton", { name: "okButton", leftTopWH: "0 0 150 38", align: "hcenter;bottom", adjust: "0 12",
          textRender: "bold16" }),
      ] : [],
    ]),
  ]);
}

/** A message with one button (重试, 重新登录…); resolves when it is chosen. */
export async function showGameMessage(library: BmlLibrary, root: HTMLElement, title: string, text: string,
  buttonText: string): Promise<void> {
  const host = overlayHost(root);
  let chosen!: () => void;
  const done = new Promise<void>(resolve => { chosen = resolve; });
  let view: WindowView | undefined;
  try {
    view = await loadWindow(library, host.element, messageDefinition(title, true), title, entry => {
      switch (nodeName(entry)) {
        case "messageDialog": return { text: title };
        case "messageText": return paintText(text, { size: 14, color: TEXT, align: "center", middle: true, lineGap: 6 });
        case "okButton": return button(buttonText, () => chosen());
      }
      return {};
    });
    view.show();
    view.focus("okButton");
    await done;
  } finally {
    view?.dispose();
    host.dispose();
  }
}

/**
 * A blocking status line (正在连接数据服务…). Shown only when it lasts
 * past a moment, so quick steps do not flash a window.
 */
export function showGameStatus(library: BmlLibrary, root: HTMLElement, title: string, text: string,
  delayMs = 300): { close(): void; set(text: string): void } {
  let message = text;
  let closed = false;
  let view: WindowView | undefined;
  let host: ReturnType<typeof overlayHost> | undefined;
  const timer = setTimeout(() => {
    if (closed) return;
    host = overlayHost(root);
    void loadWindow(library, host.element, messageDefinition(title, false), title, entry => {
      switch (nodeName(entry)) {
        case "messageDialog": return { text: title };
        case "messageText": return paintText(message, { size: 14, color: TEXT, align: "center", middle: true });
      }
      return {};
    }).then(loaded => {
      if (closed) {
        loaded.dispose();
        return;
      }
      view = loaded;
      view.show();
    }).catch(error => console.warn("账号状态窗口打开失败", error));
  }, delayMs);
  return {
    close: () => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      view?.dispose();
      host?.dispose();
    },
    set: value => {
      message = value;
      view?.render();
    },
  };
}
