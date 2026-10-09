import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_QUICK_ENTRIES, MAX_QUICK_ENTRIES, QUICK_ENTRIES, loadQuickEntries, quickEntry,
  saveQuickEntries,
} from "./lobby-home-view";

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set("kartsim.lobbyQuickEntries", initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

test("大厅快速进入默认四项与截图一致，且每项都有去处", () => {
  assert.deepEqual(DEFAULT_QUICK_ENTRIES.map(id => quickEntry(id)?.title),
    ["竞速个人赛", "无限加速个人赛", "计时挑战赛", "赛道对决"]);
  for (const entry of QUICK_ENTRIES) {
    if (entry.kind === "multiplayer") assert.ok(entry.channel, entry.id);
  }
  assert.equal(quickEntry("speedIndiInfinit")?.channel, "speedIndiInfinit");
});

test("快速进入设置保存后读回，无效内容回到默认", () => {
  assert.deepEqual(loadQuickEntries(memoryStorage()), DEFAULT_QUICK_ENTRIES);
  assert.deepEqual(loadQuickEntries(memoryStorage("not json")), DEFAULT_QUICK_ENTRIES);
  assert.deepEqual(loadQuickEntries(memoryStorage("[\"missing\"]")), DEFAULT_QUICK_ENTRIES);
  const storage = memoryStorage();
  saveQuickEntries(["grip", "timeAttack"], storage);
  assert.deepEqual(loadQuickEntries(storage), ["grip", "timeAttack"]);
  const many = JSON.stringify([...QUICK_ENTRIES.map(entry => entry.id), "grip"]);
  assert.equal(loadQuickEntries(memoryStorage(many)).length, MAX_QUICK_ENTRIES);
});

test("the top bar shows the account and updates level, glove, experience and wallet", async () => {
  const { installFakeDom } = await import("./fake-dom");
  const dom = installFakeDom();
  try {
    const { LobbyHomeView } = await import("./lobby-home-view");
    const charges: string[] = [];
    let accounts = 0;
    const root = dom.document.createElement("div");
    const view = new LobbyHomeView(root as unknown as HTMLElement, {
      riderName: "车手甲", level: 3, banners: [],
      wallet: { coupon: 5, lucci: 10_000, koin: 20 },
      experience: { exp: 250, levelExp: 148, nextLevelExp: 300 },
      onCharge: currency => charges.push(currency),
      onAccount: () => { accounts++; },
      onEntry: () => {},
    });
    const element = view.element as unknown as import("./fake-dom").FakeElement;
    const text = (selector: string) => element.querySelector(selector)?.text();
    assert.equal(text(".ks-lobby-level"), "Lv.3");
    assert.equal(text(".ks-lobby-name"), "车手甲");
    assert.equal(text(".ks-lobby-exp"), "102 / 152");
    assert.equal(element.querySelector(".ks-lobby-exp")!.children[0]!.style.width, "67.1%");
    assert.deepEqual(element.querySelectorAll(".ks-lobby-coin").map(coin => coin.getAttribute("aria-label")),
      ["点券 5", "金币 10,000", "K币 20"]);

    view.setAccount({ riderName: "新名字", level: 5,
      wallet: { coupon: 100, lucci: 9_000, koin: 0 },
      experience: { exp: 600, levelExp: 600, nextLevelExp: null },
      glove: { image: "data:image/png;base64,AA", name: "绿色手套5" } });
    assert.equal(text(".ks-lobby-level"), "Lv.5");
    assert.equal(text(".ks-lobby-name"), "新名字");
    assert.equal(text(".ks-lobby-exp"), "600 (MAX)");
    assert.deepEqual(element.querySelectorAll(".ks-lobby-coin").map(coin => coin.getAttribute("aria-label")),
      ["点券 100", "金币 9,000", "K币 0"]);
    const glove = element.querySelector(".ks-lobby-icon")!;
    assert.equal(glove.title, "绿色手套5");
    assert.equal(glove.children[0]!.src, "data:image/png;base64,AA");

    for (const plus of element.querySelectorAll(".ks-lobby-plus")) plus.click();
    assert.deepEqual(charges, ["coupon", "koin"]);
    element.querySelector("button.ks-lobby-player")!.click();
    assert.equal(accounts, 1);
    view.dispose();

    // Without a shop the release notice stays.
    const plain = new LobbyHomeView(root as unknown as HTMLElement,
      { riderName: "车手", banners: [], onEntry: () => {} });
    const plainElement = plain.element as unknown as import("./fake-dom").FakeElement;
    assert.equal(plainElement.querySelector("button.ks-lobby-player"), null);
    plainElement.querySelector(".ks-lobby-plus")!.click();
    assert.equal(plainElement.querySelector(".ks-lobby-notice")!.textContent, "商城充值暂未开放");
    assert.equal(plainElement.querySelector(".ks-lobby-exp")!.hidden, true);
    plain.dispose();
  } finally {
    dom.restore();
  }
});

test("商店在大厅上打开：快速进入与宣传板让开，顶栏留下，关闭后还原", async () => {
  const { installFakeDom } = await import("./fake-dom");
  const dom = installFakeDom();
  try {
    const { LobbyHomeView } = await import("./lobby-home-view");
    const root = dom.document.createElement("div");
    const view = new LobbyHomeView(root as unknown as HTMLElement,
      { riderName: "车手", banners: [], onEntry: () => {} });
    const element = view.element as unknown as import("./fake-dom").FakeElement;
    const restore = view.enterShop();
    assert.equal(element.classList.contains("ks-lobby-shop"), true);
    // The status bar is the lobby's own and stays.
    assert.ok(element.querySelector(".ks-lobby-top"));
    assert.equal(view.topBar.element as unknown, element.querySelector(".ks-lobby-top"));
    const second = view.enterShop();
    restore();
    restore();
    assert.equal(element.classList.contains("ks-lobby-shop"), true, "another shop visit is still open");
    second();
    assert.equal(element.classList.contains("ks-lobby-shop"), false);
    view.dispose();
    assert.doesNotThrow(() => view.enterShop()());
  } finally {
    dom.restore();
  }
});

test("同一个顶栏可挂在商店里：跟随账号刷新等级、名字与余额，释放后不再更新", async () => {
  const { installFakeDom } = await import("./fake-dom");
  const dom = installFakeDom();
  try {
    const { mountLobbyTopBar } = await import("./lobby-top-bar");
    let summary = {
      account: { username: "u", nickname: "车手甲", admin: false, createdAt: 0 },
      progress: { level: 3, exp: 250, levelExp: 148, nextLevelExp: 300, glove: "", gloveName: "", maxLevel: 127 },
      wallet: { coupon: 5, lucci: 10_000, koin: 20 },
      stats: { races: 0, wins: 0, podiums: 0, points: 0 }, onboarded: true,
    };
    const listeners = new Set<() => void>();
    const session = { summary: () => summary, subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    } };
    const host = dom.document.createElement("div");
    const notices: string[] = [];
    const mounted = mountLobbyTopBar(host as unknown as HTMLElement, { session, fontFamily: "KartSim Main Menu",
      onCharge: () => notices.push("charge") });
    const bar = host.querySelector(".ks-lobby-top")!;
    const text = (selector: string) => bar.querySelector(selector)?.text();
    assert.equal(text(".ks-lobby-level"), "Lv.3");
    assert.equal(text(".ks-lobby-name"), "车手甲");
    assert.deepEqual(bar.querySelectorAll(".ks-lobby-coin").map(coin => coin.getAttribute("aria-label")),
      ["点券 5", "金币 10,000", "K币 20"]);
    assert.equal(host.style.getPropertyValue("--ks-lobby-font"), "\"KartSim Main Menu\"");
    assert.equal(bar.querySelector("button.ks-lobby-player"), null, "no account panel inside the shop");
    for (const plus of bar.querySelectorAll(".ks-lobby-plus")) plus.click();
    assert.deepEqual(notices, ["charge", "charge"]);
    summary = { ...summary, progress: { ...summary.progress, level: 4 }, wallet: { coupon: 100, lucci: 9_000, koin: 0 } };
    for (const listener of listeners) listener();
    assert.equal(text(".ks-lobby-level"), "Lv.4");
    assert.deepEqual(bar.querySelectorAll(".ks-lobby-coin").map(coin => coin.getAttribute("aria-label")),
      ["点券 100", "金币 9,000", "K币 0"]);
    mounted.dispose();
    assert.equal(listeners.size, 0);
    assert.equal(host.querySelector(".ks-lobby-top"), null);
  } finally {
    dom.restore();
  }
});
