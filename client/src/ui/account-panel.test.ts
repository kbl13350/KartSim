import assert from "node:assert/strict";
import test from "node:test";

import type { AccountSummary } from "../account/account-session";
import { summaryFixture } from "../account/account-test-fixtures";
import { accountPanelRows, formatAccountDate, formatAccountExperience, openAccountPanel } from "./account-panel";
import { FakeDocument, type FakeElement } from "./fake-dom";

function fakeSession(initial: AccountSummary) {
  let summary = initial;
  const listeners = new Set<() => void>();
  const renamed: string[] = [];
  return {
    renamed,
    summary: () => summary,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    updateNickname: async (nickname: string) => {
      if (nickname === "已占用") throw new Error("NICKNAME_TAKEN");
      renamed.push(nickname);
      summary = { ...summary, account: { ...summary.account, nickname } };
      for (const listener of listeners) listener();
    },
    change(next: AccountSummary) {
      summary = next;
      for (const listener of listeners) listener();
    },
  };
}

function parts(document: FakeDocument) {
  const overlay = document.body.children.at(-1)!;
  const panel = overlay.children[0]!;
  const [heading, rows, nameRow, message, logout, close] = panel.children as FakeElement[];
  const [nickname, rename] = nameRow!.children as FakeElement[];
  return { overlay, heading: heading!, rows: rows!, nickname: nickname!, rename: rename!,
    message: message!, logout: logout!, close: close! };
}

test("account rows show username, level, experience, balances, stats and date", () => {
  const rows = accountPanelRows(summaryFixture());
  assert.deepEqual(rows.map(([label]) => label),
    ["账号名", "等级", "经验", "点券", "金币", "K币", "战绩", "注册时间"]);
  assert.deepEqual(Object.fromEntries(rows), {
    账号名: "driver_1", 等级: "Lv.3 黄色手套3", 经验: "102 / 152（累计 250）",
    点券: "0", 金币: "10,000", K币: "20",
    战绩: "比赛 12 场 · 冠军 3 · 前三 7 · 积分 66", 注册时间: formatAccountDate(Date.UTC(2026, 9, 7, 4)),
  });
  assert.equal(formatAccountExperience({ ...summaryFixture().progress, nextLevelExp: null, exp: 75 }),
    "75（已满级）");
  assert.equal(formatAccountDate(0), "未知");
});

test("the panel renames through the session and follows its changes", async () => {
  const document = new FakeDocument();
  const session = fakeSession(summaryFixture());
  const view = parts((openAccountPanel({ document: document as never, session,
    onLogout: () => {} }), document));
  assert.equal(view.heading.textContent, "账号信息");
  assert.equal(view.nickname.value, "车手甲");
  assert.equal(view.nickname.maxLength, 16);
  view.nickname.value = " 空格";
  view.nickname.dispatch("input");
  await view.rename.fire("click");
  assert.equal(view.message.textContent, "昵称不能为空，且首尾不能有空格。");
  view.nickname.value = "已占用";
  await view.rename.fire("click");
  assert.equal(view.message.textContent, "昵称已被使用。");
  view.nickname.value = "新名字";
  await view.rename.fire("click");
  assert.deepEqual(session.renamed, ["新名字"]);
  assert.equal(view.message.textContent, "昵称已修改。");
  session.change(summaryFixture({ nickname: "新名字", wallet: { lucci: 12_345 } }));
  assert.match(view.rows.text(), /12,345/);
});

test("logout is refused in a multiplayer room and otherwise closes the panel", async () => {
  const document = new FakeDocument();
  const session = fakeSession(summaryFixture());
  let blocked: string | undefined = "正在多人游戏中，请先离开房间和比赛再退出登录。";
  let loggedOut = 0;
  let closed = 0;
  openAccountPanel({ document: document as never, session, logoutBlocked: () => blocked,
    onLogout: () => { loggedOut++; }, onClose: () => { closed++; } });
  const view = parts(document);
  await view.logout.fire("click");
  assert.equal(view.message.textContent, blocked);
  assert.equal(loggedOut, 0);
  blocked = undefined;
  await view.logout.fire("click");
  assert.equal(loggedOut, 1);
  assert.equal(closed, 1);
  assert.equal(view.overlay.removed, true);
});
