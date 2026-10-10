/**
 * The account panel opened from the lobby rider (ECONOMY.md 7.8): username,
 * nickname with rename, level and experience, the three balances, race
 * statistics, the registration date and logout. Styled like the release
 * multiplayer account dialogs.
 */
import type { AccountSummary } from "../account/account-session";
import { validateNickname } from "../account/account-api";
import {
  accountErrorMessages, accountOverlayStyle, accountPanelStyle, styleAccountButtons,
} from "../multiplayer/account-ui-support";

export interface AccountPanelSession {
  summary(): AccountSummary | undefined;
  subscribe(listener: () => void): () => void;
  updateNickname(nickname: string): Promise<void>;
}

export interface AccountPanelDocument {
  body: { append(node: HTMLElement): void };
  createElement(tag: string): HTMLElement;
}

export interface AccountPanelOptions {
  document: AccountPanelDocument;
  session: AccountPanelSession;
  /** A reason logout is not possible now (in a multiplayer room or race). */
  logoutBlocked?(): string | undefined;
  onLogout(): void | Promise<void>;
  onClose?(): void;
  onActivate?(): void;
}

export interface AccountPanelHandle {
  readonly element: HTMLElement;
  close(): void;
}

const rowStyle = "display:grid;grid-template-columns:5.5em 1fr;gap:4px 10px;align-items:center";
const inputStyle = "box-sizing:border-box;width:100%;padding:7px;background:#fff;color:#152333;border:0;font:inherit";

function formatNumber(value: number): string {
  return Math.max(0, Math.floor(value)).toLocaleString("en-US");
}

/** "2026-10-07" in local time; "未知" without a date. */
export function formatAccountDate(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "未知";
  const date = new Date(milliseconds);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "1,234 / 5,000" inside the level, or the total at the top level. */
export function formatAccountExperience(progress: AccountSummary["progress"]): string {
  if (progress.nextLevelExp === null) return `${formatNumber(progress.exp)}（已满级）`;
  const span = Math.max(1, progress.nextLevelExp - progress.levelExp);
  const inLevel = Math.max(0, progress.exp - progress.levelExp);
  return `${formatNumber(inLevel)} / ${formatNumber(span)}（累计 ${formatNumber(progress.exp)}）`;
}

/** The panel rows as label/value pairs, in display order. */
export function accountPanelRows(summary: AccountSummary): Array<[string, string]> {
  const { account, progress, wallet, stats } = summary;
  return [
    ["账号名", account.username],
    ["等级", `Lv.${progress.level}${progress.gloveName ? ` ${progress.gloveName}` : ""}`],
    ["经验", formatAccountExperience(progress)],
    ["点券", formatNumber(wallet.coupon)],
    ["金币", formatNumber(wallet.lucci)],
    ["K币", formatNumber(wallet.koin)],
    ["战绩", `比赛 ${formatNumber(stats.races)} 场 · 冠军 ${formatNumber(stats.wins)} · ` +
      `前三 ${formatNumber(stats.podiums)} · 积分 ${formatNumber(stats.points)}`],
    ["注册时间", formatAccountDate(account.createdAt)],
  ];
}

function errorText(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error);
  return accountErrorMessages[code] ?? code;
}

export function openAccountPanel(options: AccountPanelOptions): AccountPanelHandle {
  const { document, session } = options;
  const create = <T extends HTMLElement>(tag: string, text?: string): T => {
    const node = document.createElement(tag) as T;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const overlay = create<HTMLDivElement>("div");
  overlay.style.cssText = accountOverlayStyle;
  overlay.dataset.kartsimAccount = "panel";
  const panel = create<HTMLDivElement>("div");
  panel.style.cssText = accountPanelStyle;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "账号信息");
  const heading = create<HTMLHeadingElement>("h2", "账号信息");
  heading.style.margin = "0";
  const rows = create<HTMLDivElement>("div");
  rows.style.cssText = rowStyle;
  const nickname = create<HTMLInputElement>("input");
  nickname.style.cssText = inputStyle;
  nickname.maxLength = 16;
  nickname.placeholder = "游戏昵称（1–16 字）";
  nickname.setAttribute("aria-label", "游戏昵称");
  const rename = create<HTMLButtonElement>("button", "修改昵称");
  rename.type = "button";
  const message = create<HTMLDivElement>("div");
  message.style.cssText = "min-height:20px;color:#ffb3a9";
  const logout = create<HTMLButtonElement>("button", "退出登录");
  logout.type = "button";
  const close = create<HTMLButtonElement>("button", "关闭");
  close.type = "button";
  styleAccountButtons(rename, logout, close);
  const nameRow = create<HTMLDivElement>("div");
  nameRow.style.cssText = "display:grid;grid-template-columns:1fr auto;gap:8px";
  nameRow.append(nickname, rename);

  let editedName = false;
  nickname.oninput = () => { editedName = true; };
  const render = () => {
    const summary = session.summary();
    if (!summary) return;
    if (!editedName) nickname.value = summary.account.nickname;
    rows.replaceChildren(...accountPanelRows(summary).flatMap(([label, value]) => {
      const name = create<HTMLSpanElement>("span", label);
      name.style.color = "#a9bddf";
      return [name, create<HTMLSpanElement>("span", value)];
    }));
  };
  render();
  const unsubscribe = session.subscribe(render);

  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    unsubscribe();
    overlay.remove();
    options.onClose?.();
  };
  rename.onclick = async () => {
    options.onActivate?.();
    const value = nickname.value;
    const problem = validateNickname(value);
    if (problem) {
      message.textContent = problem;
      return;
    }
    if (value === session.summary()?.account.nickname) {
      message.textContent = "昵称没有变化。";
      return;
    }
    rename.disabled = true;
    message.textContent = "";
    try {
      await session.updateNickname(value);
      editedName = false;
      render();
      message.style.color = "#b8f0a0";
      message.textContent = "昵称已修改。";
    } catch (error) {
      message.style.color = "#ffb3a9";
      message.textContent = errorText(error);
    } finally {
      rename.disabled = false;
    }
  };
  logout.onclick = async () => {
    options.onActivate?.();
    const blocked = options.logoutBlocked?.();
    if (blocked) {
      message.style.color = "#ffb3a9";
      message.textContent = blocked;
      return;
    }
    logout.disabled = true;
    finish();
    await options.onLogout();
  };
  close.onclick = () => {
    options.onActivate?.();
    finish();
  };
  overlay.addEventListener("keydown", event => {
    if ((event as KeyboardEvent).key === "Escape") finish();
  });
  overlay.addEventListener("click", event => {
    if (event.target === overlay) finish();
  });
  panel.append(heading, rows, nameRow, message, logout, close);
  overlay.append(panel);
  document.body.append(overlay);
  close.focus();
  return { element: overlay, close: finish };
}
