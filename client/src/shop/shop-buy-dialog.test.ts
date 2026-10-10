import assert from "node:assert/strict";
import test from "node:test";

import type { Currency } from "../account/account-session";
import { ShopApiError, ShopPurchaser, type ShopPurchaseResult } from "./shop-api";
import {
  BuyDialogController, BuyDialogView, DIALOG_INPUT_GUARD_MS, PURCHASE_BUSY_MESSAGE,
  PURCHASE_SUCCESS_MESSAGE, purchaseFailureMessage, purchaseSuccessNote,
  type BuyDialogState, type BuyPhase,
} from "./shop-buy-dialog";
import type { ShopOffer } from "./shop-catalog";
import { formatDateTime, NOT_OWNED, ShopIndex, type OfferContext, type ShopOwnership } from "./shop-model";
import { installShopTestDom, TestEvent, type TestElement } from "./shop-test-dom";
import { fakeSession, fixtureCatalog, json, requestBody } from "./shop-test-fixtures";

const RESULT: ShopPurchaseResult = {
  wallet: { coupon: 880, lucci: 9000, koin: 0 },
  item: { category: 3, itemId: 10, quantity: 1, expiresAt: 1_800_000_000_000, source: "shop" },
  purchaseId: "7",
};

function setup(wallet: Record<Currency, number>, options: {
  purchase?: (offer: ShopOffer) => Promise<ShopPurchaseResult>;
  ownership?: ShopOwnership;
  key?: [number, number];
  exp?: number;
  now?: number;
} = {}) {
  const index = new ShopIndex(fixtureCatalog());
  const [category, itemId] = options.key ?? [3, 10];
  const entry = index.entry(category, itemId)!;
  const live: { wallet: Record<Currency, number>; ownership: ShopOwnership } = {
    wallet, ownership: options.ownership ?? NOT_OWNED,
  };
  const purchases: string[] = [];
  const after: ShopPurchaseResult[] = [];
  const failures: unknown[] = [];
  const phases: BuyPhase[] = [];
  const controller = new BuyDialogController({
    entry,
    context: (): OfferContext => ({ wallet: live.wallet, exp: options.exp ?? 0, ownership: live.ownership }),
    purchase: async offer => {
      purchases.push(offer.offerId);
      return options.purchase ? options.purchase(offer) : RESULT;
    },
    afterPurchase: result => { after.push(result); },
    onFailure: error => { failures.push(error); },
    ...(options.now === undefined ? {} : { now: () => options.now! }),
  });
  controller.subscribe(() => phases.push(controller.state.phase));
  return { controller, live, purchases, after, failures, phases };
}

test("打开时默认选中最便宜且买得起的期限，显示购买前后余额", () => {
  const { controller } = setup({ coupon: 1000, lucci: 0, koin: 0 });
  const state = controller.state;
  assert.equal(state.phase, "choose");
  assert.deepEqual(state.offers.map(entry => entry.offer.offerId), ["s1", "s2", "s3"]);
  assert.equal(state.selected.offer.offerId, "s1");
  assert.deepEqual({ balance: state.selected.balance, after: state.selected.after }, { balance: 1000, after: 880 });
  assert.equal(state.offers[2]!.blocked, "funds");
  assert.equal(controller.canConfirm(), true);
});

test("切换期限；余额不足的期限不可购买", () => {
  const { controller } = setup({ coupon: 150, lucci: 0, koin: 0 });
  controller.select("s2");
  assert.equal(controller.state.selected.offer.offerId, "s2");
  assert.equal(controller.state.selected.blocked, "funds");
  assert.equal(controller.state.selected.reason, "点券不足");
  assert.equal(controller.canConfirm(), false);
  controller.select("missing");
  assert.equal(controller.state.selected.offer.offerId, "s2");
});

test("购买成功：购买中 → 成功，刷新账号后提示已放入车库", async () => {
  const { controller, purchases, after, phases } = setup({ coupon: 1000, lucci: 0, koin: 0 });
  const pending = controller.confirm();
  assert.equal(controller.state.phase, "busy");
  assert.equal(controller.state.message, PURCHASE_BUSY_MESSAGE);
  assert.equal(controller.canConfirm(), false);
  controller.select("s2");
  assert.equal(controller.state.selected.offer.offerId, "s1");
  await pending;
  assert.deepEqual(purchases, ["s1"]);
  assert.deepEqual(after, [RESULT]);
  assert.equal(controller.state.phase, "success");
  assert.equal(controller.state.message, PURCHASE_SUCCESS_MESSAGE);
  assert.equal(PURCHASE_SUCCESS_MESSAGE, "兑换成功，已放入车库");
  assert.deepEqual(phases, ["busy", "success"]);
  assert.equal(controller.canConfirm(), false);
});

test("购买失败显示中文错误；网络错误可用同一 requestId 重试", async () => {
  const session = fakeSession([
    () => { throw new TypeError("offline"); },
    () => json({
      wallet: { coupon: 880, lucci: 0, koin: 0 },
      item: { category: 3, itemId: 10, quantity: 1, expiresAt: null, source: "shop" }, purchaseId: 3,
    }),
  ]);
  let ids = 0;
  const purchaser = new ShopPurchaser(session, {
    randomUUID: () => `req-${++ids}`, retryDelaysMs: [], sleep: async () => {},
  });
  const { controller, failures } = setup({ coupon: 1000, lucci: 0, koin: 0 }, {
    purchase: offer => purchaser.purchase(offer),
  });
  await controller.confirm();
  assert.equal(controller.state.phase, "error");
  assert.equal(controller.state.retryable, true);
  assert.equal(controller.state.errorCode, "NETWORK_ERROR");
  assert.equal(controller.state.message, "网络连接失败，请检查网络后重试。重试不会重复扣费。");
  assert.equal(failures.length, 1);
  assert.equal(controller.canConfirm(), true);
  await controller.confirm();
  assert.equal(controller.state.phase, "success");
  assert.deepEqual(session.calls.map(call => requestBody(call).requestId), ["req-1", "req-1"]);
});

test("服务端拒绝：余额不足按货币提示，经验不足提示门槛，已拥有不可重试", async () => {
  const funds = setup({ coupon: 1000, lucci: 0, koin: 0 }, {
    purchase: async () => { throw new ShopApiError("INSUFFICIENT_FUNDS", 409); },
  });
  await funds.controller.confirm();
  assert.equal(funds.controller.state.message, "点券不足，无法兑换该道具。");
  assert.equal(funds.controller.state.retryable, false);
  assert.equal(purchaseFailureMessage(new ShopApiError("EXP_REQUIRED", 409), { currency: "coupon", minExp: 600 }),
    "经验不足，需要经验 600。");
  assert.equal(purchaseFailureMessage(new ShopApiError("ALREADY_OWNED", 409), { currency: "coupon" }),
    "你已永久拥有该道具，无需重复购买。");
  assert.equal(purchaseFailureMessage(new ShopApiError("TOO_MANY_ATTEMPTS", 429), { currency: "coupon" }),
    "操作过于频繁，请稍后再试。");
  assert.equal(purchaseFailureMessage(new Error("boom"), { currency: "lucci" }), "网络连接失败，请检查网络后重试。");
});

test("会话刷新后重算可买性（余额变化、已永久拥有）", () => {
  const { controller, live } = setup({ coupon: 100, lucci: 0, koin: 0 });
  assert.equal(controller.state.selected.offer.offerId, "s1");
  assert.equal(controller.canConfirm(), false);
  live.wallet = { coupon: 500, lucci: 0, koin: 0 };
  controller.refresh();
  assert.equal(controller.canConfirm(), true);
  assert.equal(controller.state.selected.after, 380);
  live.ownership = { owned: true, permanent: true, expiresAt: null, quantity: 1 };
  controller.refresh();
  assert.equal(controller.state.selected.blocked, "owned");
  assert.equal(controller.canConfirm(), false);
});

test("经验门槛与数量道具", () => {
  const aura = setup({ coupon: 100, lucci: 0, koin: 50 }, { key: [26, 2], exp: 10 });
  // The cheapest buyable offer is in K币 since the 点券 rental needs exp 600.
  assert.equal(aura.controller.state.selected.offer.offerId, "s10");
  aura.controller.select("s9");
  assert.equal(aura.controller.state.selected.blocked, "exp");
  const balloon = setup({ coupon: 100, lucci: 0, koin: 0 }, {
    key: [9, 1], ownership: { owned: true, permanent: true, expiresAt: null, quantity: 50 },
  });
  assert.equal(balloon.controller.state.selected.offer.offerId, "s7");
  assert.equal(balloon.controller.canConfirm(), true);
});

// --- F7, F8: renewal notes and stale catalog --------------------------------

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 7, 12);
const RENTAL: ShopOwnership = { owned: true, permanent: false, expiresAt: NOW + 3 * DAY, quantity: 1 };

test("已拥有限时道具：说明续期后的到期时间；成功后说明已续期或已变为永久", async () => {
  const { controller } = setup({ coupon: 1000, lucci: 0, koin: 0 }, { ownership: RENTAL, now: NOW });
  assert.equal(controller.state.selected.offer.offerId, "s1");
  assert.equal(controller.renewal(), `当前剩余 3 天，兑换后到期 ${formatDateTime(NOW + 33 * DAY)}`);
  controller.select("s2");
  assert.equal(controller.renewal(), "当前剩余 3 天，兑换后变为永久");
  controller.select("s1");
  await controller.confirm();
  assert.equal(controller.state.phase, "success");
  assert.equal(controller.renewal(), undefined);
  // The note describes the change from the ownership before buying.
  assert.equal(controller.state.ownership, RENTAL);
  const item = controller.entry.item;
  assert.equal(purchaseSuccessNote(item, controller.state.selected.offer, controller.state.ownership,
    controller.state.result), `* 已续期 尖锋6.5，到期 ${formatDateTime(RESULT.item.expiresAt!)}。`);
  const permanent = { ...RESULT, item: { ...RESULT.item, expiresAt: null } };
  assert.equal(purchaseSuccessNote(item, { days: 0, count: 1 }, RENTAL, permanent), "* 尖锋6.5 已变为永久。");
  assert.equal(purchaseSuccessNote(item, { days: 30, count: 1 }, NOT_OWNED, RESULT), "* 已获得 尖锋6.5（30天）。");
  // Not owned: no renewal note.
  assert.equal(setup({ coupon: 1000, lucci: 0, koin: 0 }, { now: NOW }).controller.renewal(), undefined);
});

test("价格已变化（409 PRICE_CHANGED）：提示刷新商店，购买按钮不再可用", async () => {
  const { controller } = setup({ coupon: 1000, lucci: 0, koin: 0 }, {
    purchase: async () => { throw new ShopApiError("PRICE_CHANGED", 409); },
  });
  await controller.confirm();
  assert.equal(controller.state.phase, "error");
  assert.equal(controller.state.message, "价格已变化，请刷新商店后重试。");
  assert.equal(controller.state.stale, true);
  assert.equal(controller.state.retryable, false);
  assert.equal(controller.canConfirm(), false);
  // Another term is still a choice; the stale catalog keeps 购买 off until the shop reloads it.
  controller.select("s2");
  assert.equal(controller.state.phase, "choose");
});

// --- The dialog view ------------------------------------------------------

function openView(options: Parameters<typeof setup>[1] & {
  wallet?: Record<Currency, number>;
  enterHeld?: boolean;
} = {}) {
  const dom = installShopTestDom();
  const layer = dom.document.createElement("div");
  dom.document.body.append(layer);
  const fixture = setup(options.wallet ?? { coupon: 1000, lucci: 0, koin: 0 }, options);
  const closes: BuyDialogState[] = [];
  const view = new BuyDialogView({
    layer: layer as unknown as HTMLElement,
    controller: fixture.controller,
    renderPreview: () => {},
    onClose: state => closes.push(state),
    ...(options.enterHeld === undefined ? {} : { enterHeld: options.enterHeld }),
  });
  const modal = layer.querySelector(".ks-shop-modal")!;
  const buttons = modal.querySelectorAll(".ks-shop-button");
  const combo = modal.querySelector(".ks-shop-combo")!;
  const key = (key: string, init: Record<string, unknown> = {}) => {
    const event = new TestEvent("keydown", { key, repeat: false, isComposing: false, ...init });
    event.target = dom.document.activeElement;
    view.handleKey(event as unknown as KeyboardEvent);
    return event;
  };
  return {
    ...fixture, dom, view, modal, closes, key, combo,
    ok: buttons[0]!, cancel: buttons[1]!,
    close: modal.querySelector(".ks-shop-dialog-close")!,
    options: () => modal.querySelectorAll(".ks-shop-combo-option"),
    list: modal.querySelector(".ks-shop-combo-list")!,
    dialog: modal.querySelector(".ks-shop-dialog")!,
    note: () => modal.querySelector(".ks-shop-dialog-note")!.dataset.text,
    panel: (name: string) => modal.querySelector(`[data-name="${name}"]`)!,
    keyUp: (key: string) => view.handleKeyUp(new TestEvent("keyup", { key }) as unknown as KeyboardEvent),
  };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test("对话框按原版 mqBuyItem@cn：道具名称、选择期限的下拉框、当前货币的前后余额", () => {
  const view = openView({ wallet: { coupon: 1000, lucci: 3000, koin: 0 } });
  try {
    const label = (name: string) => view.panel(name).text();
    assert.equal(view.dialog.querySelector(".ks-caption-text")!.text(), "兑换道具");
    assert.equal(label("itemName"), "尖锋6.5");
    assert.equal(view.combo.text(), "30天 120点券");
    assert.equal(view.combo.getAttribute("aria-label"), "选择期限");
    assert.deepEqual(view.options().map(option => option.text()), ["30天 120点券", "永久 216点券", "30天 2,500金币"]);
    // The coupon panel (cashPanel) with this server's currency names; the others are hidden.
    assert.equal(view.panel("cashPanel").hidden, false);
    assert.equal(view.panel("lucciPanel").hidden, true);
    assert.equal(view.panel("koinPanel").hidden, true);
    assert.equal(label("myCash"), "1,000");
    assert.equal(label("afterCash"), "880");
    assert.equal(view.panel("cashPanel").querySelectorAll(".ks-bml")[0]!.text(), "我的点券");
    assert.equal(view.ok.text(), "确定");
    assert.equal(view.cancel.text(), "取消");
    assert.equal(view.note(), "* 要兑换所选道具吗？兑换后道具将放入车库。适当娱乐，理性消费。");
    // Choosing 金币 switches to lucciPanel.
    view.dom.advance(DIALOG_INPUT_GUARD_MS);
    view.combo.click();
    assert.equal(view.list.hidden, false);
    view.options()[2]!.click();
    assert.equal(view.list.hidden, true);
    assert.equal(view.controller.state.selected.offer.offerId, "s3");
    assert.equal(view.panel("lucciPanel").hidden, false);
    assert.equal(label("myLucci"), "3,000");
    assert.equal(label("afterLucci"), "500");
    // The keyboard changes the term on the closed combo too.
    view.combo.dispatchEvent(new TestEvent("keydown", { key: "ArrowUp" }));
    assert.equal(view.controller.state.selected.offer.offerId, "s2");
  } finally {
    view.dom.restore();
  }
});

test("余额不足：剩余为负并标红，确定不可用，说明原因", () => {
  const view = openView({ wallet: { coupon: 100, lucci: 0, koin: 0 } });
  try {
    assert.equal(view.panel("afterCash").text(), "-20");
    assert.equal(view.panel("afterCash").dataset.negative, "true");
    assert.equal(view.ok.disabled, true);
    assert.equal(view.note(), "* 点券不足，无法兑换。");
    assert.equal(view.options()[0]!.dataset.blocked, "funds");
  } finally {
    view.dom.restore();
  }
});

test("打开后 500ms 内（双击卡片的第二下）：购买、取消、切换期限与背景点击都不生效", async () => {
  const view = openView();
  try {
    assert.equal(DIALOG_INPUT_GUARD_MS, 500);
    view.dom.advance(150);
    view.ok.click({ detail: 2 });
    await settle();
    assert.deepEqual(view.purchases, [], "the second click of the double-click does not buy");
    view.cancel.click({ detail: 2 });
    view.close.click({ detail: 2 });
    assert.equal(view.view.isClosed, false);
    // Neither the term list nor a term reacts.
    view.combo.click({ detail: 2 });
    assert.equal(view.list.hidden, true);
    view.options()[1]!.click({ detail: 2 });
    assert.equal(view.controller.state.selected.offer.offerId, "s1");
    view.combo.dispatchEvent(new TestEvent("keydown", { key: "ArrowDown" }));
    assert.equal(view.controller.state.selected.offer.offerId, "s1");
    // The backdrop: a press inside the guard does not close, even released after it.
    view.modal.fire("pointerdown");
    view.modal.click({ detail: 2 });
    assert.equal(view.view.isClosed, false);
    view.modal.fire("pointerdown");
    view.dom.advance(400);
    view.modal.click();
    assert.equal(view.view.isClosed, false);
    // A press that began in the dialog and ended on the backdrop does not close either.
    view.dialog.fire("pointerdown");
    view.modal.click();
    assert.equal(view.view.isClosed, false);
    // After the guard everything works.
    view.combo.click();
    view.options()[1]!.click();
    assert.equal(view.controller.state.selected.offer.offerId, "s2");
    view.combo.click();
    view.options()[0]!.click();
    view.ok.click();
    await settle();
    assert.deepEqual(view.purchases, ["s1"]);
    view.ok.click();
    assert.deepEqual(view.closes.map(state => state.phase), ["success"]);
  } finally {
    view.dom.restore();
  }
});

test("背景：按下与松开都在背景上（且在保护期后）才关闭；标题栏关闭按钮即取消", () => {
  const view = openView();
  try {
    view.dom.advance(DIALOG_INPUT_GUARD_MS);
    view.modal.fire("pointerdown");
    view.modal.click();
    assert.equal(view.view.isClosed, true);
    assert.equal(view.closes.length, 1);
  } finally {
    view.dom.restore();
  }
  const closing = openView();
  try {
    closing.dom.advance(DIALOG_INPUT_GUARD_MS);
    closing.close.click();
    assert.equal(closing.view.isClosed, true);
    assert.equal(closing.closes[0]!.phase, "choose");
  } finally {
    closing.dom.restore();
  }
});

test("按住 Enter（打开对话框的那一下）不会购买：忽略自动重复，松开后再按才确认", async () => {
  const view = openView({ enterHeld: true });
  try {
    assert.equal(view.key("Enter").defaultPrevented, true);
    view.key("Enter", { repeat: true });
    view.key("Enter", { repeat: true });
    await settle();
    assert.deepEqual(view.purchases, []);
    view.keyUp("Enter");
    view.key("Enter", { repeat: true });
    await settle();
    assert.deepEqual(view.purchases, [], "auto-repeat never confirms");
    view.key("Enter");
    await settle();
    assert.deepEqual(view.purchases, ["s1"]);
  } finally {
    view.dom.restore();
  }
  // A dialog that does not know whether Enter is down waits for a release too.
  const unknown = openView();
  try {
    unknown.key("Enter");
    await settle();
    assert.deepEqual(unknown.purchases, []);
  } finally {
    unknown.dom.restore();
  }
  // Opened with the mouse (Enter not down): the first Enter confirms.
  const mouse = openView({ enterHeld: false });
  try {
    mouse.key("Enter");
    await settle();
    assert.deepEqual(mouse.purchases, ["s1"]);
  } finally {
    mouse.dom.restore();
  }
  // With the term list open, Enter picks the highlighted term instead of buying; Esc only closes the list.
  const list = openView({ enterHeld: false });
  try {
    list.dom.advance(DIALOG_INPUT_GUARD_MS);
    list.combo.focus();
    list.combo.dispatchEvent(new TestEvent("keydown", { key: " " }));
    assert.equal(list.list.hidden, false);
    list.combo.dispatchEvent(new TestEvent("keydown", { key: "ArrowDown" }));
    list.key("Enter");
    assert.equal(list.list.hidden, true);
    assert.equal(list.controller.state.selected.offer.offerId, "s2");
    assert.deepEqual(list.purchases, []);
    list.combo.dispatchEvent(new TestEvent("keydown", { key: " " }));
    list.key("Escape");
    assert.equal(list.list.hidden, true);
    assert.equal(list.view.isClosed, false);
  } finally {
    list.dom.restore();
  }
});

test("购买请求超时后对话框恢复：可以取消，或用同一 requestId 重试", { timeout: 5_000 }, async () => {
  const bodies: Record<string, unknown>[] = [];
  const session = fakeSession([
    call => { bodies.push(requestBody(call)); return new Promise<Response>(() => {}); },
    call => { bodies.push(requestBody(call)); return json(RESULT); },
  ]);
  const purchaser = new ShopPurchaser(session, { timeoutMs: 20, randomUUID: () => "req-1" });
  const view = openView({ purchase: offer => purchaser.purchase(offer) });
  try {
    view.dom.advance(DIALOG_INPUT_GUARD_MS);
    view.ok.click();
    assert.equal(view.controller.state.phase, "busy");
    assert.equal(view.ok.text(), "请稍候…");
    view.cancel.click();
    view.close.click();
    view.key("Escape");
    assert.equal(view.view.isClosed, false, "no cancel while the request is in flight");
    assert.equal(view.cancel.disabled, true);
    assert.equal(view.combo.disabled, true);
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(view.controller.state.phase, "error");
    assert.equal(view.controller.state.errorCode, "NETWORK_ERROR");
    assert.equal(view.ok.text(), "重试");
    assert.equal(view.cancel.disabled, false);
    view.ok.click();
    await settle();
    await settle();
    assert.equal(view.controller.state.phase, "success");
    assert.deepEqual(bodies.map(body => body.requestId), ["req-1", "req-1"]);
  } finally {
    view.dom.restore();
  }
  const hung = openView({ purchase: offer => new ShopPurchaser(fakeSession([
    () => new Promise<Response>(() => {})]), { timeoutMs: 20 }).purchase(offer) });
  try {
    hung.dom.advance(DIALOG_INPUT_GUARD_MS);
    hung.ok.click();
    await new Promise(resolve => setTimeout(resolve, 60));
    hung.cancel.click();
    assert.equal(hung.view.isClosed, true);
    assert.equal(hung.closes[0]!.phase, "error");
  } finally {
    hung.dom.restore();
  }
});

test("对话框说明续期：当前剩余与兑换后的到期时间", async () => {
  const view = openView({ ownership: RENTAL, now: NOW });
  try {
    assert.equal(view.note(),
      `* 当前剩余 3 天，兑换后到期 ${formatDateTime(NOW + 33 * DAY)}。适当娱乐，理性消费。`);
    view.dom.advance(DIALOG_INPUT_GUARD_MS);
    view.combo.click();
    view.options()[1]!.click();
    assert.equal(view.note(), "* 当前剩余 3 天，兑换后变为永久。适当娱乐，理性消费。");
    view.combo.click();
    view.options()[0]!.click();
    view.ok.click();
    await settle();
    assert.equal(view.note(), `* 已续期 尖锋6.5，到期 ${formatDateTime(RESULT.item.expiresAt!)}。`);
    assert.equal(view.modal.querySelector(".ks-shop-dialog-message")!.text(), PURCHASE_SUCCESS_MESSAGE);
  } finally {
    view.dom.restore();
  }
  const fresh = openView({ now: NOW });
  try {
    assert.equal(fresh.note(), "* 要兑换所选道具吗？兑换后道具将放入车库。适当娱乐，理性消费。");
  } finally {
    fresh.dom.restore();
  }
});

test("价格已变化：对话框禁用确定按钮并把焦点交给取消", async () => {
  const view = openView({ purchase: async () => { throw new ShopApiError("PRICE_CHANGED", 409); } });
  try {
    view.dom.advance(DIALOG_INPUT_GUARD_MS);
    // A pointer click focuses the button it lands on.
    view.ok.focus();
    view.ok.click();
    await settle();
    assert.equal(view.ok.disabled, true);
    assert.equal(view.ok.text(), "确定");
    assert.equal(view.dom.document.activeElement, view.cancel);
    assert.equal(view.modal.querySelector(".ks-shop-dialog-message")!.text(), "价格已变化，请刷新商店后重试。");
  } finally {
    view.dom.restore();
  }
});
