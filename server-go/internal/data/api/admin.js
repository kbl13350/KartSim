// KartSim admin console. The session token lives only in this closure:
// nothing is written to localStorage, sessionStorage or cookies. Every
// value from the server is shown with textContent, never parsed as HTML.
"use strict";
(() => {
  let token = null;

  const $ = (id) => document.getElementById(id);
  const errors = {
    INVALID_CREDENTIALS: "用户名或密码错误",
    TOO_MANY_ATTEMPTS: "尝试次数过多，请稍后再试",
    LOGIN_REQUIRED: "登录已失效，请重新登录",
    ADMIN_REQUIRED: "该账号不是管理员",
    ACCOUNT_NOT_FOUND: "找不到该用户名",
    INVALID_GRANT: "类型或数量无效（数量不能为 0，绝对值不超过 10 亿）",
    INVALID_NOTE: "请填写备注（最多 200 字）",
    INVALID_QUERY: "查询内容过长",
    INSUFFICIENT_FUNDS: "余额不足，扣除后不能为负数",
    INSUFFICIENT_EXP: "经验不足，扣除后不能为负数",
    BALANCE_LIMIT: "余额超出上限",
    REQUEST_ID_CONFLICT: "该请求编号已用于另一笔发放，请重新提交",
    INVALID_REQUEST_ID: "请求编号无效，请重新提交",
    SERVER_BUSY: "服务器繁忙，请稍后再试",
    DATA_SERVICE_UNAVAILABLE: "数据服务暂时不可用",
    INTERNAL_ERROR: "服务器内部错误",
    INVALID_ACTIVITY: "活动无效",
    INVALID_REQUEST: "设置无效（结束时间须晚于开始时间，每日道具须为已知道具，数量 1–1000，最多 8 种）",
  };
  const currencyNames = { coupon: "点券", lucci: "金币", koin: "K币", exp: "经验" };

  function show(element, text, kind) {
    element.textContent = text;
    element.className = "status" + (kind ? " " + kind : "");
  }

  function describe(code) {
    return errors[code] || "请求失败（" + code + "）";
  }

  // A version-4 UUID from crypto.getRandomValues, which also works on
  // plain-HTTP LAN pages (the UUID helper of Web Crypto needs a secure
  // context).
  function newRequestId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
  }

  // The request id of a grant that has not succeeded yet. Submitting the
  // same grant again (after a network error or an unclear outcome) reuses
  // it, so the server applies it at most once; a changed form or a success
  // starts a new one.
  let pendingGrant = null;
  function grantRequestId(grant) {
    const key = JSON.stringify(grant);
    if (!pendingGrant || pendingGrant.key !== key) pendingGrant = { key, requestId: newRequestId() };
    return pendingGrant.requestId;
  }

  async function call(method, path, body) {
    const headers = {};
    if (token) headers["Authorization"] = "Bearer " + token;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let response;
    try {
      response = await fetch(path, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store", credentials: "omit",
      });
    } catch (error) {
      throw new Error("无法连接数据服务");
    }
    let data = null;
    try { data = await response.json(); } catch (error) { data = null; }
    if (!response.ok) {
      const code = data && typeof data.error === "string" ? data.error : "HTTP_" + response.status;
      if (code === "LOGIN_REQUIRED") signOut();
      const failure = new Error(describe(code));
      failure.code = code;
      throw failure;
    }
    return data;
  }

  function signIn(newToken, account) {
    token = newToken;
    $("who-name").textContent = account.nickname + "（" + account.username + "）";
    $("who").hidden = false;
    $("login-panel").hidden = true;
    $("console").hidden = false;
    search("");
    loadLottery();
  }

  function signOut() {
    token = null;
    $("who").hidden = true;
    $("console").hidden = true;
    $("login-panel").hidden = false;
    $("accounts").replaceChildren();
    $("invite-code").hidden = true;
  }

  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = $("login-status");
    show(status, "正在登录…");
    try {
      const login = await call("POST", "/multiplayer/auth/login", {
        username: form.username.value.trim(), password: form.password.value,
      });
      form.password.value = "";
      if (!login.account || !login.account.admin) {
        token = login.token;
        await call("POST", "/multiplayer/auth/logout").catch(() => {});
        token = null;
        show(status, describe("ADMIN_REQUIRED"), "error");
        return;
      }
      show(status, "");
      signIn(login.token, login.account);
    } catch (error) {
      show(status, error.message, "error");
    }
  });

  $("logout").addEventListener("click", async () => {
    await call("POST", "/multiplayer/auth/logout").catch(() => {});
    signOut();
  });

  function cell(text, numeric) {
    const td = document.createElement("td");
    td.textContent = String(text);
    if (numeric) td.className = "num";
    return td;
  }

  function formatTime(ms) {
    if (!ms) return "-";
    return new Date(ms).toLocaleString("zh-CN", { hour12: false });
  }

  function formatNumber(value) {
    return Number(value).toLocaleString("zh-CN");
  }

  function renderAccounts(accounts) {
    const rows = accounts.map((account) => {
      const tr = document.createElement("tr");
      tr.className = "selectable";
      tr.title = "填入发放表单";
      tr.append(
        cell(account.username), cell(account.nickname), cell(account.level, true),
        cell(formatNumber(account.exp), true), cell(formatNumber(account.wallet.coupon), true),
        cell(formatNumber(account.wallet.lucci), true), cell(formatNumber(account.wallet.koin), true),
        cell(account.inventoryCount, true), cell(account.onboarded ? "已领取" : "未领取"),
        cell(account.admin ? "是" : ""), cell(formatTime(account.createdAt)),
      );
      tr.addEventListener("click", () => {
        $("grant-form").username.value = account.username;
        $("grant-form").amount.focus();
      });
      return tr;
    });
    $("accounts").replaceChildren(...rows);
  }

  async function search(query) {
    const status = $("search-status");
    show(status, "正在查询…");
    try {
      const result = await call("GET", "/api/admin/accounts?q=" + encodeURIComponent(query));
      renderAccounts(result.accounts);
      show(status, result.accounts.length ? "共 " + result.accounts.length + " 个账号（最多显示 50 个）" : "没有匹配的账号");
    } catch (error) {
      show(status, error.message, "error");
    }
  }

  $("search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    search(event.currentTarget.q.value.trim());
  });

  $("grant-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = $("grant-status");
    const amount = Number(form.amount.value);
    if (!Number.isSafeInteger(amount) || amount === 0) {
      show(status, describe("INVALID_GRANT"), "error");
      return;
    }
    const currency = form.currency.value;
    const verb = amount > 0 ? "发放" : "扣除";
    const target = form.username.value.trim();
    if (!window.confirm("确认向 " + target + " " + verb + " " + formatNumber(Math.abs(amount)) + " " + currencyNames[currency] + "？")) {
      return;
    }
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    show(status, "正在提交…");
    try {
      const grant = { username: target, currency, amount, note: form.note.value.trim() };
      const result = await call("POST", "/api/admin/grant", { ...grant, requestId: grantRequestId(grant) });
      pendingGrant = null;
      const account = result.account;
      let text = "已" + verb + " " + formatNumber(Math.abs(result.applied)) + " " + currencyNames[currency] +
        "。当前：Lv." + account.level + "，经验 " + formatNumber(account.exp) + "，点券 " + formatNumber(account.wallet.coupon) +
        "，金币 " + formatNumber(account.wallet.lucci) + "，K币 " + formatNumber(account.wallet.koin);
      if (result.duplicate) text = "该发放已经处理过，未重复执行。" + text;
      else if (result.applied !== amount) text += "（经验已达上限，只增加了实际可增加的部分）";
      if (result.levelUps && result.levelUps.length) {
        text += "；升级到 Lv." + result.levelUps[result.levelUps.length - 1].level + " 并发放了升级奖励";
      }
      show(status, text, "ok");
      form.amount.value = "";
      search($("search-form").q.value.trim());
    } catch (error) {
      if (error.code === "REQUEST_ID_CONFLICT" || error.code === "INVALID_REQUEST_ID") pendingGrant = null;
      show(status, error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  // ---- 抽奖活动 (LOTTERY.md 5) ----
  let lotteryNames = new Map();
  let editing = null;

  function itemsText(items) {
    return items && items.length
      ? items.map((item) => (item.name || item.category + ":" + item.itemId) + " ×" + item.count +
        (item.days ? "（" + item.days + "天）" : "")).join("，")
      : "无";
  }

  function periodText(start, end) {
    if (start == null && end == null) return "不限";
    return (start == null ? "…" : formatTime(start)) + " ~ " + (end == null ? "…" : formatTime(end));
  }

  function stateText(activity, now) {
    if (!activity.enabled) return "已关闭";
    if (activity.open) return "开放中";
    if (activity.start != null && now < activity.start) return "未开始";
    return "已结束";
  }

  function localInput(ms) {
    if (ms == null) return "";
    const date = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
    return date.toISOString().slice(0, 19);
  }

  function renderLottery(result) {
    lotteryNames = new Map(result.lotteries.map((row) => [row.itemId, row.name]));
    const rows = result.activities.map((activity) => {
      const tr = document.createElement("tr");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "编辑";
      button.addEventListener("click", () => editLottery(activity));
      const actions = document.createElement("td");
      actions.append(button);
      tr.append(cell(activity.name + "（" + activity.activity + "）"), cell(stateText(activity, result.serverTime)),
        cell(periodText(activity.start, activity.end)), cell(activity.hasDaily ? itemsText(activity.daily) : "-"),
        cell((activity.originalStart || "…").slice(0, 10) + " ~ " + (activity.originalEnd || "…").slice(0, 10)),
        cell(activity.custom ? activity.updatedBy + " " + formatTime(activity.updatedAt) : "默认"), actions);
      return tr;
    });
    $("lottery-activities").replaceChildren(...rows);
    const options = result.lotteries.map((row) => {
      const option = document.createElement("option");
      option.value = String(row.itemId);
      option.textContent = row.itemId + " " + row.name;
      return option;
    });
    $("lottery-pick").replaceChildren(...options);
  }

  async function loadLottery() {
    const status = $("lottery-status");
    try {
      renderLottery(await call("GET", "/api/admin/lottery"));
    } catch (error) {
      show(status, error.message, "error");
    }
  }

  function editLottery(activity) {
    editing = activity;
    const form = $("lottery-form");
    form.activity.value = activity.activity;
    form.enabled.value = String(activity.enabled !== false);
    form.start.value = localInput(activity.start);
    form.end.value = localInput(activity.end);
    form.daily.value = activity.custom && activity.daily
      ? activity.daily.map((item) => item.category + ":" + item.itemId + " " + item.count + (item.days ? " " + item.days : "")).join("\n")
      : "";
    $("lottery-daily-label").hidden = !activity.hasDaily;
    form.hidden = false;
    show($("lottery-status"), "正在编辑 " + (activity.name || activity.activity) +
      (activity.hasDaily ? "；默认每日免费：" + itemsText(activity.defaultDaily) : ""));
  }

  $("lottery-add").addEventListener("submit", (event) => {
    event.preventDefault();
    const itemId = Number($("lottery-pick").value);
    if (!itemId) return;
    editLottery({ activity: "lottery:" + itemId, name: lotteryNames.get(itemId) || String(itemId), enabled: true,
      hasDaily: false });
  });

  $("lottery-cancel").addEventListener("click", () => {
    $("lottery-form").hidden = true;
    editing = null;
    show($("lottery-status"), "");
  });

  function parseDaily(text) {
    const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
    return lines.map((line) => {
      const match = /^(\d+)\s*:\s*(\d+)\s+(\d+)(?:\s+(\d+))?$/.exec(line);
      if (!match) throw new Error("无法识别：" + line);
      return { category: Number(match[1]), itemId: Number(match[2]), count: Number(match[3]), days: Number(match[4] || 0) };
    });
  }

  async function saveLottery(body) {
    const status = $("lottery-status");
    show(status, "正在保存…");
    try {
      const saved = await call("PUT", "/api/admin/lottery", body);
      show(status, (body.reset ? "已恢复默认：" : "已保存：") + saved.name + "，" + stateText(saved, Date.now()), "ok");
      $("lottery-form").hidden = true;
      editing = null;
      loadLottery();
    } catch (error) {
      show(status, error.message, "error");
    }
  }

  $("lottery-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = { activity: form.activity.value, enabled: form.enabled.value === "true" };
    if (form.start.value) body.start = new Date(form.start.value).getTime();
    if (form.end.value) body.end = new Date(form.end.value).getTime();
    if (editing && editing.hasDaily && form.daily.value.trim()) {
      try {
        body.daily = parseDaily(form.daily.value);
      } catch (error) {
        show($("lottery-status"), error.message, "error");
        return;
      }
    }
    saveLottery(body);
  });

  $("lottery-reset").addEventListener("click", () => {
    if (!editing) return;
    if (!window.confirm("恢复 " + (editing.name || editing.activity) + " 的默认设置（一直开放、默认每日道具）？")) return;
    saveLottery({ activity: editing.activity, reset: true });
  });

  $("invite").addEventListener("click", async () => {
    const status = $("invite-status");
    show(status, "正在生成…");
    try {
      const result = await call("POST", "/multiplayer/admin/invites");
      $("invite-code").textContent = result.invite;
      $("invite-code").hidden = false;
      show(status, "邀请码只显示这一次，单次有效，请复制后发给玩家。", "ok");
    } catch (error) {
      show(status, error.message, "error");
    }
  });
})();
