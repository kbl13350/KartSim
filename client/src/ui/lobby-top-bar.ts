import type { AccountSession, AccountSummary } from "../account/account-session";
import { loadLevelGloveArt, loadLobbyTopBarArt, type LobbyTopBarArt, type TopBarArtLibrary } from "./lobby-top-bar-assets";

/**
 * The lobby status bar (ECONOMY.md 7.5): the rider's level glove, level,
 * name and experience on the left, the three wallets with their "+" buttons
 * on the right. The lobby home shows it (lobby-home-view.ts); the shop draws
 * the same bar when it opens where the lobby is not in view, as the original
 * keeps the lobby's top bar over its mall.
 *
 * Sizes are container query units of the lobby area (the screen above the
 * taskbar): the bar's host must be a size container of that area.
 */

export interface LobbyWallet { coupon: number; lucci: number; koin: number }

/** Experience inside the current level (ECONOMY.md 1): levelExp → nextLevelExp. */
export interface LobbyExperience {
  exp: number;
  levelExp: number;
  /** null at the top level. */
  nextLevelExp: number | null;
}

/** The signed-in account shown in the status bar (ECONOMY.md 7.5). */
export interface LobbyAccountInfo {
  riderName: string;
  level: number;
  /** The level glove (DataPack1 etc_/level/<glove>.png) and its name, e.g. 黄色手套5. */
  glove?: { image: string; name: string };
  experience?: LobbyExperience;
  wallet: LobbyWallet;
}

export type LobbyChargeCurrency = "coupon" | "koin";

export interface LobbyTopBarOptions {
  riderName: string;
  /** The account level; Lv.1 before one is known. */
  level?: number;
  wallet?: Partial<LobbyWallet>;
  experience?: LobbyExperience;
  /** The "+" beside 点券 and K币; without it they give onNotice 商城充值暂未开放. */
  onCharge?(currency: LobbyChargeCurrency): void;
  /** Clicking the rider glove, level or name (the account panel); without it they are not a button. */
  onAccount?(): void;
  /** A short notice of the bar's own (the "+" without onCharge). */
  onNotice?(message: string): void;
  onHover?(): void;
  onActivate?(): void;
}

let styleInstalled = false;

/** The bar's styles; cqh/cqw are the lobby area's. */
export const LOBBY_TOP_BAR_STYLES = `
.ks-lobby-top{position:absolute;left:0;right:0;top:0;height:4.7cqh;display:flex;align-items:center;
  justify-content:space-between;padding:0 .8cqw;box-sizing:border-box;color:#fff;user-select:none;
  font-family:var(--ks-lobby-font,"PingFang SC"),"PingFang SC","Microsoft YaHei",sans-serif;
  background:linear-gradient(180deg,rgba(6,16,36,.82),rgba(6,16,36,.62));font-size:1.95cqh;
  text-shadow:0 .1cqh .2cqh rgba(0,0,0,.6)}
:where(.ks-lobby-top button){font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer}
:where(.ks-lobby-top button):focus-visible{outline:.3cqh solid #ffe66b;outline-offset:.2cqh}
.ks-lobby-player,.ks-lobby-wallet,.ks-lobby-coin{display:flex;align-items:center}
.ks-lobby-player{gap:.6cqh}
.ks-lobby-icon{display:grid;place-items:center;flex:none;width:2.7cqh;height:2.7cqh}
.ks-lobby-icon>*{width:100%;height:100%;object-fit:contain}
.ks-lobby-player .ks-lobby-icon{width:3.6cqh;height:3.6cqh}
.ks-lobby-level{color:rgb(174,244,46)}
button.ks-lobby-player{border-radius:.4cqh;padding:.2cqh .5cqh .2cqh .2cqh;margin-left:-.2cqh}
button.ks-lobby-player:hover{background:rgba(255,255,255,.14)}
.ks-lobby-exp{position:relative;display:inline-block;width:8.5cqw;height:1.55cqh;margin-left:.5cqh;
  border-radius:.8cqh;background:rgba(0,0,0,.5);border:.1cqh solid rgba(255,255,255,.45);overflow:hidden}
.ks-lobby-exp[hidden]{display:none}
.ks-lobby-exp>i{position:absolute;left:0;top:0;bottom:0;width:0;
  background:linear-gradient(90deg,#3fb2ff,#7ef0ff);transition:width .4s ease}
.ks-lobby-exp>b{position:absolute;inset:0;display:grid;place-items:center;font-size:1.1cqh;font-weight:normal;
  letter-spacing:.02em;text-shadow:0 0 .2cqh #000,0 0 .2cqh #000;white-space:nowrap}
.ks-lobby-wallet{gap:1.7cqw}
.ks-lobby-coin{gap:.6cqh;font-variant-numeric:tabular-nums}
.ks-lobby-coin>span:not(.ks-lobby-icon){min-width:3.2cqw;text-align:right}
.ks-lobby-plus{width:2.4cqh;height:2.4cqh;display:grid;place-items:center;border:.12cqh solid rgba(255,255,255,.7);
  border-radius:.25cqh;font-size:2.2cqh;line-height:1}
.ks-lobby-plus:hover{background:rgba(255,255,255,.18)}
.ks-lobby-plus.ks-art{width:2.8cqh;height:2.8cqh;border:0;border-radius:0;color:transparent;text-shadow:none;
  background:var(--ks-charge-1) center/contain no-repeat}
.ks-lobby-plus.ks-art:hover{background-image:var(--ks-charge-2)}
.ks-lobby-plus.ks-art:active{background-image:var(--ks-charge-3)}
`;

export function installLobbyTopBarStyles(): void {
  if (styleInstalled || typeof document === "undefined") return;
  styleInstalled = true;
  const style = document.createElement("style");
  style.dataset.kartsim = "lobby-top-bar";
  style.textContent = LOBBY_TOP_BAR_STYLES;
  document.head.append(style);
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string,
  text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg(markup: string): SVGSVGElement {
  const wrapper = document.createElement("span");
  wrapper.innerHTML = markup;
  const icon = wrapper.firstElementChild as SVGSVGElement;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

/** Drawn icons until the release art (lobby-top-bar-assets.ts) arrives. */
const ICONS = {
  rider: `<svg viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="4" fill="#58b830"/>
    <path d="M6 15c0-4 2.7-7 6-7s6 3 6 7v3H6z" fill="#fff"/><rect x="8" y="12" width="8" height="3" rx="1.2" fill="#2f6f1a"/></svg>`,
  coupon: `<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="18" rx="4" fill="#5d6675" stroke="#d9dee8" stroke-width="1.5"/>
    <path d="M15.5 9.2A4.5 4.5 0 1 0 15.5 14.8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  lucci: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f6b51e" stroke="#c97f06" stroke-width="1.6"/>
    <circle cx="12" cy="12" r="6.2" fill="none" stroke="#ffe08a" stroke-width="1.6"/><circle cx="12" cy="12" r="2.4" fill="#ffe08a"/></svg>`,
  koin: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#2fbf8f" stroke="#1a7f5d" stroke-width="1.6"/>
    <path d="M9 7v10M9 12l5-5M9 12l5 5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

function formatAmount(value: number | undefined): string {
  return Math.max(0, Math.floor(value ?? 0)).toLocaleString("en-US");
}

/** The status bar element and its live fields. */
export class LobbyTopBar {
  readonly element = element("header", "ks-lobby-top");
  /** Status bar icon slots; release art replaces the drawn fallbacks. */
  private readonly icons = new Map<"level" | "cash" | "lucci" | "koin", HTMLElement>();
  private readonly chargeButtons: HTMLButtonElement[] = [];
  private readonly levelText = element("span", "ks-lobby-level");
  private readonly nameText = element("span", "ks-lobby-name");
  private readonly experience = element("span", "ks-lobby-exp");
  private readonly coins = new Map<keyof LobbyWallet, { entry: HTMLElement; value: HTMLElement;
    label: string }>();
  private gloveImage?: string;

  constructor(readonly options: LobbyTopBarOptions) {
    installLobbyTopBarStyles();
    this.build();
  }

  /** Swap the drawn status bar icons for the release level glove, currency and "+" art. */
  setTopBarArt(art: LobbyTopBarArt): void {
    const replace = (slot: "level" | "cash" | "lucci" | "koin", source: string | undefined,
      title?: string): void => {
      const holder = this.icons.get(slot);
      if (!holder || !source) return;
      const image = element("img");
      image.src = source;
      image.alt = "";
      image.draggable = false;
      if (title) holder.title = title;
      holder.replaceChildren(image);
    };
    replace("level", art.level?.image, art.level?.name);
    replace("cash", art.cash);
    replace("lucci", art.lucci);
    replace("koin", art.koin);
    if (art.charge?.length === 4) {
      for (const button of this.chargeButtons) {
        art.charge.forEach((state, index) =>
          button.style.setProperty(`--ks-charge-${index + 1}`, `url("${state}")`));
        button.classList.add("ks-art");
      }
    }
  }

  /** Update the rider name, level, glove, experience bar and wallet in place. */
  setAccount(account: LobbyAccountInfo): void {
    this.levelText.textContent = `Lv.${Math.max(1, Math.floor(account.level))}`;
    this.nameText.textContent = account.riderName;
    this.renderExperience(account.experience);
    for (const [currency, coin] of this.coins) {
      const amount = formatAmount(account.wallet[currency]);
      coin.value.textContent = amount;
      coin.entry.setAttribute("aria-label", `${coin.label} ${amount}`);
    }
    if (account.glove && account.glove.image !== this.gloveImage) {
      this.gloveImage = account.glove.image;
      this.setTopBarArt({ level: account.glove });
    }
  }

  private renderExperience(experience: LobbyExperience | undefined): void {
    const bar = this.experience;
    if (!experience) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    const span = experience.nextLevelExp === null
      ? 0 : Math.max(1, experience.nextLevelExp - experience.levelExp);
    const inLevel = Math.max(0, experience.exp - experience.levelExp);
    const ratio = experience.nextLevelExp === null ? 1 : Math.min(1, inLevel / span);
    const text = experience.nextLevelExp === null
      ? `${formatAmount(experience.exp)} (MAX)`
      : `${formatAmount(inLevel)} / ${formatAmount(span)}`;
    const fill = element("i");
    fill.style.width = `${(ratio * 100).toFixed(1)}%`;
    bar.replaceChildren(fill, element("b", undefined, text));
    bar.title = `经验 ${text}`;
    bar.setAttribute("aria-label", `经验 ${text}`);
  }

  private bindSound(button: HTMLElement): void {
    button.addEventListener("mouseenter", () => this.options.onHover?.());
  }

  private build(): void {
    const bar = this.element;
    const onAccount = this.options.onAccount;
    const player = element(onAccount ? "button" : "div", "ks-lobby-player");
    if (onAccount) {
      (player as HTMLButtonElement).type = "button";
      player.setAttribute("aria-label", "账号信息");
      player.title = "账号信息";
      this.bindSound(player);
      player.addEventListener("click", () => {
        this.options.onActivate?.();
        onAccount();
      });
    }
    const icon = (slot: "level" | "cash" | "lucci" | "koin", markup: string): HTMLElement => {
      const holder = element("span", "ks-lobby-icon");
      holder.append(svg(markup));
      this.icons.set(slot, holder);
      return holder;
    };
    this.levelText.textContent = `Lv.${Math.max(1, Math.floor(this.options.level ?? 1))}`;
    this.nameText.textContent = this.options.riderName;
    this.renderExperience(this.options.experience);
    player.append(icon("level", ICONS.rider), this.levelText, this.nameText, this.experience);
    const wallet = element("div", "ks-lobby-wallet");
    const coin = (slot: "cash" | "lucci" | "koin", currency: keyof LobbyWallet, markup: string,
      label: string, value: number | undefined, plus: boolean): HTMLElement => {
      const entry = element("div", "ks-lobby-coin");
      entry.setAttribute("aria-label", `${label} ${formatAmount(value)}`);
      const amount = element("span", undefined, formatAmount(value));
      entry.append(icon(slot, markup), amount);
      this.coins.set(currency, { entry, value: amount, label });
      if (plus) {
        const button = element("button", "ks-lobby-plus", "+");
        button.type = "button";
        button.setAttribute("aria-label", this.options.onCharge ? `打开商店（${label}）` : `充值${label}`);
        this.chargeButtons.push(button);
        this.bindSound(button);
        button.addEventListener("click", () => {
          this.options.onActivate?.();
          if (this.options.onCharge) this.options.onCharge(currency as LobbyChargeCurrency);
          else this.options.onNotice?.("商城充值暂未开放");
        });
        entry.append(button);
      }
      return entry;
    };
    const money = this.options.wallet ?? {};
    wallet.append(coin("cash", "coupon", ICONS.coupon, "点券", money.coupon, true),
      coin("lucci", "lucci", ICONS.lucci, "金币", money.lucci, false),
      coin("koin", "koin", ICONS.koin, "K币", money.koin, true));
    bar.append(player, wallet);
  }
}

/** The top bar fields of an account summary (ECONOMY.md 7.5). */
export function lobbyAccountInfo(summary: AccountSummary,
  glove?: LobbyAccountInfo["glove"]): LobbyAccountInfo {
  return {
    riderName: summary.account.nickname,
    level: summary.progress.level,
    experience: { exp: summary.progress.exp, levelExp: summary.progress.levelExp,
      nextLevelExp: summary.progress.nextLevelExp },
    wallet: { ...summary.wallet },
    ...(glove ? { glove } : {}),
  };
}

/**
 * Keeps a bar in step with the session (purchases, races, level ups),
 * loading the level glove the summary names. Returns the release.
 */
export function followAccountTopBar(session: Pick<AccountSession, "summary" | "subscribe">,
  library: TopBarArtLibrary | undefined, apply: (account: LobbyAccountInfo) => void): () => void {
  let glove: { key: string; image: string; name: string } | undefined;
  let released = false;
  const update = (): void => {
    const summary = session.summary();
    if (!summary || released) return;
    const key = summary.progress.glove;
    const name = summary.progress.gloveName || key;
    apply(lobbyAccountInfo(summary, glove?.key === key ? { image: glove.image, name } : undefined));
    if (key && library && glove?.key !== key) {
      void loadLevelGloveArt(library, key).then(image => {
        if (!image || released) return;
        glove = { key, image, name };
        update();
      });
    }
  };
  update();
  const unsubscribe = session.subscribe(update);
  return () => {
    released = true;
    unsubscribe();
  };
}

export interface MountedLobbyTopBar {
  readonly bar: LobbyTopBar;
  dispose(): void;
}

/**
 * The account's top bar in host (a size container of the lobby area), with
 * the release art and live account fields, e.g. for the shop.
 */
export function mountLobbyTopBar(host: HTMLElement, options: {
  session: Pick<AccountSession, "summary" | "subscribe">;
  library?: TopBarArtLibrary;
  fontFamily?: string;
} & Omit<LobbyTopBarOptions, "riderName" | "level" | "wallet" | "experience">): MountedLobbyTopBar {
  const summary = options.session.summary();
  const bar = new LobbyTopBar({
    ...options,
    riderName: summary?.account.nickname ?? "车手",
    ...(summary ? lobbyAccountInfo(summary) : {}),
  });
  if (options.fontFamily) host.style.setProperty("--ks-lobby-font", `"${options.fontFamily}"`);
  host.append(bar.element);
  let disposed = false;
  if (options.library) {
    void loadLobbyTopBarArt(options.library, summary?.progress.level ?? 1)
      .then(art => { if (!disposed) bar.setTopBarArt(art); })
      .catch(() => undefined);
  }
  const release = followAccountTopBar(options.session, options.library, account => {
    if (!disposed) bar.setAccount(account);
  });
  return {
    bar,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      release();
      bar.element.remove();
    },
  };
}
